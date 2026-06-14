// ---- ゲームの型定義 ----

/** 時間の振り先（アクティビティ）。develop は昇進後のみ解放される。 */
export type ActivityKey = 'meeting' | 'docs' | 'visit' | 'va' | 'report' | 'develop'

/** 各アクティビティへの投入時間（h）。合計 = TOTAL_HOURS。 */
export type Allocation = Record<ActivityKey, number>

/** 1年の計算結果（プレイヤーには一部のみ開示される）。 */
export interface YearResult {
  year: number
  allocation: Allocation
  /** ノイズ適用前の基礎成果（内部値・通常は非開示）。 */
  baseOutcome: number
  /** ランダム係数適用後の最終成果（これが累積される）。 */
  finalOutcome: number
  /** その年に掛かったランダム係数（0.8〜1.2 など）。 */
  randomCoef: number
  /** ノイズ幅（±）。信頼ptで縮む。 */
  noiseWidth: number
  /** 年初時点の信頼正規化値 [0,1]。ゲート・ノイズはこれで決まる。 */
  trustNormAtStart: number
  /** VA提案ゲートの開き具合 [0,1]。 */
  vaGate: number
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
  /** 累積部署成果（= 最終スコア）。 */
  cumulativeOutcome: number
  history: YearRecord[]
  /** 直近年の結果（結果パネル表示用）。 */
  lastResult: YearResult | null
}
