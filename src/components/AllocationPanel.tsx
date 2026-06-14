import { useMemo, useState } from 'react'
import * as C from '../game/config'
import { meetingMinHours, totalAllocated } from '../game/engine'
import type { Allocation, ActivityKey, GameState } from '../game/types'
import { ACTIVITIES } from './ui'

const STEP = 50

function defaultAllocation(state: GameState): Allocation {
  const min = meetingMinHours(state)
  // 前年の配分を引き継ぐ（微調整しやすい）。初年度は会議下限のみ。
  const prev = state.history.at(-1)?.allocation
  const base: Allocation = prev
    ? { ...prev }
    : { meeting: C.MEETING_MIN_HOURS, docs: 0, visit: 0, va: 0, report: 0, develop: 0 }
  if (!state.promoted) base.develop = 0
  if (base.meeting < min) base.meeting = min
  // 合計が 2000 を超えていたら会議以外を削る（制約変化への保険）。
  let over = totalAllocated(base) - C.TOTAL_HOURS
  for (const k of ['develop', 'report', 'docs', 'va', 'visit'] as ActivityKey[]) {
    if (over <= 0) break
    const cut = Math.min(base[k], over)
    base[k] -= cut
    over -= cut
  }
  return base
}

export default function AllocationPanel({
  state,
  petitionAvailable,
  onRun,
  onPetition,
}: {
  state: GameState
  petitionAvailable: boolean
  onRun: (a: Allocation) => void
  onPetition: () => void
}) {
  const [draft, setDraft] = useState<Allocation>(() => defaultAllocation(state))

  const visible = useMemo(
    () => ACTIVITIES.filter((m) => !m.promotedOnly || state.promoted),
    [state.promoted],
  )
  const min = meetingMinHours(state)
  const total = totalAllocated(draft)
  const remaining = C.TOTAL_HOURS - total
  const balanced = remaining === 0 && draft.meeting >= min

  function set(key: ActivityKey, raw: number) {
    const lo = key === 'meeting' ? min : 0
    const hi = draft[key] + remaining // 残り時間を超えて増やせない
    const next = Math.max(lo, Math.min(hi, raw))
    setDraft((d) => ({ ...d, [key]: next }))
  }

  function reset() {
    setDraft({ meeting: min, docs: 0, visit: 0, va: 0, report: 0, develop: 0 })
  }

  return (
    <section className="alloc card">
      <div className="alloc__head">
        <h2>今年の時間配分</h2>
        <div className={`alloc__remaining ${balanced ? 'is-ok' : 'is-warn'}`}>
          残り <strong>{remaining}</strong> h
          <span className="alloc__total">（{total} / {C.TOTAL_HOURS}h）</span>
        </div>
      </div>

      <div className="alloc__bar">
        {visible.map((m) => {
          const w = (draft[m.key] / C.TOTAL_HOURS) * 100
          return (
            <div
              key={m.key}
              className="alloc__bar-seg"
              style={{ width: `${w}%`, background: m.accent }}
              title={`${m.label} ${draft[m.key]}h`}
            />
          )
        })}
      </div>

      <ul className="alloc__list">
        {visible.map((m) => {
          const unit = C.UNIT_HOURS[m.key]
          const hours = draft[m.key]
          const count = unit > 1 ? Math.floor(hours / unit) : null
          const sliderMax = hours + remaining
          const lockedMin = m.key === 'meeting' ? min : 0
          return (
            <li key={m.key} className="alloc__row">
              <div className="alloc__row-head">
                <span className="alloc__chip" style={{ background: m.accent }} />
                <span className="alloc__name">{m.label}</span>
                <span className="alloc__note">{m.note}</span>
              </div>
              <div className="alloc__controls">
                <input
                  type="range"
                  min={lockedMin}
                  max={Math.max(sliderMax, lockedMin)}
                  step={STEP}
                  value={hours}
                  onChange={(e) => set(m.key, Number(e.target.value))}
                  style={{ accentColor: m.accent }}
                  aria-label={`${m.label}の時間`}
                />
                <div className="alloc__value">
                  <strong>{hours}</strong>h
                  {count !== null && <span className="alloc__count">≈ {count}回</span>}
                </div>
                <button
                  type="button"
                  className="alloc__fill-btn"
                  disabled={remaining === 0}
                  onClick={() => set(m.key, hours + remaining)}
                >
                  + 残り
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="alloc__actions">
        <button type="button" className="btn btn--ghost" onClick={reset}>
          リセット
        </button>
        {petitionAvailable && (
          <button type="button" className="btn btn--petition" onClick={onPetition}>
            上申する（会議制約を外す）
          </button>
        )}
        {state.constraintsReleased && (
          <span className="alloc__released">✓ 会議制約は解除済み</span>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!balanced}
          onClick={() => onRun(draft)}
          title={balanced ? '' : '残り時間を 0 にしてください'}
        >
          この配分で1年を実行 ▶
        </button>
      </div>
    </section>
  )
}
