import { describe, it, expect } from 'vitest'
import * as C from './config'
import {
  applyYear,
  canPetition,
  computeYear,
  emptyAllocation,
  initialState,
  meetingMinHours,
  noiseWidth,
  trustNorm,
  vaGate,
} from './engine'
import type { Allocation, GameState } from './types'

// ノイズを消す決定的 rng（randomCoef = 1 になる）。
const noNoise = () => 0.5

describe('信頼の正規化とノイズ幅（設計書 §5.2）', () => {
  it('信頼が高いほどノイズ幅は単調に縮む', () => {
    expect(noiseWidth(0)).toBeCloseTo(C.NOISE_MAX)
    expect(noiseWidth(1)).toBeCloseTo(C.NOISE_MIN)
    expect(noiseWidth(0.5)).toBeGreaterThan(noiseWidth(0.9))
  })

  it('trustNorm は [0,1] にクランプされる', () => {
    expect(trustNorm(-100)).toBe(0)
    expect(trustNorm(C.TRUST_MAX * 2)).toBe(1)
  })
})

describe('VA提案ゲート（設計書 §4.3）', () => {
  it('閾値未満では開かず、全開閾値以上で 1 になる', () => {
    expect(vaGate(C.VA_GATE_START - 0.01)).toBe(0)
    expect(vaGate(C.VA_GATE_FULL)).toBe(1)
    expect(vaGate((C.VA_GATE_START + C.VA_GATE_FULL) / 2)).toBeCloseTo(0.5)
  })

  it('信頼ゼロではVAに全振りしても成果が出ない（罠）', () => {
    const s = { year: 1, trust: 0, awareness: 1, promoted: false }
    const a: Allocation = { ...emptyAllocation(), meeting: 400, va: 1600 }
    const r = computeYear(s, a, noNoise)
    expect(r.contributions.va).toBe(0)
    expect(r.finalOutcome).toBeLessThan(2) // 会議のわずかな寄与のみ
  })

  it('信頼が十分ならVAが主力として立ち上がる', () => {
    const s = { year: 5, trust: C.TRUST_MAX, awareness: 1, promoted: true }
    const a: Allocation = { ...emptyAllocation(), meeting: 400, va: 1600 }
    const r = computeYear(s, a, noNoise)
    expect(r.contributions.va).toBeCloseTo(C.COEF.va * 1600)
  })
})

describe('交差項 資料作成→会議（設計書 §4.3）', () => {
  it('資料作成に時間をかけると会議係数が底上げされる（ただし小さい）', () => {
    const base = { year: 1, trust: 0, awareness: 1, promoted: false }
    const noDocs: Allocation = { ...emptyAllocation(), meeting: 400 }
    const withDocs: Allocation = { ...emptyAllocation(), meeting: 400, docs: 600 }
    const r0 = computeYear(base, noDocs, noNoise)
    const r1 = computeYear(base, withDocs, noNoise)
    expect(r1.contributions.meeting).toBeGreaterThan(r0.contributions.meeting)
    // 底上げされても会議の寄与は小さいまま（ダミー）
    expect(r1.contributions.meeting).toBeLessThan(5)
  })
})

describe('信頼の収支と減衰（設計書 §5.4）', () => {
  it('報告・現場訪問で信頼が貯まり、毎年減衰する', () => {
    const s = initialState()
    s.phase = 'playing'
    const a: Allocation = { ...emptyAllocation(), meeting: 400, report: 1000, visit: 600 }
    const r = computeYear(s, a, noNoise)
    const next = applyYear(s, r)
    const expectedGain = 1000 * C.REPORT_TRUST_RATE + 600 * C.VISIT_TRUST_RATE
    expect(r.trustGain).toBeCloseTo(expectedGain)
    expect(next.trust).toBeCloseTo(0 * (1 - C.TRUST_DECAY) + expectedGain)
  })

  it('VAゲート全開には複数年の信頼投資が必要（一気には満たせない）', () => {
    let s = initialState()
    s.phase = 'playing'
    const invest: Allocation = { ...emptyAllocation(), meeting: 400, report: 1000, visit: 600 }
    const r1 = computeYear(s, invest, noNoise)
    s = applyYear(s, r1)
    // 1年の集中投資ではまだ全開に届かない
    expect(vaGate(trustNorm(s.trust))).toBeLessThan(1)
  })
})

describe('上申と会議制約（設計書 §7.1）', () => {
  it('信頼と累積成果が閾値以上で上申可能、解除で会議下限が 0 に', () => {
    const s = initialState()
    expect(canPetition(s)).toBe(false)
    s.trust = C.TRUST_MAX
    s.cumulativeOutcome = C.PETITION_CUM_OUTCOME
    expect(canPetition(s)).toBe(true)
    expect(meetingMinHours({ constraintsReleased: false })).toBe(C.MEETING_MIN_HOURS)
    expect(meetingMinHours({ constraintsReleased: true })).toBe(0)
  })
})

// ---------------------------------------------------------------------------
//  戦略シミュレーション（決定的）：バランス調整の妥当性を担保する。
//  «信頼を種まきしてからVAに集中» が «VA全振り» «均等» を明確に上回ること。
// ---------------------------------------------------------------------------

type Strategy = (s: GameState) => Allocation

function fill(partial: Partial<Allocation>): Allocation {
  return { ...emptyAllocation(), ...partial }
}

/** 9年プレイして最終累積成果を返す（ノイズなし）。petition 可能なら自動で解除。 */
function simulate(strategy: Strategy): GameState {
  let s = initialState()
  s.phase = 'playing'
  for (let i = 0; i < C.PLAY_YEARS; i++) {
    if (s.year === C.PROMOTION_YEAR) s.promoted = true
    if (canPetition(s)) s = { ...s, constraintsReleased: true }
    const a = strategy(s)
    const r = computeYear(s, a, noNoise)
    s = applyYear(s, r)
  }
  return s
}

// 罠：1年目から会議下限以外を全部VAに突っ込む（信頼を無視）。
const naiveVaAllIn: Strategy = () => fill({ meeting: 400, va: 1600 })

// 均等：会議下限 + 残りを概ね均等配分。
const balanced: Strategy = (s) => {
  const rest = C.TOTAL_HOURS - C.MEETING_MIN_HOURS // 1600
  if (!s.promoted) {
    const each = rest / 4
    return fill({ meeting: 400, docs: each, visit: each, va: each, report: each })
  }
  const each = rest / 5
  return fill({ meeting: 400, docs: each, visit: each, va: each, report: each, develop: each })
}

// 上級：序盤に信頼を種まき → 中盤以降VAに集中し信頼を維持、昇進後は育成にも投資。
const expert: Strategy = (s) => {
  const meeting = s.constraintsReleased ? 0 : 400
  const free = C.TOTAL_HOURS - meeting
  if (s.year <= 3) {
    // 種まき：報告・現場訪問に厚く
    return fill({ meeting, report: free * 0.6, visit: free * 0.4 })
  }
  // 活用：VAに集中しつつ、報告で信頼を維持（減衰対策）。昇進後は育成にも回す。
  if (!s.promoted) {
    return fill({ meeting, va: free * 0.7, report: free * 0.3 })
  }
  return fill({ meeting, va: free * 0.6, report: free * 0.25, develop: free * 0.15 })
}

describe('戦略バランスのキャリブレーション', () => {
  it('上級 > 均等 > 罠（VA全振り）の順で成果が出る', () => {
    const sNaive = simulate(naiveVaAllIn)
    const sBalanced = simulate(balanced)
    const sExpert = simulate(expert)

    // デバッグ用に最終スコアを出力（グレード閾値の調整に使う）。
    // eslint-disable-next-line no-console
    console.log('CALIBRATION scores:', {
      naive: sNaive.cumulativeOutcome.toFixed(1),
      balanced: sBalanced.cumulativeOutcome.toFixed(1),
      expert: sExpert.cumulativeOutcome.toFixed(1),
      expertTrustNorm: trustNorm(sExpert.trust).toFixed(2),
      expertAwareness: sExpert.awareness.toFixed(2),
    })

    expect(sExpert.cumulativeOutcome).toBeGreaterThan(sBalanced.cumulativeOutcome)
    expect(sBalanced.cumulativeOutcome).toBeGreaterThan(sNaive.cumulativeOutcome)
    // 罠は明確に低成果（カウショナリーテール）。
    expect(sNaive.cumulativeOutcome).toBeLessThan(30)
    // 上級は最高ランク帯に届く。
    expect(sExpert.cumulativeOutcome).toBeGreaterThan(C.GRADES[1].min)
  })
})
