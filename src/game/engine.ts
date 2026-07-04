// ============================================================================
//  成果関数・信頼・ノイズ・非定常係数・市況の中核ロジック（純粋関数）。
//  UI から切り離してテスト可能にしてある。
// ============================================================================

import * as C from './config'
import { baseScenario } from './scenario'
import type { Scenario } from './scenario'
import type { ActivityKey, Allocation, GameState, YearRecord, YearResult } from './types'

export const ACTIVITY_KEYS: ActivityKey[] = [
  'meeting',
  'docs',
  'visit',
  'va',
  'report',
  'develop',
]

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const saturate = (x: number) => clamp(x, 0, 1)

/** computeYear が必要とする状態の最小集合（非定常係数・市況は省略時に既定値）。 */
type ComputeInput = Pick<GameState, 'year' | 'trust' | 'awareness' | 'promoted'> & {
  /** ゲーム開始からの累積活動の投入時間（省略時 0）。 */
  cumHours?: number
  /** 今年の市況係数（省略時 1.0 = 平年並み）。 */
  market?: number
}

/** 信頼ptの実数を [0,1] に正規化。 */
export function trustNorm(trust: number): number {
  return saturate(trust / C.TRUST_MAX)
}

/** ノイズ幅（±）。信頼が高いほど縮む単調減少関数（設計書 §5.2）。 */
export function noiseWidth(tn: number): number {
  return C.NOISE_MIN + (C.NOISE_MAX - C.NOISE_MIN) * (1 - saturate(tn))
}

/**
 * ゲート付き線形の開き具合 [0,1]（設計書 §4.3）。
 * 標準配属では VA提案の「ゲート」だが、配属によって担う活動は入れ替わる。
 * 閾値は省略時は標準配属の値（既存テスト互換）、シナリオからは配属ごとの値を渡す。
 */
export function vaGate(tn: number, start: number = C.VA_GATE_START, full: number = C.VA_GATE_FULL): number {
  return saturate((tn - start) / (full - start))
}

/** 年内凹（資料作成型）の寄与。投入に対して逓減する飽和曲線（設計書 §2）。 */
export function docsValue(
  hours: number,
  valueMax: number = C.DOCS_VALUE_MAX,
  tau: number = C.DOCS_TAU,
): number {
  return valueMax * (1 - Math.exp(-Math.max(0, hours) / tau))
}

/** 累積凹（現場訪問型）の知識ストック K = 1 − exp(−累積時間 / TAU)（設計改訂 §1）。 */
export function knowledgeStock(cumHours: number, tau: number = C.VISIT_TAU): number {
  return 1 - Math.exp(-Math.max(0, cumHours) / tau)
}

/** 市況係数を1年進める AR(1)（平均回帰・設計書 §3.1）。 */
export function rollMarket(prev: number, rng: () => number = Math.random): number {
  const eps = (rng() * 2 - 1) * C.MACRO_STEP
  const next = 1 + C.MACRO_PERSIST * (prev - 1) + eps
  return clamp(next, 1 - C.MACRO_RANGE, 1 + C.MACRO_RANGE)
}

export type MarketNews = 'up' | 'down' | 'flat'

/** 市況係数から、年初に開示する「ニュースの向き」を返す（設計書 §3.3）。 */
export function marketNews(market: number): MarketNews {
  if (market >= 1 + C.MACRO_NEWS_THRESHOLD) return 'up'
  if (market <= 1 - C.MACRO_NEWS_THRESHOLD) return 'down'
  return 'flat'
}

/** 信頼正規化値から定性的なティアを返す（UI 表示・ヒント精度用）。 */
export function trustTier(tn: number): 'low' | 'mid' | 'high' {
  if (tn >= C.VA_GATE_FULL) return 'high'
  if (tn >= C.VA_GATE_START) return 'mid'
  return 'low'
}

/** 空の配分を生成。 */
export function emptyAllocation(): Allocation {
  return { meeting: 0, docs: 0, visit: 0, va: 0, report: 0, develop: 0 }
}

export function totalAllocated(a: Allocation): number {
  return ACTIVITY_KEYS.reduce((s, k) => s + (a[k] || 0), 0)
}

/**
 * その年の結果を計算する。
 * ゲート・ノイズは「年初時点の信頼」で決まる（＝今年の信頼投資は主に来年効く遅延報酬）。
 * 各活動が担う「応答形状（役割）」は scenario で決まる（配属シャッフル・改善提案 §2）。
 * 累積活動は知識ストックの年内差分（フロー）として成果に効き、信頼獲得は線形のまま。
 * 市況は最後に外生的に掛かる。scenario 省略時は標準配属（調達部）＝現行挙動を再現する。
 */
export function computeYear(
  state: ComputeInput,
  allocation: Allocation,
  rng: () => number = Math.random,
  scenario: Scenario = baseScenario(),
): YearResult {
  const tn = trustNorm(state.trust)
  const p = scenario.params
  const of = scenario.activityOf

  const gatedA = of.gated
  const cumA = of.cumulative
  const concaveA = of.concave
  const dummyA = of.dummy
  const zeroA = of.zero
  const delayedA = of.delayed

  const gate = vaGate(tn, p.gated.gateStart, p.gated.gateFull)

  // 累積活動の成果寄与は「累積投入で決まる知識ストックの年内差分（フロー）」。
  //  初回は世界の見え方を変えるが、繰り返すほど新たに埋まる知識は減り、逓減する。
  const cumBefore = state.cumHours ?? 0
  const knowledgeAtStart = knowledgeStock(cumBefore, p.cumulative.tau)
  const knowledgeAtEnd = knowledgeStock(cumBefore + allocation[cumA], p.cumulative.tau)
  const cumFlow = p.cumulative.valueMax * (knowledgeAtEnd - knowledgeAtStart)

  // 年内凹（＝ダミーへの交差項を持つ）の実効ダミー係数。
  const dummyCoef = p.dummy.base + p.concave.boost * saturate(allocation[concaveA] / p.concave.boostFullHours)

  // 役割ごとの寄与を、担当活動のキーに書き込む（役割⇄活動は全単射）。
  const contributions: Record<ActivityKey, number> = emptyAllocation()
  contributions[gatedA] = p.gated.coef * gate * allocation[gatedA]
  contributions[cumA] = cumFlow
  contributions[concaveA] = docsValue(allocation[concaveA], p.concave.valueMax, p.concave.tau)
  contributions[dummyA] = dummyCoef * allocation[dummyA]
  contributions[zeroA] = 0 // 直接成果ゼロ（信頼源）
  contributions[delayedA] = 0 // 遅延報酬（翌年の意識上昇として効く）

  const baseRaw = ACTIVITY_KEYS.reduce((s, k) => s + contributions[k], 0)
  // チーム意識（部署の力）の倍率。昇進前は定数。
  const base = baseRaw * state.awareness

  const width = noiseWidth(tn)
  // rng() ∈ [0,1) → [-1,1) のランダム係数オフセット
  const randomCoef = 1 + (rng() * 2 - 1) * width
  const marketCoef = state.market ?? 1
  const finalOutcome = base * randomCoef * marketCoef

  // 信頼獲得：純粋な信頼源（ゼロ役）＋累積活動（線形・飽和と無関係）。
  const trustGain = allocation[zeroA] * p.zero.trustRate + allocation[cumA] * p.cumulative.trustRate
  const awarenessGain = state.promoted
    ? Math.min(p.delayed.max - state.awareness, allocation[delayedA] * p.delayed.rate)
    : 0

  return {
    year: state.year,
    allocation,
    baseOutcome: base,
    finalOutcome,
    randomCoef,
    marketCoef,
    noiseWidth: width,
    trustNormAtStart: tn,
    vaGate: gate,
    knowledgeAtStart,
    knowledgeAtEnd,
    contributions,
    trustGain,
    awarenessGain,
  }
}

/**
 * 結果を状態に反映し、信頼の減衰・意識の上昇・累積成果・累積活動時間・履歴を更新する。
 * 併せて翌年の市況係数をロールしておく（rng は再現性のため注入可能）。
 * 累積時間は「累積役の活動」の投入分を積む（scenario 省略時は標準配属＝現場訪問）。
 */
export function applyYear(
  state: GameState,
  result: YearResult,
  rng: () => number = Math.random,
  scenario: Scenario = baseScenario(),
): GameState {
  const trustAfter = state.trust * (1 - C.TRUST_DECAY) + result.trustGain
  const awarenessAfter = state.awareness + result.awarenessGain
  const cumulativeAfter = state.cumulativeOutcome + result.finalOutcome
  const cumHoursAfter = state.cumHours + result.allocation[scenario.activityOf.cumulative]

  const record: YearRecord = {
    ...result,
    cumulativeAfter,
    trustAfter,
    awarenessAfter,
    cumHoursAfter,
    hypothesis: null,
    durability: null,
  }

  return {
    ...state,
    trust: trustAfter,
    awareness: awarenessAfter,
    cumHours: cumHoursAfter,
    market: rollMarket(state.market, rng),
    cumulativeOutcome: cumulativeAfter,
    history: [...state.history, record],
    lastResult: result,
    year: state.year + 1,
  }
}

/** 上申（会議制約の解除）の条件を満たしているか。 */
export function canPetition(state: GameState): boolean {
  return (
    !state.constraintsReleased &&
    trustNorm(state.trust) >= C.PETITION_TRUST_NORM &&
    state.cumulativeOutcome >= C.PETITION_CUM_OUTCOME
  )
}

/** その年の会議の最低時間（制約解除後は 0）。 */
export function meetingMinHours(state: Pick<GameState, 'constraintsReleased'>): number {
  return state.constraintsReleased ? 0 : C.MEETING_MIN_HOURS
}

/**
 * 素点を市況で割り戻した「実力点」（設計書 §3.4）。
 * 「もし市況が平年並みだったら」の反実仮想。ランク判定はこちらで行う。
 */
export function skillScore(history: YearRecord[]): number {
  return history.reduce((s, r) => s + (r.marketCoef !== 0 ? r.finalOutcome / r.marketCoef : r.finalOutcome), 0)
}

export interface OutcomeSplit {
  /** 実力分（行動が生んだ基礎成果）。 */
  skill: number
  /** 市況分（外生の追い風／向かい風）。 */
  market: number
  /** 運分（ノイズによるブレ）。 */
  noise: number
}

/**
 * 最終成果を「実力・市況・運」に分解する（設計書 §4.1・年度末レビューの霧つき表示用）。
 * skill + market + noise = finalOutcome。
 */
export function decompose(r: YearResult): OutcomeSplit {
  const skill = r.baseOutcome
  const market = r.baseOutcome * (r.marketCoef - 1)
  const noise = r.baseOutcome * r.marketCoef * (r.randomCoef - 1)
  return { skill, market, noise }
}

/**
 * 反実仮想（設計書 §4.2）：最終年の配分を1年目から貫いていたら？
 * 市況・乱数は実際に起きた系列を再利用し、信頼・意識・ゲートだけ再計算する。
 * 「探索に費やした年数の授業料」を定量化する。scenario は配属の隠れ構造。
 */
export function counterfactualScore(history: YearRecord[], scenario: Scenario = baseScenario()): number {
  if (history.length === 0) return 0
  const finalAlloc = history[history.length - 1].allocation
  let s: GameState = { ...initialState(), scenario, phase: 'playing' }
  let cum = 0
  for (const rec of history) {
    if (s.year === C.PROMOTION_YEAR) s.promoted = true
    if (canPetition(s)) s = { ...s, constraintsReleased: true }
    const alloc = legalizeAllocation(finalAlloc, meetingMinHours(s), s.promoted)
    // 実際に起きた乱数ドロー u を randomCoef から復元して再利用（同一系列）。
    const width = rec.noiseWidth
    const u = width > 0 ? 0.5 + (rec.randomCoef - 1) / (2 * width) : 0.5
    const r = computeYear(
      { ...s, market: rec.marketCoef }, // 市況は外生：実際の系列をそのまま使う
      alloc,
      () => u,
      scenario,
    )
    s = applyYear(s, r, () => 0.5, scenario)
    cum += r.finalOutcome
  }
  return cum
}

/**
 * 配分を「その年に実行可能な形」に整える（反実仮想の再生用）。
 * 会議下限を満たし、育成は昇進前なら0に寄せ、合計 TOTAL_HOURS を維持する。
 */
function legalizeAllocation(alloc: Allocation, minMeeting: number, promoted: boolean): Allocation {
  const a: Allocation = { ...alloc }
  if (!promoted && a.develop > 0) {
    // 昇進前は育成不可。時間を報告へ移す。
    a.report += a.develop
    a.develop = 0
  }
  if (a.meeting < minMeeting) {
    let deficit = minMeeting - a.meeting
    a.meeting = minMeeting
    for (const k of ['va', 'report', 'visit', 'docs', 'develop'] as ActivityKey[]) {
      if (deficit <= 0) break
      const take = Math.min(a[k], deficit)
      a[k] -= take
      deficit -= take
    }
  }
  return a
}

export function initialState(): GameState {
  return {
    phase: 'title',
    year: 1,
    trust: 0,
    awareness: C.AWARENESS_BASE,
    promoted: false,
    constraintsReleased: false,
    scenario: baseScenario(),
    cumHours: 0,
    market: 1.0,
    cumulativeOutcome: 0,
    history: [],
    lastResult: null,
  }
}
