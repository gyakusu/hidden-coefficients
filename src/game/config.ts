// ============================================================================
//  チューニング・パラメータ一覧（設計書 §9 に対応）
//  数値は設計書の比率関係（VA最強 / 会議ダミー / 報告は信頼源 …）を保ちつつ、
//  10ターンで意味あるプレイ感になるよう調整した実装値。
// ============================================================================

import type { ActivityKey } from './types'

/** 1ターンの持ち時間（年間労働時間）。 */
export const TOTAL_HOURS = 2000

/**
 * 得点化される年数。設計書では全10ターンのうち 10年目は「説明フェーズ（演出・
 * 非得点）」なので、1〜9年目をプレイし、10年目はエンディング（種明かし）とする。
 */
export const PLAY_YEARS = 9

/** 昇進イベントの発生年（定数 → 変数化）。 */
export const PROMOTION_YEAR = 5

/** 各アクティビティの「1回あたり所要時間」（回数表示・制約用）。 */
export const UNIT_HOURS: Record<ActivityKey, number> = {
  meeting: 2,
  docs: 1,
  visit: 8,
  va: 4,
  report: 1,
  develop: 1,
}

/** 会議の最低回数（= 最低時間）。上申で解除可能。 */
export const MEETING_MIN_COUNT = 200
export const MEETING_MIN_HOURS = MEETING_MIN_COUNT * UNIT_HOURS.meeting // 400h

// ---- 成果係数（1時間あたり。設計書 §4.2 の大小関係を踏襲）----
export const COEF = {
  /** 会議：ほぼ定数（ダミー）。 */
  meetingBase: 0.003,
  /** 資料作成 → 会議 の交差項：資料に時間をかけると会議係数が「多少」底上げ。 */
  meetingDocsBoost: 0.003,
  /** その底上げが最大になる資料作成時間。 */
  docsBoostFullHours: 600,
  /** VA提案：真の主力変数（ゲート全開時）。 */
  va: 0.03,
  /** 報告：直接成果はゼロ（信頼ptの源泉）。 */
  report: 0,
}

// ---- 資料作成の凹関数化（設計書 §2）----
//  線形（0.006×時間）を飽和曲線に置換：value = MAX × (1 − exp(−h / TAU))。
//  「1hで大半、作り込みは逓減」＝“少し作るのは正解、作り込むのは悪手”を数式で表す。
/** 資料作成の寄与の上限（頭打ち値）。 */
export const DOCS_VALUE_MAX = 2.4
/** 資料作成の飽和速度（この時間で 63% に到達）。 */
export const DOCS_TAU = 150

// ---- 現場訪問：累積サチュレーション（設計改訂 2026-07 §1・非定常係数）----
//  「外を見て世界の解像度を上げる」性質（旧・競合調査）を現場訪問へ吸収した。
//  知識ストック K = 1 − exp(−累積訪問時間 / TAU)。
//  その年の成果寄与は「K の年内差分（フロー）」に比例＝初回の訪問は効くが、
//  同じ配分を繰り返すほど逓減する（＝「効いた配分をもう一度」が通用しない）。
//  信頼獲得（VISIT_TRUST_RATE）は線形のまま残し、成果面が飽和しても現場訪問は
//  「信頼維持のための行動」として役割が変わる（死に枠にはならない）。
/** 知識ストックの飽和速度（累積600hで63%が埋まる）。 */
export const VISIT_TAU = 600
/** K の差分 1.0 あたりの成果（フロー型の最大寄与係数。初期傾き 12/600 = 0.02/h）。 */
export const VISIT_VALUE_MAX = 12
/** 情報開示ティア①（その年の運＝ランダム係数の符号が読めるようになる知識ストック閾値）。 */
export const VISIT_INFO_TIER_1 = 0.5
/** 情報開示ティア②（寄与上位1項目が実名で読めるようになる知識ストック閾値）。 */
export const VISIT_INFO_TIER_2 = 0.8

// ---- 市況係数：会社マターですら決まらない外生要因（設計書 §3）----
//  平均回帰する AR(1) で好況・不況が数年単位でうねる。信頼を積んでも縮まない。
/** 景気のうねりの持続性（前年からの慣性）。 */
export const MACRO_PERSIST = 0.6
/** 年ごとの変動幅（一様乱数の振れ幅 ±）。 */
export const MACRO_STEP = 0.1
/** 市況係数の上下限（1 ± RANGE = 0.75〜1.25）。 */
export const MACRO_RANGE = 0.25
/** ニュースで方向（追い風／向かい風）を報じる閾値。 */
export const MACRO_NEWS_THRESHOLD = 0.1

// ---- VA提案ゲート（信頼正規化値で開く交差項。設計書 §4.3 / §5.3）----
/** これ未満の信頼ではVA係数は立ち上がらない。 */
export const VA_GATE_START = 0.3
/** これ以上の信頼でVA係数が全開になる。 */
export const VA_GATE_FULL = 0.65

// ---- ノイズ（設計書 §5.1 / §5.2）----
/** 信頼が最低のときの振れ幅（±20%）。 */
export const NOISE_MAX = 0.2
/** 信頼が最高のときの振れ幅（±5%）。 */
export const NOISE_MIN = 0.05

// ---- 信頼pt（設計書 §5.4）----
/** 信頼正規化値が 1.0 に達する信頼ptの実数。 */
export const TRUST_MAX = 300
/** 毎年の信頼ptの自然減衰（維持には継続投資が要る）。 */
export const TRUST_DECAY = 0.12
/** 報告 1時間あたりの信頼pt（純粋な信頼源・効率的）。 */
export const REPORT_TRUST_RATE = 0.08
/** 現場訪問 1時間あたりの信頼pt（成果も出る分やや低い）。 */
export const VISIT_TRUST_RATE = 0.04

// ---- チーム意識＝昇進後に「変数化」する部署の力（設計書 §7.2 / §10）----
/** 昇進前の固定値（定数）。 */
export const AWARENESS_BASE = 1.0
/** 育成で到達できる上限倍率。 */
export const AWARENESS_MAX = 1.6
/** 育成 1時間あたりのチーム意識上昇（翌年以降に効く遅延報酬）。 */
export const DEVELOP_RATE = 0.0006

// ---- 上申フェーズ（設計書 §7.1）----
/** 上申に必要な信頼正規化値。 */
export const PETITION_TRUST_NORM = 0.6
/** 上申に必要な累積成果。 */
export const PETITION_CUM_OUTCOME = 55

// ---- 配属シャッフル（改善提案 2026-07 §2）：シードから配属（＝隠れ構造）を生成する。
//  「形の語彙（6種の応答形状）」は固定。「形と項目の対応」はシードで置換し、
//  「パラメータ」はこの幅でジッタする。序列（主力≫中堅≫ダミー）は不変条件として保証される。
//  信頼レート・ゲートの下限側・情報ティアは、詰み配属を避けるため揺らさない（＝信頼の三役は固定）。
export const SCENARIO_JITTER = {
  /** 成果係数・上限値（gated.coef / cumulative.valueMax / concave.valueMax / dummy.base）の揺らし幅。 */
  magnitude: 0.28,
  /** 時定数（τ）の揺らし幅。 */
  tau: 0.28,
  /** VAゲート閾値の揺らし幅（到達可能性を保つため小さめ）。 */
  gate: 0.14,
}
/** ゲート全開閾値のクランプ範囲（必ず信頼投資で到達できる上限に抑える）。 */
export const SCENARIO_GATE_FULL_RANGE: [number, number] = [0.5, 0.72]
/** ゲート立ち上がり閾値の下限、および全開閾値との最小マージン。 */
export const SCENARIO_GATE_START_MIN = 0.15
export const SCENARIO_GATE_MARGIN = 0.12

// ---- 評価（実力点 → ランク）。市況で運良く伸びた素点ではなく、市況調整後の
//      実力点でランクを判定する（設計書 §3.4）。calibrate テストで妥当性を担保。----
export interface Grade {
  min: number
  rank: string
  title: string
  comment: string
}

export const GRADES: Grade[] = [
  {
    min: 230,
    rank: 'S',
    title: '構造を見抜いた者',
    comment: 'ノイズの奥にある係数とゲートを正しく推定し、信頼という隠れ変数を制した。',
  },
  {
    min: 180,
    rank: 'A',
    title: '優れた同定者',
    comment: '主力変数 VA提案とその前提条件にたどり着き、終盤を伸ばし切った。',
  },
  {
    min: 130,
    rank: 'B',
    title: '堅実な探索者',
    comment: '何かが効いていることは掴んだ。あと一歩、前提条件への踏み込みが鍵だった。',
  },
  {
    min: 80,
    rank: 'C',
    title: '迷える観測者',
    comment: 'ノイズに翻弄され、変数と定数の切り分けが最後まで定まらなかった。',
  },
  {
    min: 0,
    rank: 'D',
    title: '罠にかかった者',
    comment: '「VA提案は効かない」と早合点していないか？ 閉じていたのはゲートだった。',
  },
]
