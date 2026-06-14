import * as C from '../game/config'
import { generateFeedback } from '../game/hints'
import type { YearResult } from '../game/types'
import { Icon } from './ui'

const TONE_ICON = {
  positive: 'trending_up',
  neutral: 'info',
  warning: 'warning',
  misleading: 'visibility_off',
} as const

export default function ResultPanel({
  result,
  prevOutcome,
  onContinue,
}: {
  result: YearResult
  prevOutcome?: number
  onContinue: () => void
}) {
  const fb = generateFeedback(result)
  const isFinal = result.year >= C.PLAY_YEARS
  const delta = prevOutcome != null ? result.finalOutcome - prevOutcome : null

  return (
    <section className="result card">
      <div className="result__headline">
        <div className="result__outcome">
          <span className="result__outcome-label">{result.year}年目の成果</span>
          <span className="result__outcome-num">{result.finalOutcome.toFixed(1)}</span>
          {delta != null && (
            <span className={`result__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              <Icon name={delta >= 0 ? 'arrow_upward' : 'arrow_downward'} size={14} />
              {Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
        <ul className="result__gains">
          <li>
            <Icon name="handshake" size={15} className="result__gain-icon" />
            信頼 <strong>+{result.trustGain.toFixed(1)}</strong>
          </li>
          {result.awarenessGain > 0 && (
            <li>
              <Icon name="diversity_3" size={15} className="result__gain-icon" />
              意識 <strong>+{result.awarenessGain.toFixed(3)}</strong>
            </li>
          )}
        </ul>
      </div>

      <div className={`result__signal tone-${fb.tone}`}>
        <p className="result__signal-text">
          <Icon name={TONE_ICON[fb.tone]} size={18} className="result__signal-icon" />
          {fb.signal}
        </p>
        <p className="result__dialogue">{fb.dialogue}</p>
      </div>

      <div className="result__actions">
        <button type="button" className="btn btn--primary btn--icon" onClick={onContinue}>
          {isFinal ? '報告会へ' : '次の年へ'}
          <Icon name="arrow_forward" size={20} />
        </button>
      </div>
    </section>
  )
}
