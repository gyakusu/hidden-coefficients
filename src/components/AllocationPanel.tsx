import { useMemo, useState } from 'react'
import * as C from '../game/config'
import { meetingMinHours, totalAllocated } from '../game/engine'
import type { Allocation, ActivityKey, GameState } from '../game/types'
import { ACTIVITIES, ACTIVITY_TIP, Icon, InfoPopover } from './ui'

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
        <h2>
          <Icon name="schedule" size={18} />今年の時間配分
        </h2>
        <InfoPopover label="遊び方を見る" title="この画面の遊び方" symbol="help" anchor="parent">
          <p>毎年 <strong>2000時間</strong> を各活動に配分する。スライダーか「＋」で割り振り、
            <strong>残りを0</strong> にして［1年を実行］。</p>
          <p>会議には最低ノルマ（200回＝400h）がある。各活動の効き目（係数）は伏せられている——
            出た成果を観測して、何が効くのかを推定していこう。</p>
          <p>各活動の「i」で、その活動のヒントが見られる。</p>
        </InfoPopover>
        <div className={`alloc__remaining ${balanced ? 'is-ok' : 'is-warn'}`}>
          残り <strong>{remaining}</strong>h
          <span className="alloc__total">{total}/{C.TOTAL_HOURS}</span>
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
          const active = hours > 0
          return (
            <li key={m.key} className={`alloc__row ${active ? 'is-active' : ''}`}>
              <span className="alloc__icon" style={{ color: m.accent }}>
                <Icon name={m.icon} size={20} />
              </span>
              <div className="alloc__meta">
                <span className="alloc__name">{m.label}</span>
                <span className="alloc__note">{m.note}</span>
                <InfoPopover label={`${m.label}のヒント`} title={m.label} anchor="parent">
                  {ACTIVITY_TIP[m.key]}
                </InfoPopover>
              </div>
              <div className="alloc__value">
                <strong>{hours}</strong>h
                {count !== null && <span className="alloc__count">{count}回</span>}
              </div>
              <input
                type="range"
                className="alloc__slider"
                min={lockedMin}
                max={Math.max(sliderMax, lockedMin)}
                step={STEP}
                value={hours}
                onChange={(e) => set(m.key, Number(e.target.value))}
                style={{ accentColor: m.accent }}
                aria-label={`${m.label}の時間`}
              />
              <button
                type="button"
                className="alloc__fill-btn"
                disabled={remaining === 0}
                onClick={() => set(m.key, hours + remaining)}
                title="残り時間をすべてここに"
                aria-label={`残り時間を${m.label}に追加`}
              >
                <Icon name="add" size={18} />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="alloc__actions">
        <button type="button" className="btn btn--ghost btn--icon" onClick={reset} title="配分をリセット">
          <Icon name="restart_alt" size={18} />リセット
        </button>
        {petitionAvailable && (
          <>
            <button type="button" className="btn btn--petition btn--icon" onClick={onPetition}>
              <Icon name="gavel" size={18} />上申
            </button>
            <InfoPopover label="上申とは" title="上申" anchor="parent">
              条件を満たすと選べる特別な行動。会議の最低ノルマ（200回）の縛りを外し、
              その時間を別の活動に回せるようになる。一度行うと以後ずっと有効。
            </InfoPopover>
          </>
        )}
        {state.constraintsReleased && (
          <span className="alloc__released">
            <Icon name="lock_open" size={16} />制約解除済
          </span>
        )}
        <button
          type="button"
          className="btn btn--primary btn--icon"
          disabled={!balanced}
          onClick={() => onRun(draft)}
          title={balanced ? '' : '残り時間を 0 にしてください'}
        >
          1年を実行<Icon name="play_arrow" size={20} />
        </button>
      </div>
    </section>
  )
}
