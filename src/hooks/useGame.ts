import { useReducer } from 'react'
import * as C from '../game/config'
import { applyYear, canPetition, computeYear, initialState } from '../game/engine'
import type { Allocation, GameState } from '../game/types'

export type GameAction =
  | { type: 'START' }
  | { type: 'RUN_YEAR'; allocation: Allocation }
  | { type: 'CONTINUE' }
  | { type: 'ACK_PROMOTION' }
  | { type: 'PETITION' }
  | { type: 'RESET' }

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
      if (state.year > C.PLAY_YEARS) {
        return { ...state, phase: 'ended' } // 10年目 = 説明フェーズ
      }
      if (state.year === C.PROMOTION_YEAR && !state.promoted) {
        // 昇進：定数だった「部署の力」が変数（育成）になる。
        return { ...state, promoted: true, phase: 'promotion' }
      }
      return { ...state, phase: 'playing' }
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
