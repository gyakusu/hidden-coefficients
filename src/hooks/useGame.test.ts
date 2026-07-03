import { describe, it, expect } from 'vitest'
import * as C from '../game/config'
import { initialState } from '../game/engine'
import type { Allocation, GameState } from '../game/types'
import { gameReducer } from './useGame'

const alloc: Allocation = {
  meeting: 400,
  docs: 200,
  visit: 400,
  va: 400,
  report: 600,
  develop: 0,
  research: 0,
}

/** 1ターン分（実行 → レビュー → 続行 / 必要なら昇進を承認）を進める。 */
function playOneYear(state: GameState): GameState {
  let s = gameReducer(state, { type: 'RUN_YEAR', allocation: alloc })
  expect(s.phase).toBe('review')
  s = gameReducer(s, { type: 'CONTINUE' })
  if (s.phase === 'promotion') {
    s = gameReducer(s, { type: 'ACK_PROMOTION' })
  }
  return s
}

describe('ターン進行の状態遷移（reducer）', () => {
  it('START でプレイ開始、1年目になる', () => {
    const s = gameReducer(initialState(), { type: 'START' })
    expect(s.phase).toBe('playing')
    expect(s.year).toBe(1)
  })

  it('RUN_YEAR は year を進めず履歴を1件積み、review へ移る', () => {
    const start = gameReducer(initialState(), { type: 'START' })
    const after = gameReducer(start, { type: 'RUN_YEAR', allocation: alloc })
    expect(after.phase).toBe('review')
    expect(after.history).toHaveLength(1)
    expect(after.lastResult?.year).toBe(1)
    expect(after.year).toBe(2) // 内部的には翌年へ
  })

  it('5年目に昇進イベントが発生し、育成が解放される（promoted）', () => {
    let s = gameReducer(initialState(), { type: 'START' })
    for (let y = 1; y <= 4; y++) s = playOneYear(s)
    // 4年目を終えて5年目に入る瞬間、昇進が挟まる
    expect(s.promoted).toBe(true)
    expect(s.year).toBe(C.PROMOTION_YEAR)
  })

  it('全9年をプレイすると ended に到達し、履歴は9件', () => {
    let s = gameReducer(initialState(), { type: 'START' })
    for (let y = 1; y <= C.PLAY_YEARS; y++) s = playOneYear(s)
    expect(s.phase).toBe('ended')
    expect(s.history).toHaveLength(C.PLAY_YEARS)
    expect(s.cumulativeOutcome).toBeGreaterThan(0)
  })

  it('RESET でタイトルに戻る', () => {
    let s = gameReducer(initialState(), { type: 'START' })
    s = gameReducer(s, { type: 'RESET' })
    expect(s.phase).toBe('title')
    expect(s.history).toHaveLength(0)
  })

  it('CONTINUE に渡した仮説が直近年の記録へ保存される（設計書 §4.1③）', () => {
    let s = gameReducer(initialState(), { type: 'START' })
    s = gameReducer(s, { type: 'RUN_YEAR', allocation: alloc })
    expect(s.history.at(-1)?.hypothesis).toBeNull()
    s = gameReducer(s, { type: 'CONTINUE', hypothesis: 'va' })
    expect(s.history[0].hypothesis).toBe('va')
  })
})
