import * as C from '../game/config'
import { noiseWidth, trustNorm, trustTier } from '../game/engine'
import type { GameState } from '../game/types'
import { Icon, Meter } from './ui'

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
      </div>

      <div className="status__score">
        <Icon name="monitoring" className="status__score-icon" size={18} />
        <span className="status__score-num">{state.cumulativeOutcome.toFixed(1)}</span>
        <span className="status__score-label">累積成果</span>
      </div>

      <div className="status__meters">
        <Meter
          label="信頼"
          icon="handshake"
          detail={`${TIER_LABEL[tier]}・ノイズ±${noisePct}%`}
          value={tn}
          color="#4db6a8"
        />
        {state.promoted && (
          <Meter
            label="チーム意識"
            icon="diversity_3"
            detail={`×${state.awareness.toFixed(2)}`}
            value={state.awareness - C.AWARENESS_BASE}
            max={C.AWARENESS_MAX - C.AWARENESS_BASE}
            color="#d2728f"
          />
        )}
      </div>
    </header>
  )
}
