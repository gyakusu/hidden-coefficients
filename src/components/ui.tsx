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

// note は所要時間・制約など客観情報のみ。「信頼を稼ぐ」は配属で担当が変わるため、
// AllocationPanel 側でシナリオに応じて動的に付す（earnsTrust）。
export const ACTIVITIES: ActivityMeta[] = [
  { key: 'meeting', label: '会議', note: '2h/回・最低200回必須', accent: '#7c8aa5', icon: 'groups' },
  { key: 'docs', label: '資料作成', note: '任意時間', accent: '#6aa0c4', icon: 'description' },
  { key: 'visit', label: '現場訪問', note: '8h/回', accent: '#4db6a8', icon: 'engineering' },
  { key: 'va', label: 'VA提案', note: '4h/回', accent: '#e0a458', icon: 'lightbulb' },
  { key: 'report', label: '報告', note: '任意時間', accent: '#a78bc0', icon: 'campaign' },
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
 * ※ 隠れた係数・正解・応答の“形”は明かさない（配属で活動⇄形が入れ替わるため、
 *   特定の活動に形を紐づけると誤誘導になる）。客観的な所要時間／制約と、
 *   「観測して推定する」という遊び方の一般的助言に留める。
 */
const OBSERVE_TIP =
  '効き目（係数）は伏せられている。続けて試し、成果の変化から推し量ろう。同じ配分を続けた年と、大きく変えた年を見比べると、効き方の“クセ”が見えてくる。早合点は禁物——「効かない」のか、まだ前提が足りないだけなのか。'

export const ACTIVITY_TIP: Record<ActivityKey, string> = {
  meeting:
    '1回2時間。最低200回（400h）こなす義務があり、満たさないと1年を実行できない。まずノルマを確保しよう。' +
    OBSERVE_TIP,
  docs: '1時間単位で自由に投下できる。' + OBSERVE_TIP,
  visit: '1回8時間と重め。' + OBSERVE_TIP,
  va: '1回4時間。' + OBSERVE_TIP,
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
