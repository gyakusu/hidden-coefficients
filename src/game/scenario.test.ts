import { describe, it, expect } from 'vitest'
import * as C from './config'
import {
  applyYear,
  canPetition,
  computeYear,
  emptyAllocation,
  initialState,
  meetingMinHours,
} from './engine'
import {
  baseScenario,
  generateScenario,
  hashSeed,
  mulberry32,
  OUTCOME_ROLES,
  yearRng,
} from './scenario'
import type { RoleKey, Scenario } from './scenario'
import type { Allocation, GameState } from './types'

const ALL_ROLES: RoleKey[] = ['gated', 'cumulative', 'concave', 'dummy', 'zero', 'delayed']
const noNoise = () => 0.5

/** 役割ベースの配分を、この配属の活動キーへ写して作る（会議下限は自動確保）。 */
function build(scenario: Scenario, s: GameState, weights: Partial<Record<RoleKey, number>>): Allocation {
  const minMeeting = meetingMinHours(s)
  const a = emptyAllocation()
  a.meeting = minMeeting
  const free = C.TOTAL_HOURS - minMeeting
  const total = Object.values(weights).reduce((x, y) => x + (y ?? 0), 0) || 1
  for (const role of Object.keys(weights) as RoleKey[]) {
    a[scenario.activityOf[role]] += free * ((weights[role] ?? 0) / total)
  }
  return a
}

/** 配属を通して9年プレイ（ノイズ・市況なし）。petition 可能なら自動解除。 */
function simulate(scenario: Scenario, strategy: (s: GameState) => Allocation): GameState {
  let s: GameState = { ...initialState(), scenario, phase: 'playing' }
  for (let i = 0; i < C.PLAY_YEARS; i++) {
    if (s.year === C.PROMOTION_YEAR) s.promoted = true
    if (canPetition(s)) s = { ...s, constraintsReleased: true }
    const a = strategy(s)
    const r = computeYear(s, a, noNoise, scenario)
    s = applyYear(s, r, noNoise, scenario)
  }
  return s
}

// 罠：主力（ゲート付き）へ全振りするが信頼を積まない。
const naive = (scenario: Scenario) => (s: GameState) => build(scenario, s, { gated: 1 })

// 均等：主力・累積・凹・ダミー・信頼源へ広く配る（昇進後は育成も）。
const balanced = (scenario: Scenario) => (s: GameState) =>
  build(scenario, s, {
    gated: 1,
    cumulative: 1,
    concave: 1,
    dummy: 1,
    zero: 1,
    delayed: s.promoted ? 1 : 0,
  })

// 上級：序盤に信頼を種まき → 中盤以降は主力に集中し信頼を維持、昇進後は育成にも投資。
const expert = (scenario: Scenario) => (s: GameState) => {
  if (s.year <= 3) return build(scenario, s, { zero: 0.6, cumulative: 0.4 })
  if (!s.promoted) return build(scenario, s, { gated: 0.7, zero: 0.3 })
  return build(scenario, s, { gated: 0.6, zero: 0.25, delayed: 0.15 })
}

const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`)

describe('配属シナリオ生成（改善提案 §2）', () => {
  it('標準配属（調達部）は現行構造を再現する', () => {
    const b = baseScenario()
    expect(b.dept.name).toBe('調達部')
    expect(b.roleOf).toMatchObject({
      va: 'gated',
      visit: 'cumulative',
      docs: 'concave',
      meeting: 'dummy',
      report: 'zero',
      develop: 'delayed',
    })
    // 逆写像も整合。
    expect(b.activityOf.gated).toBe('va')
    expect(b.activityOf.cumulative).toBe('visit')
  })

  it('全シードで6形状が過不足なく1つずつ存在する（形の語彙は固定）', () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed)
      const roles = Object.values(sc.roleOf)
      expect(roles).toHaveLength(6)
      expect(new Set(roles).size).toBe(6)
      for (const role of ALL_ROLES) expect(roles).toContain(role)
    }
  })

  it('報告=ゼロ（信頼源）／育成=遅延 は固定、主力4形状は成果側4活動に割り当たる', () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed)
      expect(sc.roleOf.report).toBe('zero')
      expect(sc.roleOf.develop).toBe('delayed')
      // 成果側4活動 {meeting,docs,visit,va} が主力4形状を担う。
      const outcome = new Set([sc.roleOf.meeting, sc.roleOf.docs, sc.roleOf.visit, sc.roleOf.va])
      expect(outcome).toEqual(new Set(OUTCOME_ROLES))
    }
  })

  it('パラメータのジッタは序列（主力≫中堅≫ダミー）を壊さない', () => {
    for (const seed of SEEDS) {
      const p = generateScenario(seed).params
      const dummyRate = p.dummy.base + p.concave.boost // ダミーの実効 per-h（交差項込み最大）
      // 主力（ゲート付き）の per-h ≫ ダミーの per-h。
      expect(p.gated.coef).toBeGreaterThan(dummyRate * 3)
      // 主力の総ポテンシャル（全開・自由時間ぶん）≫ 累積の飽和上限 ≫ 年内凹の上限。
      expect(p.gated.coef * 1600).toBeGreaterThan(p.cumulative.valueMax)
      expect(p.cumulative.valueMax).toBeGreaterThan(p.concave.valueMax)
      // 中堅（年内凹）の初期傾きはダミーの per-h を上回る（“弱い変数”＞“ダミー”）。
      expect(p.concave.valueMax / p.concave.tau).toBeGreaterThan(dummyRate)
      // ゲートは信頼投資で必ず到達できる範囲にある。
      expect(p.gated.gateFull).toBeLessThanOrEqual(C.SCENARIO_GATE_FULL_RANGE[1] + 1e-9)
      expect(p.gated.gateStart).toBeLessThan(p.gated.gateFull)
    }
  })

  it('生成は決定的：同じシードは同じ配属・同じ市況/ノイズ系列を生む（合言葉モードの再現性）', () => {
    const a = generateScenario('2026年新人研修A班', true)
    const b = generateScenario('2026年新人研修A班', true)
    expect(a).toEqual(b)
    // 年・用途ごとのRNGも決定的。
    expect(yearRng('x', 3, 'noise')()).toBe(yearRng('x', 3, 'noise')())
    expect(mulberry32(hashSeed('x'))()).toBe(mulberry32(hashSeed('x'))())
    // 別シードは（ほぼ確実に）別の構造か別のパラメータになる。
    const c = generateScenario('別の合言葉', true)
    expect(a.params.gated.coef === c.params.gated.coef && a.roleOf.va === c.roleOf.va).toBe(false)
  })
})

describe('配属シャッフルのバランス不変条件（全シード・プロパティテスト §2.5）', () => {
  it('全シードで 上級 > 均等 > 罠 の順に成果が出て、詰み配属も自明配属も生じない', () => {
    let minExpert = Infinity
    let maxNaive = -Infinity
    let minGap = Infinity
    for (const seed of SEEDS) {
      const sc = generateScenario(seed)
      const sNaive = simulate(sc, naive(sc))
      const sBalanced = simulate(sc, balanced(sc))
      const sExpert = simulate(sc, expert(sc))

      // 序列：上級 > 均等 > 罠（配属に関わらず）。
      expect(sExpert.cumulativeOutcome).toBeGreaterThan(sBalanced.cumulativeOutcome)
      expect(sBalanced.cumulativeOutcome).toBeGreaterThan(sNaive.cumulativeOutcome)
      // 罠は明確に低成果（信頼を積まず主力へ全振り＝ゲートが開かない）。
      expect(sNaive.cumulativeOutcome).toBeLessThan(60)
      // 詰みではない：上級は少なくとも B ランク帯（実力点しきい）に届く。
      expect(sExpert.cumulativeOutcome).toBeGreaterThan(C.GRADES[2].min)
      // 上級戦略なら主力のゲートは全開に達する（前提の到達可能性）。
      expect(sExpert.history.some((r) => r.vaGate >= 0.99)).toBe(true)

      minExpert = Math.min(minExpert, sExpert.cumulativeOutcome)
      maxNaive = Math.max(maxNaive, sNaive.cumulativeOutcome)
      minGap = Math.min(minGap, sExpert.cumulativeOutcome - sBalanced.cumulativeOutcome)
    }
    // eslint-disable-next-line no-console
    console.log('SCENARIO PROPERTY:', {
      seeds: SEEDS.length,
      minExpert: minExpert.toFixed(1),
      maxNaive: maxNaive.toFixed(1),
      minExpertVsBalancedGap: minGap.toFixed(1),
    })
  })

  it('全シードで「同じ配分の反復」は「途中で組み替える」に劣る（非定常の飽和が効く）', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const sc = generateScenario(seed)
      // 序盤に効く累積活動中心の配分を9年そのまま繰り返す。
      const repeat = (s: GameState) => build(sc, s, { cumulative: 0.62, zero: 0.38 })
      // 途中で主力へ組み替える。
      const regroup = (s: GameState) =>
        s.year <= 3 ? build(sc, s, { cumulative: 0.62, zero: 0.38 }) : build(sc, s, { gated: 0.7, zero: 0.3 })
      const sRepeat = simulate(sc, repeat)
      const sRegroup = simulate(sc, regroup)
      expect(sRegroup.cumulativeOutcome).toBeGreaterThan(sRepeat.cumulativeOutcome)
    }
  })
})
