import * as C from '../game/config'
import { generateFeedback } from '../game/hints'
import type { YearResult } from '../game/types'

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
      <h2 className="result__title">{result.year}年目の結果</h2>

      <div className="result__headline">
        <div className="result__outcome">
          <span className="result__outcome-label">今年の成果</span>
          <span className="result__outcome-num">{result.finalOutcome.toFixed(1)}</span>
          {delta != null && (
            <span className={`result__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
        <ul className="result__gains">
          <li>
            信頼pt <strong>+{result.trustGain.toFixed(1)}</strong>
            <span className="result__gain-src">（報告・現場訪問より）</span>
          </li>
          {result.awarenessGain > 0 && (
            <li>
              チーム意識 <strong>+{result.awarenessGain.toFixed(3)}</strong>
              <span className="result__gain-src">（育成より・翌年以降に効く）</span>
            </li>
          )}
        </ul>
      </div>

      <div className={`result__signal tone-${fb.tone}`}>
        <p className="result__signal-text">{fb.signal}</p>
        <p className="result__dialogue">{fb.dialogue}</p>
      </div>

      <div className="result__actions">
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          {isFinal ? '10年目・報告会へ ▶' : '次の年へ ▶'}
        </button>
      </div>
    </section>
  )
}
