import type { Dispatch } from 'react'
import { canPetition } from '../game/engine'
import type { GameState } from '../game/types'
import type { GameAction } from '../hooks/useGame'
import AllocationPanel from './AllocationPanel'
import HistoryChart from './HistoryChart'
import PromotionModal from './PromotionModal'
import ResultPanel from './ResultPanel'
import StatusBar from './StatusBar'

export default function GameScreen({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: Dispatch<GameAction>
}) {
  const reviewing = state.phase === 'review'
  // レビュー中は state.year が翌年に進んでいるため、表示は実行した年に戻す。
  const displayYear = reviewing ? state.year - 1 : state.year
  const prevOutcome = state.history.at(-2)?.finalOutcome

  return (
    <div className="game">
      <StatusBar state={state} year={displayYear} />

      <div className="game__main">
        {reviewing && state.lastResult ? (
          <ResultPanel
            result={state.lastResult}
            prevOutcome={prevOutcome}
            onContinue={() => dispatch({ type: 'CONTINUE' })}
          />
        ) : (
          <AllocationPanel
            // 年が変わるたびに下書きを作り直す
            key={state.year}
            state={state}
            petitionAvailable={canPetition(state)}
            onRun={(allocation) => dispatch({ type: 'RUN_YEAR', allocation })}
            onPetition={() => dispatch({ type: 'PETITION' })}
          />
        )}

        <HistoryChart history={state.history} />
      </div>

      {state.phase === 'promotion' && (
        <PromotionModal onAck={() => dispatch({ type: 'ACK_PROMOTION' })} />
      )}
    </div>
  )
}
