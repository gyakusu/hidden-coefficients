import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ActivityKey } from '../game/types'

/** アクティビティの表示メタ情報（係数は明かさない＝制約と所要時間のみ）。 */
export interface ActivityMeta {
  key: ActivityKey
  label: string
  /** 「1回あたり」「制約」などの客観情報のみ。役割のネタバレはしない。 */
  note: string
  /** 昇進後のみ解放。 */
  promotedOnly?: boolean
  accent: string
  /** Google Material Symbols のアイコン名。 */
  icon: string
}

export const ACTIVITIES: ActivityMeta[] = [
  { key: 'meeting', label: '会議', note: '2h/回・最低200回必須', accent: '#7c8aa5', icon: 'groups' },
  { key: 'docs', label: '資料作成', note: '任意時間', accent: '#6aa0c4', icon: 'description' },
  { key: 'visit', label: '現場訪問', note: '8h/回・信頼を稼ぐ', accent: '#4db6a8', icon: 'engineering' },
  { key: 'research', label: '競合調査', note: '8h/回・任意', accent: '#b0c26a', icon: 'travel_explore' },
  { key: 'va', label: 'VA提案', note: '4h/回', accent: '#e0a458', icon: 'lightbulb' },
  { key: 'report', label: '報告', note: '任意時間・信頼を稼ぐ', accent: '#a78bc0', icon: 'campaign' },
  {
    key: 'develop',
    label: '育成',
    note: '任意時間・翌年以降に効く',
    promotedOnly: true,
    accent: '#d2728f',
    icon: 'school',
  },
]

export const ACTIVITY_META: Record<ActivityKey, ActivityMeta> = ACTIVITIES.reduce(
  (acc, m) => {
    acc[m.key] = m
    return acc
  },
  {} as Record<ActivityKey, ActivityMeta>,
)

/**
 * 各アクティビティの「読みの指針」。
 * ※ 隠れた係数・正解は明かさない。客観的な所要時間／制約と、
 *   「観測して推定する」という遊び方の助言に留める。
 */
export const ACTIVITY_TIP: Record<ActivityKey, string> = {
  meeting:
    '1回2時間。最低200回（400h）こなす義務があり、満たさないと1年を実行できない。まずノルマを確保しよう。',
  docs: '1時間単位で自由に投下できる。効き目は伏せられている——続けて試し、成果の変化から推し量ろう。ただし「かければかけるほど」とは限らない。',
  visit: '1回8時間と重め。信頼ptを稼げる活動。成果にどう響くかは観測しながら見極めよう。',
  research:
    '1回8時間。市場や競合への理解を積み上げる活動。効き目は伏せられている——ある年に効いた手応えが、翌年も同じとは限らない。投下と成果の関係を観測しよう。',
  va: 'すぐ効くとは限らない一手。「効かない」のか、まだ前提条件が足りないだけなのか——早合点せず観測を続けよう。',
  report: '1時間単位で投下でき、信頼ptを効率よく稼げる。信頼は遅れて効いてくる。焦らず積もう。',
  develop: '今年の成果には表れない。翌年以降のすべての成果を底上げする、未来への投資。',
}

/** Google Material Symbols のアイコン。 */
export function Icon({
  name,
  className = '',
  fill = true,
  size,
  style,
}: {
  name: string
  className?: string
  fill?: boolean
  size?: number
  style?: CSSProperties
}) {
  return (
    <span
      className={`msym ${className}`}
      aria-hidden="true"
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size ?? 24}`,
        ...(size ? { fontSize: size } : null),
        ...style,
      }}
    >
      {name}
    </span>
  )
}

/**
 * タップで開閉する情報／ヒントのポップオーバー。「i」または「？」ボタン。
 * 初プレイの人がルールや読み方を確認できるよう、判断ポイントに散りばめて使う。
 *
 * anchor:
 *   - 'self'   …ボタンの直下に表示（align で左右寄せ）。
 *   - 'parent' …直近の position 指定済み祖先の幅いっぱいに表示（画面端でもはみ出さない）。
 */
export function InfoPopover({
  label,
  title,
  children,
  symbol = 'info',
  align = 'start',
  anchor = 'self',
}: {
  label: string
  title?: string
  children: ReactNode
  symbol?: 'info' | 'help'
  align?: 'start' | 'end' | 'center'
  anchor?: 'self' | 'parent'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const popClass = anchor === 'parent' ? 'info__pop info__pop--stretch' : `info__pop info__pop--${align}`

  return (
    <span className={`info ${anchor === 'parent' ? 'info--static' : ''}`} ref={ref}>
      <button
        type="button"
        className={`info__btn ${open ? 'is-open' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={symbol === 'help' ? 'help' : 'info'} size={14} fill={false} />
      </button>
      {open && (
        <span className={popClass} id={popId} role="note">
          {title && <span className="info__pop-title">{title}</span>}
          <span className="info__pop-body">{children}</span>
        </span>
      )}
    </span>
  )
}

export function Meter({
  value,
  max = 1,
  label,
  detail,
  color,
  icon,
  info,
  infoTitle,
}: {
  value: number
  max?: number
  label: string
  detail?: string
  color: string
  icon?: string
  /** ある場合、ラベル横に「i」ボタンを出して説明を表示する。 */
  info?: ReactNode
  infoTitle?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">
          {icon && <Icon name={icon} className="meter__icon" size={16} />}
          {label}
          {info && (
            <InfoPopover label={`${label}について`} title={infoTitle ?? label} anchor="parent">
              {info}
            </InfoPopover>
          )}
        </span>
        {detail && <span className="meter__detail">{detail}</span>}
      </div>
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
