// ============================================================================
//  配属シナリオ生成（改善提案 2026-07 §2「配属シャッフル：構造のシード乱数化」）。
//
//  ゲーム開始時にプレイヤーは架空の部署へ配属される。部署はフレーバーだが、
//  その本当の意味は「隠れた係数構造の割り当て（＝シード）」である。
//
//  設計方針（提案 §2.2）:
//   - 応答形状の語彙（6種）は固定。全配属に必ず 1 つずつ存在する。
//   - 「形と項目の対応」はシードで置換する（もっともらしさ制約つき）。
//   - 「パラメータ」はシードでジッタする。序列（主力≫中堅≫ダミー）は不変。
//   - 信頼の三役・市況・ノイズ構造は固定（ゲームの心臓部）。
//
//  実装上の対応（提案 §2.3 のクラス分けを踏まえた確定サブセット）:
//   - 報告 = 純粋な信頼源（ゼロ形状）、育成 = 昇進後の遅延報酬（遅延形状）は
//     「信頼の三役／昇進」の固定装置として据え置く。
//   - 主力4活動 {会議・資料作成・現場訪問・VA提案} の間で、
//     4つの成果形状 {ゲート付き線形・累積凹・年内凹・弱線形ダミー} をシードで置換する。
//     → 4! = 24 通りの配属構造 × パラメータのジッタ × 市況/ノイズ系列（シード連動）。
//   - 現行構造は「調達部（標準配属）」としてシード空間に必ず含める（提案 §6 レギュラー配属）。
// ============================================================================

import * as C from './config'
import type { ActivityKey } from './types'

/** 応答形状（役割）の語彙。全配属にこの6種が必ず1つずつ存在する。 */
export type RoleKey = 'gated' | 'cumulative' | 'concave' | 'dummy' | 'zero' | 'delayed'

/** シードで置換される「成果側」4活動と、その置換対象となる4形状（固定順）。 */
export const OUTCOME_ACTIVITIES: ActivityKey[] = ['meeting', 'docs', 'visit', 'va']
export const OUTCOME_ROLES: RoleKey[] = ['gated', 'cumulative', 'concave', 'dummy']

/** 各役割のパラメータ（engine が直接読む）。基準値は config、生成時にジッタされる。 */
export interface ScenarioParams {
  /** ゲート付き線形＝真の主力変数。 */
  gated: { coef: number; gateStart: number; gateFull: number }
  /** 累積凹＝非定常な変数（知識ストック）＋線形の信頼源。 */
  cumulative: { valueMax: number; tau: number; trustRate: number; infoTier1: number; infoTier2: number }
  /** 年内凹＝逓減する弱い変数。ダミーへの交差項を持つ。 */
  concave: { valueMax: number; tau: number; boost: number; boostFullHours: number }
  /** 弱線形ダミー。交差項で「多少」底上げされる。 */
  dummy: { base: number }
  /** ゼロ＝直接成果なしの純粋な信頼源。 */
  zero: { trustRate: number }
  /** 遅延線形＝昇進後に効くチーム意識の倍率。 */
  delayed: { rate: number; max: number }
}

export interface Department {
  key: string
  name: string
  /** 配属時の辞令フレーバー。雰囲気を与えるが構造は明かさない（＝思い込みを誘うダミー）。 */
  flavor: string
}

export interface Scenario {
  /** 生成に使ったシード文字列。 */
  seed: string
  /** 画面表示用のシード見出し（合言葉ならその文字列、乱数配属なら短いコード）。 */
  seedLabel: string
  /** 合言葉（ユーザー入力）由来か（研修モード）。 */
  fromPassphrase: boolean
  dept: Department
  /** 活動 → 役割（全単射）。 */
  roleOf: Record<ActivityKey, RoleKey>
  /** 役割 → 活動（roleOf の逆写像）。 */
  activityOf: Record<RoleKey, ActivityKey>
  params: ScenarioParams
}

// ---- 部署プール。名称と辞令フレーバーのみ。構造とは独立（提案 §6：名前は当てにならない）。----
const DEPARTMENTS: Department[] = [
  { key: 'procure', name: '調達部', flavor: 'サプライヤーとの折衝が日常。コストと品質のせめぎ合いの最前線だ。' },
  { key: 'sales', name: '営業部', flavor: '数字を背負って外を駆ける。信頼がなければ、話も聞いてもらえない。' },
  { key: 'plan', name: '企画部', flavor: 'アイデアを形にし、組織を動かす。正解の見えない問いばかりだ。' },
  { key: 'dev', name: '開発部', flavor: '技術と締切の板挟み。手を動かした分が、そのまま報われるとは限らない。' },
  { key: 'qa', name: '品質保証部', flavor: '現場を見て、ものを確かめる。地道な観測が、すべての土台になる。' },
  { key: 'prod', name: '生産管理部', flavor: '工程とにらめっこ。段取り八分、詰めが二分の世界。' },
  { key: 'ga', name: '総務部', flavor: '調整と根回しで組織を回す。目立たないが、要になる仕事。' },
  { key: 'biz', name: '事業企画部', flavor: '事業の絵を描き、関係者を巻き込む。動かすには順序がある。' },
]

/** 標準配属（調達部）＝現行構造。シード空間のレギュラー配属（提案 §6）。 */
const BASE_ROLE_OF: Record<ActivityKey, RoleKey> = {
  va: 'gated',
  visit: 'cumulative',
  docs: 'concave',
  meeting: 'dummy',
  report: 'zero',
  develop: 'delayed',
}

/** config の基準値からパラメータ束を作る（ジッタ前）。 */
function baseParams(): ScenarioParams {
  return {
    gated: { coef: C.COEF.va, gateStart: C.VA_GATE_START, gateFull: C.VA_GATE_FULL },
    cumulative: {
      valueMax: C.VISIT_VALUE_MAX,
      tau: C.VISIT_TAU,
      trustRate: C.VISIT_TRUST_RATE,
      infoTier1: C.VISIT_INFO_TIER_1,
      infoTier2: C.VISIT_INFO_TIER_2,
    },
    concave: {
      valueMax: C.DOCS_VALUE_MAX,
      tau: C.DOCS_TAU,
      boost: C.COEF.meetingDocsBoost,
      boostFullHours: C.COEF.docsBoostFullHours,
    },
    dummy: { base: C.COEF.meetingBase },
    zero: { trustRate: C.REPORT_TRUST_RATE },
    delayed: { rate: C.DEVELOP_RATE, max: C.AWARENESS_MAX },
  }
}

// ---- シード付き擬似乱数（文字列シード対応・純粋関数）----

/** 文字列 → 32bit ハッシュ（FNV-1a）。合言葉モードのために文字列を種にできる。 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32：32bit 種から決定的な [0,1) 乱数列を生む軽量PRNG。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * ゲーム全体を再現可能にする、年・用途ごとの決定的RNG。
 * 同じ合言葉なら市況・ノイズの系列まで一致する（提案 §2.4 研修モードの同期）。
 */
export function yearRng(seed: string, year: number, kind: 'noise' | 'market'): () => number {
  return mulberry32(hashSeed(`${seed}::${kind}::${year}`))
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** base を中心に ±width で揺らす。 */
function jitter(rng: () => number, base: number, width: number): number {
  return base * (1 + (rng() * 2 - 1) * width)
}

/** roleOf から activityOf（逆写像）を作る。 */
function invert(roleOf: Record<ActivityKey, RoleKey>): Record<RoleKey, ActivityKey> {
  const out = {} as Record<RoleKey, ActivityKey>
  for (const a of Object.keys(roleOf) as ActivityKey[]) out[roleOf[a]] = a
  return out
}

function makeScenario(
  seed: string,
  seedLabel: string,
  fromPassphrase: boolean,
  dept: Department,
  roleOf: Record<ActivityKey, RoleKey>,
  params: ScenarioParams,
): Scenario {
  return { seed, seedLabel, fromPassphrase, dept, roleOf, activityOf: invert(roleOf), params }
}

/** 現行構造（調達部）を再現する標準シナリオ。engine の既定値でもある。 */
export function baseScenario(): Scenario {
  return makeScenario('__base__', '調達部（標準配属）', false, DEPARTMENTS[0], { ...BASE_ROLE_OF }, baseParams())
}

/** Fisher–Yates（rng 注入）で配列を非破壊シャッフル。 */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * シード文字列から配属シナリオを生成する。
 * - 役割⇄項目：主力4活動の間で4つの成果形状を置換（報告=ゼロ／育成=遅延は固定）。
 * - パラメータ：magnitude / tau / gate をジッタ（信頼レート・情報ティアは固定）。
 * - 部署名：プールからシードで選ぶ（構造とは独立＝当てにならないダミーシグナル）。
 */
export function generateScenario(rawSeed: string, fromPassphrase = false): Scenario {
  const seed = rawSeed.trim()
  const rng = mulberry32(hashSeed(seed || 'default'))

  // 役割⇄項目の置換（成果側4活動のみ。報告=ゼロ・育成=遅延は据え置き）。
  const shapes = shuffle(OUTCOME_ROLES, rng)
  const roleOf: Record<ActivityKey, RoleKey> = { report: 'zero', develop: 'delayed' } as Record<ActivityKey, RoleKey>
  OUTCOME_ACTIVITIES.forEach((a, i) => {
    roleOf[a] = shapes[i]
  })

  // パラメータのジッタ。
  const J = C.SCENARIO_JITTER
  const p = baseParams()
  p.gated.coef = jitter(rng, p.gated.coef, J.magnitude)
  const gateFull = clamp(jitter(rng, p.gated.gateFull, J.gate), C.SCENARIO_GATE_FULL_RANGE[0], C.SCENARIO_GATE_FULL_RANGE[1])
  const gateStart = clamp(
    jitter(rng, p.gated.gateStart, J.gate),
    C.SCENARIO_GATE_START_MIN,
    gateFull - C.SCENARIO_GATE_MARGIN,
  )
  p.gated.gateStart = gateStart
  p.gated.gateFull = gateFull
  p.cumulative.valueMax = jitter(rng, p.cumulative.valueMax, J.magnitude)
  p.cumulative.tau = jitter(rng, p.cumulative.tau, J.tau)
  p.concave.valueMax = jitter(rng, p.concave.valueMax, J.magnitude)
  p.concave.tau = jitter(rng, p.concave.tau, J.tau)
  p.dummy.base = jitter(rng, p.dummy.base, J.magnitude)

  // 部署名（構造とは独立に選ぶ）。
  const dept = DEPARTMENTS[Math.floor(rng() * DEPARTMENTS.length)]

  const seedLabel = fromPassphrase ? seed : `配属コード ${shortCode(seed)}`
  return makeScenario(seed, seedLabel, fromPassphrase, dept, roleOf, p)
}

/** シードから短い表示コード（例: 3F9A）を作る。 */
function shortCode(seed: string): string {
  return hashSeed(seed).toString(16).toUpperCase().padStart(8, '0').slice(-4)
}

/** 乱数配属用のランダムなシード文字列を作る（表示コードの原資にもなる）。 */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// ---- 表示ヘルパ（UI から使う）----

/** その活動が信頼ptを稼ぐか（ゼロ源＝報告、または累積活動）。 */
export function earnsTrust(scenario: Scenario, key: ActivityKey): boolean {
  return key === scenario.activityOf.zero || key === scenario.activityOf.cumulative
}

/** 昇進後に効く遅延活動か（＝育成）。 */
export function isDelayed(scenario: Scenario, key: ActivityKey): boolean {
  return key === scenario.activityOf.delayed
}

export const ROLE_LABEL: Record<RoleKey, string> = {
  gated: '真の主力変数（ゲート付き）',
  cumulative: '非定常（累積飽和）＋信頼源',
  concave: '弱い変数（逓減）',
  dummy: 'ほぼ定数（ダミー）',
  zero: '定数（直接成果ゼロ・信頼源）',
  delayed: '定数 → 変数（昇進の遅延報酬）',
}
