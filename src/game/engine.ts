// ============================================================================
//  成果関数・信頼・ノイズの中核ロジック（純粋関数）。
//  UI から切り離してテスト可能にしてある。
// ============================================================================

import * as C from './config'
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

/** 信頼ptの実数を [0,1] に正規化。 */
export function trustNorm(trust: number): number {
  return saturate(trust / C.TRUST_MAX)
}

/** ノイズ幅（±）。信頼が高いほど縮む単調減少関数（設計書 §5.2）。 */
export function noiseWidth(tn: number): number {
  return C.NOISE_MIN + (C.NOISE_MAX - C.NOISE_MIN) * (1 - saturate(tn))
}

/** VA提案ゲートの開き具合 [0,1]（設計書 §4.3）。 */
export function vaGate(tn: number): number {
  return saturate((tn - C.VA_GATE_START) / (C.VA_GATE_FULL - C.VA_GATE_START))
}

/** 資料作成 → 会議 の交差項を反映した会議の実効係数（設計書 §4.3）。 */
export function meetingCoefEff(docsHours: number): number {
  return C.COEF.meetingBase + C.COEF.meetingDocsBoost * saturate(docsHours / C.COEF.docsBoostFullHours)
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
 * ゲート・ノイズは「年初時点の信頼」で決まる（＝今年の報告/訪問は主に来年効く遅延報酬）。
 */
export function computeYear(
  state: Pick<GameState, 'year' | 'trust' | 'awareness' | 'promoted'>,
  allocation: Allocation,
  rng: () => number = Math.random,
): YearResult {
  const tn = trustNorm(state.trust)
  const gate = vaGate(tn)
  const mCoef = meetingCoefEff(allocation.docs)

  const contributions: Record<ActivityKey, number> = {
    meeting: mCoef * allocation.meeting,
    docs: C.COEF.docs * allocation.docs,
    visit: C.COEF.visit * allocation.visit,
    va: C.COEF.va * gate * allocation.va,
    report: C.COEF.report * allocation.report, // = 0
    develop: 0, // 育成は直接成果に効かない（翌年の意識上昇として効く）
  }

  const baseRaw = ACTIVITY_KEYS.reduce((s, k) => s + contributions[k], 0)
  // チーム意識（部署の力）の倍率。昇進前は定数。
  const base = baseRaw * state.awareness

  const width = noiseWidth(tn)
  // rng() ∈ [0,1) → [-1,1) のランダム係数オフセット
  const randomCoef = 1 + (rng() * 2 - 1) * width
  const finalOutcome = base * randomCoef

  const trustGain = allocation.report * C.REPORT_TRUST_RATE + allocation.visit * C.VISIT_TRUST_RATE
  const awarenessGain = state.promoted
    ? Math.min(C.AWARENESS_MAX - state.awareness, allocation.develop * C.DEVELOP_RATE)
    : 0

  return {
    year: state.year,
    allocation,
    baseOutcome: base,
    finalOutcome,
    randomCoef,
    noiseWidth: width,
    trustNormAtStart: tn,
    vaGate: gate,
    contributions,
    trustGain,
    awarenessGain,
  }
}

/** 結果を状態に反映し、信頼の減衰・意識の上昇・累積成果・履歴を更新する。 */
export function applyYear(state: GameState, result: YearResult): GameState {
  const trustAfter = state.trust * (1 - C.TRUST_DECAY) + result.trustGain
  const awarenessAfter = state.awareness + result.awarenessGain
  const cumulativeAfter = state.cumulativeOutcome + result.finalOutcome

  const record: YearRecord = {
    ...result,
    cumulativeAfter,
    trustAfter,
    awarenessAfter,
  }

  return {
    ...state,
    trust: trustAfter,
    awareness: awarenessAfter,
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

export function initialState(): GameState {
  return {
    phase: 'title',
    year: 1,
    trust: 0,
    awareness: C.AWARENESS_BASE,
    promoted: false,
    constraintsReleased: false,
    cumulativeOutcome: 0,
    history: [],
    lastResult: null,
  }
}
