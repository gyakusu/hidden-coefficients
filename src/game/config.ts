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
  /** 資料作成：弱い変数。 */
  docs: 0.006,
  /** 現場訪問：中程度の変数（優等生）。 */
  visit: 0.012,
  /** VA提案：真の主力変数（ゲート全開時）。 */
  va: 0.03,
  /** 報告：直接成果はゼロ（信頼ptの源泉）。 */
  report: 0,
}

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

// ---- 評価（累積成果 → ランク）。calibrate テストで妥当性を担保。----
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
