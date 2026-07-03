import { useReducer } from 'react'
import * as C from '../game/config'
import { applyYear, canPetition, computeYear, initialState } from '../game/engine'
import type { Allocation, GameState, Hypothesis, YearRecord } from '../game/types'

export type GameAction =
  | { type: 'START' }
  | { type: 'RUN_YEAR'; allocation: Allocation }
  | { type: 'CONTINUE'; hypothesis?: Hypothesis | null }
  | { type: 'ACK_PROMOTION' }
  | { type: 'PETITION' }
  | { type: 'RESET' }

/** 直近年の履歴レコードに、年度末に宣言した仮説を書き込む。 */
function withHypothesis(history: YearRecord[], hypothesis: Hypothesis | null): YearRecord[] {
  if (history.length === 0 || hypothesis == null) return history
  const next = history.slice()
  next[next.length - 1] = { ...next[next.length - 1], hypothesis }
  return next
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return { ...initialState(), phase: 'playing', year: 1 }

    case 'RUN_YEAR': {
      if (state.phase !== 'playing') return state
      const result = computeYear(state, action.allocation)
      // 年を進めて結果を確定し、まず「結果レビュー」を見せる。
      return { ...applyYear(state, result), phase: 'review' }
    }

    case 'CONTINUE': {
      if (state.phase !== 'review') return state
      // 年度末レビューで宣言した仮説を、確定した直近年の記録に書き込む。
      const history = withHypothesis(state.history, action.hypothesis ?? null)
      const s = { ...state, history }
      if (s.year > C.PLAY_YEARS) {
        return { ...s, phase: 'ended' } // 10年目 = 説明フェーズ
      }
      if (s.year === C.PROMOTION_YEAR && !s.promoted) {
        // 昇進：定数だった「部署の力」が変数（育成）になる。
        return { ...s, promoted: true, phase: 'promotion' }
      }
      return { ...s, phase: 'playing' }
    }

    case 'ACK_PROMOTION':
      return state.phase === 'promotion' ? { ...state, phase: 'playing' } : state

    case 'PETITION':
      return canPetition(state) ? { ...state, constraintsReleased: true } : state

    case 'RESET':
      return initialState()

    default:
      return state
  }
}

export { gameReducer }

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState)
  return { state, dispatch }
}
