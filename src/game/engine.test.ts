import { describe, it, expect } from 'vitest'
import * as C from './config'
import {
  applyYear,
  canPetition,
  computeYear,
  counterfactualScore,
  decompose,
  docsValue,
  emptyAllocation,
  initialState,
  knowledgeStock,
  marketNews,
  meetingMinHours,
  noiseWidth,
  rollMarket,
  skillScore,
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
  it('報告・現場訪問で信頼が貯まり、毎年減衰する（訪問の信頼獲得は線形のまま・改訂 §1.2）', () => {
    const s = initialState()
    s.phase = 'playing'
    const a: Allocation = { ...emptyAllocation(), meeting: 400, report: 1000, visit: 600 }
    const r = computeYear(s, a, noNoise)
    const next = applyYear(s, r)
    const expectedGain = 1000 * C.REPORT_TRUST_RATE + 600 * C.VISIT_TRUST_RATE
    expect(r.trustGain).toBeCloseTo(expectedGain)
    expect(next.trust).toBeCloseTo(0 * (1 - C.TRUST_DECAY) + expectedGain)
  })

  it('現場訪問の信頼獲得は、知識ストックが飽和しても線形のまま（成果は飽和しても信頼は稼げる）', () => {
    const saturated = { year: 5, trust: 0, awareness: 1, promoted: false, visitCumHours: 6000 }
    const a: Allocation = { ...emptyAllocation(), meeting: 400, visit: 600 }
    const r = computeYear(saturated, a, noNoise)
    // 知識ストックはほぼ埋まっており成果寄与は小さいが……
    expect(r.contributions.visit).toBeLessThan(0.3)
    // ……信頼獲得は投入時間に線形（飽和と無関係）。
    expect(r.trustGain).toBeCloseTo(600 * C.VISIT_TRUST_RATE)
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

/** 9年プレイして最終累積成果を返す（ノイズ・市況なし）。petition 可能なら自動で解除。 */
function simulate(strategy: Strategy): GameState {
  let s = initialState()
  s.phase = 'playing'
  for (let i = 0; i < C.PLAY_YEARS; i++) {
    if (s.year === C.PROMOTION_YEAR) s.promoted = true
    if (canPetition(s)) s = { ...s, constraintsReleased: true }
    const a = strategy(s)
    const r = computeYear(s, a, noNoise)
    // noNoise(=0.5) を applyYear にも渡すと市況は 1.0 に固定され、戦略比較が決定的になる。
    s = applyYear(s, r, noNoise)
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

  it('「毎年同じ配分」戦略は「途中で組み替える」戦略に劣る（改訂 §2.2 原則3：反復では非定常の形は活かせない）', () => {
    // 「効いた配分をもう一度」：序盤に効く現場訪問中心の配分を、9年そのまま繰り返す。
    const repeatVisit: Strategy = () => fill({ meeting: 400, visit: 1000, report: 600 })
    // 「途中で組み替える」：序盤は同じ配分で信頼と現場の知識を仕込み、
    //  現場訪問の飽和に気づいて中盤以降はVAへ組み替える。
    const regroup: Strategy = (s) => {
      if (s.year <= 3) return fill({ meeting: 400, visit: 1000, report: 600 })
      const meeting = s.constraintsReleased ? 0 : 400
      const free = C.TOTAL_HOURS - meeting
      return fill({ meeting, va: free * 0.7, report: free * 0.3 })
    }

    const sRepeat = simulate(repeatVisit)
    const sRegroup = simulate(regroup)

    // eslint-disable-next-line no-console
    console.log('REGROUP vs REPEAT:', {
      repeat: sRepeat.cumulativeOutcome.toFixed(1),
      regroup: sRegroup.cumulativeOutcome.toFixed(1),
    })

    // 現場訪問は繰り返すほど成果面が飽和するため、同じ配分の反復は頭打ちになる。
    // 飽和に気づいて配分を組み替えた側が明確に上回る。
    expect(sRegroup.cumulativeOutcome).toBeGreaterThan(sRepeat.cumulativeOutcome)
  })
})

// ---------------------------------------------------------------------------
//  P1: 非定常係数（設計書 §1・§2）
// ---------------------------------------------------------------------------

describe('資料作成の凹関数化（設計書 §2）', () => {
  it('投入に対して逓減する（限界効用が下がる）飽和曲線', () => {
    expect(docsValue(0)).toBeCloseTo(0)
    const d100 = docsValue(100)
    const d300 = docsValue(300)
    const d1000 = docsValue(1000)
    // 単調増加だが頭打ち。
    expect(d300).toBeGreaterThan(d100)
    expect(d1000).toBeLessThanOrEqual(C.DOCS_VALUE_MAX + 1e-9)
    // 1時間あたりは逓減：最初の100hの傾き > 300h付近の傾き。
    const slopeEarly = d100 / 100
    const slopeLate = (d1000 - d300) / 700
    expect(slopeEarly).toBeGreaterThan(slopeLate)
  })
})

describe('現場訪問の累積サチュレーション（設計改訂 §1）', () => {
  const base = { year: 1, trust: 0, awareness: 1, promoted: false }

  it('知識ストック K は累積訪問時間で飽和する', () => {
    expect(knowledgeStock(0)).toBeCloseTo(0)
    expect(knowledgeStock(1e9)).toBeCloseTo(1)
    expect(knowledgeStock(C.VISIT_TAU)).toBeCloseTo(1 - Math.exp(-1))
  })

  it('同じ配分でも、初年度は大きく効くが2年目に同じ時間を入れると成果寄与は激減（フロー型・非定常）', () => {
    const a: Allocation = { ...emptyAllocation(), visit: 600 }
    // 1年目（累積0から600投入）
    const y1 = computeYear({ ...base, visitCumHours: 0 }, a, noNoise)
    // 2年目（累積600から、さらに同じ600投入）
    const y2 = computeYear({ ...base, visitCumHours: 600 }, a, noNoise)
    expect(y1.contributions.visit).toBeGreaterThan(5) // 初回は主力級
    expect(y2.contributions.visit).toBeLessThan(y1.contributions.visit * 0.5) // 「効いた配分をもう一度」は通用しない
  })

  it('成果寄与は年初と年末の知識ストック差分に一致する（VISIT_VALUE_MAX × ΔK）', () => {
    const a: Allocation = { ...emptyAllocation(), visit: 400 }
    const r = computeYear({ ...base, visitCumHours: 200 }, a, noNoise)
    expect(r.knowledgeAtStart).toBeCloseTo(knowledgeStock(200))
    expect(r.knowledgeAtEnd).toBeCloseTo(knowledgeStock(600))
    expect(r.contributions.visit).toBeCloseTo(C.VISIT_VALUE_MAX * (r.knowledgeAtEnd - r.knowledgeAtStart))
  })

  it('applyYear が累積訪問時間を積み上げる', () => {
    let s = initialState()
    s.phase = 'playing'
    const a: Allocation = { ...emptyAllocation(), meeting: 400, visit: 800 }
    const r = computeYear(s, a, noNoise)
    s = applyYear(s, r, noNoise)
    expect(s.visitCumHours).toBe(800)
  })
})

// ---------------------------------------------------------------------------
//  P2: 市況（設計書 §3）
// ---------------------------------------------------------------------------

describe('市況係数と評価の二軸化（設計書 §3）', () => {
  it('市況は範囲内にクランプされ、平均回帰する', () => {
    // 上振れの連続を与えても上限を超えない。
    let m = 1
    for (let i = 0; i < 50; i++) m = rollMarket(m, () => 1) // ε = +MACRO_STEP
    expect(m).toBeLessThanOrEqual(1 + C.MACRO_RANGE + 1e-9)
    expect(m).toBeGreaterThan(1)
    // ノイズ0（rng=0.5）なら平均回帰で 1.0 に収束する。
    let back = 1.2
    for (let i = 0; i < 50; i++) back = rollMarket(back, () => 0.5)
    expect(back).toBeCloseTo(1)
  })

  it('市況は成果に外生的に掛かる（信頼では縮まない）', () => {
    const s = { year: 1, trust: 0, awareness: 1, promoted: false, market: 1.2 }
    const a: Allocation = { ...emptyAllocation(), meeting: 400 }
    const r = computeYear(s, a, noNoise)
    expect(r.marketCoef).toBe(1.2)
    expect(r.finalOutcome).toBeCloseTo(r.baseOutcome * 1.2)
  })

  it('marketNews は向きだけを返す', () => {
    expect(marketNews(1.2)).toBe('up')
    expect(marketNews(0.8)).toBe('down')
    expect(marketNews(1.0)).toBe('flat')
  })

  it('実力点は市況で割り戻され、素点と分離される', () => {
    let s = initialState()
    s.phase = 'playing'
    const a: Allocation = { ...emptyAllocation(), meeting: 400, visit: 600 }
    // 市況を追い風に固定して1年進める。
    s = { ...s, market: 1.2 }
    const r = computeYear(s, a, noNoise)
    s = applyYear(s, r, noNoise)
    const raw = s.cumulativeOutcome
    const skill = skillScore(s.history)
    // 追い風なので素点 > 実力点。
    expect(raw).toBeGreaterThan(skill)
    expect(skill).toBeCloseTo(raw / 1.2)
  })

  it('decompose は実力+市況+運＝最終成果に一致する', () => {
    const s = { year: 3, trust: C.TRUST_MAX, awareness: 1.2, promoted: true, market: 0.9 }
    const a: Allocation = { ...emptyAllocation(), meeting: 400, va: 800, visit: 800 }
    const r = computeYear(s, a, () => 0.7)
    const d = decompose(r)
    expect(d.skill + d.market + d.noise).toBeCloseTo(r.finalOutcome)
  })
})

// ---------------------------------------------------------------------------
//  P3: 反実仮想（設計書 §4.2）
// ---------------------------------------------------------------------------

describe('反実仮想スコア（設計書 §4.2）', () => {
  it('毎年同じ配分なら、反実仮想スコアは実際の累積成果に一致する', () => {
    // 制約に触れない一定配分（会議下限のまま・上申しない）で1ゲーム回す。
    const constant: Allocation = { ...emptyAllocation(), meeting: 400, visit: 600, report: 600, va: 400 }
    let s = initialState()
    s.phase = 'playing'
    for (let i = 0; i < C.PLAY_YEARS; i++) {
      if (s.year === C.PROMOTION_YEAR) s.promoted = true
      const r = computeYear(s, constant, () => 0.3) // 一定のノイズ
      s = applyYear(s, r, () => 0.65) // 市況にうねりを持たせる
    }
    const cf = counterfactualScore(s.history)
    // 最終年の配分＝全年の配分なので、同一系列を再利用すれば一致する。
    expect(cf).toBeCloseTo(s.cumulativeOutcome, 1)
  })
})
