import * as C from '../game/config'
import { noiseWidth, trustNorm, trustTier } from '../game/engine'
import type { GameState } from '../game/types'
import { Icon, InfoPopover, Meter } from './ui'

const TIER_LABEL = { low: '低', mid: '中', high: '高' } as const

export default function StatusBar({ state, year }: { state: GameState; year?: number }) {
  const tn = trustNorm(state.trust)
  const tier = trustTier(tn)
  const noisePct = Math.round(noiseWidth(tn) * 100)
  const shownYear = year ?? state.year

  return (
    <header className="status">
      <div className="status__year">
        <Icon name="calendar_month" className="status__year-icon" size={18} />
        <span className="status__year-num">{shownYear}</span>
        <span className="status__year-unit">/ 10年</span>
        <span className="status__dept">
          <Icon name="badge" size={13} />{state.scenario.dept.name}
        </span>
        <InfoPopover label="ゲームの進行について" title="進行" symbol="help" anchor="parent">
          <p>社会人1〜10年目の全10年。1〜9年目に時間配分を試し、最後の10年目で答え合わせ（種明かし）。
            試せる回数は限られている——1年1年が貴重な「実験」だ。</p>
          <p>あなたは<strong>{state.scenario.dept.name}</strong>に配属された。どの活動が効く変数かは
            <strong>配属ごとに変わる</strong>——前の部署の常識は通用しない。</p>
        </InfoPopover>
      </div>

      <div className="status__score">
        <Icon name="monitoring" className="status__score-icon" size={18} />
        <span className="status__score-num">{state.cumulativeOutcome.toFixed(1)}</span>
        <span className="status__score-label">累積成果</span>
        <InfoPopover label="累積成果とは" title="累積成果" anchor="parent">
          毎年の成果を足し上げた最終スコア。<strong>勝敗はこれだけ</strong>で決まる。
          単年の上下に一喜一憂せず、10年の合計を最大化しよう。
        </InfoPopover>
      </div>

      <div className="status__meters">
        <Meter
          label="信頼"
          icon="handshake"
          detail={`${TIER_LABEL[tier]}・ノイズ±${noisePct}%`}
          value={tn}
          color="#4db6a8"
          info={
            <>
              <p><strong>信頼を稼げる活動</strong>を続けるとじわじわ貯まり、毎年少しずつ減る<strong>遅れて効く資産</strong>。</p>
              <p>高いほど成果のブレ（ノイズ）が縮み、数字が読み取りやすくなる。いまは±{noisePct}%。</p>
            </>
          }
        />
        {state.promoted && (
          <Meter
            label="チーム意識"
            icon="diversity_3"
            detail={`×${state.awareness.toFixed(2)}`}
            value={state.awareness - C.AWARENESS_BASE}
            max={C.AWARENESS_MAX - C.AWARENESS_BASE}
            color="#d2728f"
            info="昇進で解放された倍率。「育成」に時間を割くほど上がり、翌年以降のすべての成果を底上げする。"
          />
        )}
      </div>
    </header>
  )
}
