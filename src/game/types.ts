// ---- ゲームの型定義 ----

import type { Scenario } from './scenario'

/**
 * 時間の振り先（アクティビティ）。
 * - develop は昇進後のみ解放される。
 * - 各活動が「どの応答形状（役割）を担うか」は配属シナリオで決まる（改善提案 2026-07 §2）。
 *   例：標準配属（調達部）では va=主力・visit=累積飽和・docs=年内凹・meeting=ダミー。
 */
export type ActivityKey = 'meeting' | 'docs' | 'visit' | 'va' | 'report' | 'develop'

/** 各アクティビティへの投入時間（h）。合計 = TOTAL_HOURS。 */
export type Allocation = Record<ActivityKey, number>

/**
 * 年度末に宣言する仮説①（「最も成果に効くと思う活動」= which）。
 * 'unknown' は「まだ分からない」。保存するだけで、正誤はエンディングまで伏せる。
 */
export type Hypothesis = ActivityKey | 'unknown'

/**
 * 年度末に宣言する仮説②（「その活動は来年も同じだけ効くと思う？」= how。設計改訂 §2.3）。
 * - 'steady'  … 来年も同じだけ効く
 * - 'weaken'  … 弱まる（飽和・逓減する）
 * - 'unknown' … 分からない
 */
export type Durability = 'steady' | 'weaken' | 'unknown'

/** 1年の計算結果（プレイヤーには一部のみ開示される）。 */
export interface YearResult {
  year: number
  allocation: Allocation
  /** ノイズ・市況適用前の基礎成果（内部値・通常は非開示）。 */
  baseOutcome: number
  /** ランダム係数・市況係数適用後の最終成果（これが累積される）。 */
  finalOutcome: number
  /** その年に掛かったランダム係数（0.8〜1.2 など）。信頼で縮む。 */
  randomCoef: number
  /** その年の市況係数（0.75〜1.25 など）。行動と独立で、信頼でも縮まない。 */
  marketCoef: number
  /** ノイズ幅（±）。信頼ptで縮む。 */
  noiseWidth: number
  /** 年初時点の信頼正規化値 [0,1]。ゲート・ノイズはこれで決まる。 */
  trustNormAtStart: number
  /** VA提案ゲートの開き具合 [0,1]。 */
  vaGate: number
  /** 年初時点の累積活動の知識ストック [0,1]。 */
  knowledgeAtStart: number
  /** 年末時点の累積活動の知識ストック [0,1]。 */
  knowledgeAtEnd: number
  /** 各アクティビティの基礎成果への寄与（内部値）。 */
  contributions: Record<ActivityKey, number>
  /** その年に得た信頼pt。 */
  trustGain: number
  /** その年に得たチーム意識（昇進後のみ）。 */
  awarenessGain: number
}

/** 履歴に積む、確定後のスナップショット付き結果。 */
export interface YearRecord extends YearResult {
  cumulativeAfter: number
  trustAfter: number
  awarenessAfter: number
  /** 年末時点の累積活動の投入時間（知識ストックの原資）。 */
  cumHoursAfter: number
  /** 年度末に宣言した仮説①（どの活動が最も効くか＝which。未回答なら null）。 */
  hypothesis: Hypothesis | null
  /** 年度末に宣言した仮説②（その活動は来年も同じだけ効くか＝how。未回答なら null）。 */
  durability: Durability | null
}

export type Phase = 'title' | 'playing' | 'review' | 'promotion' | 'ended'

export interface GameState {
  phase: Phase
  /** 現在プレイ中の年（1..PLAY_YEARS）。 */
  year: number
  /** 信頼ptの実数（年初値）。 */
  trust: number
  /** チーム意識の倍率（昇進前は定数 = AWARENESS_BASE）。 */
  awareness: number
  /** 昇進済みか（5年目で true）。 */
  promoted: boolean
  /** 上申で会議制約を解除済みか。 */
  constraintsReleased: boolean
  /** この配属の隠れ構造（役割⇄項目の対応・係数・部署フレーバー・シード）。 */
  scenario: Scenario
  /** ゲーム開始からの累積活動の投入時間（知識ストックの原資）。 */
  cumHours: number
  /** 今年の市況係数（年初に確定・ニュースで方向のみ開示）。 */
  market: number
  /** 累積部署成果（= 素点。市況込みの最終スコア）。 */
  cumulativeOutcome: number
  history: YearRecord[]
  /** 直近年の結果（結果パネル表示用）。 */
  lastResult: YearResult | null
}
