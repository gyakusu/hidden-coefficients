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
}

export const ACTIVITIES: ActivityMeta[] = [
  { key: 'meeting', label: '会議', note: '2h/回・最低200回（=400h）必須', accent: '#7c8aa5' },
  { key: 'docs', label: '資料作成', note: '任意時間', accent: '#6aa0c4' },
  { key: 'visit', label: '現場訪問', note: '8h/回・信頼ptを稼ぐ', accent: '#4db6a8' },
  { key: 'va', label: 'VA提案', note: '4h/回', accent: '#e0a458' },
  { key: 'report', label: '報告', note: '任意時間・信頼ptを稼ぐ', accent: '#a78bc0' },
  {
    key: 'develop',
    label: '育成',
    note: '任意時間・昇進後に解放',
    promotedOnly: true,
    accent: '#d2728f',
  },
]

export const ACTIVITY_META: Record<ActivityKey, ActivityMeta> = ACTIVITIES.reduce(
  (acc, m) => {
    acc[m.key] = m
    return acc
  },
  {} as Record<ActivityKey, ActivityMeta>,
)

export function Meter({
  value,
  max = 1,
  label,
  detail,
  color,
}: {
  value: number
  max?: number
  label: string
  detail?: string
  color: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter">
      <div className="meter__head">
        <span className="meter__label">{label}</span>
        {detail && <span className="meter__detail">{detail}</span>}
      </div>
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
