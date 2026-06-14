import { trustNorm } from '../game/engine'
import type { YearRecord } from '../game/types'

const W = 520
const H = 180
const PAD = { top: 16, right: 16, bottom: 28, left: 32 }

export default function HistoryChart({ history }: { history: YearRecord[] }) {
  if (history.length === 0) {
    return (
      <section className="chart card">
        <h2>これまでの推移</h2>
        <p className="chart__empty">まだデータがありません。1年目を実行すると、ここに推移が表示されます。</p>
      </section>
    )
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const maxOutcome = Math.max(10, ...history.map((h) => h.finalOutcome))
  const n = history.length
  const slot = innerW / Math.max(n, 1)
  const barW = Math.min(28, slot * 0.6)

  const x = (i: number) => PAD.left + slot * i + slot / 2
  const yOutcome = (v: number) => PAD.top + innerH - (v / maxOutcome) * innerH
  const yTrust = (tn: number) => PAD.top + innerH - tn * innerH

  const trustPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yTrust(trustNorm(h.trustAfter)).toFixed(1)}`)
    .join(' ')

  return (
    <section className="chart card">
      <div className="chart__head">
        <h2>これまでの推移</h2>
        <div className="chart__legend">
          <span className="chart__legend-item"><i className="swatch swatch--bar" />年間成果</span>
          <span className="chart__legend-item"><i className="swatch swatch--line" />信頼</span>
        </div>
      </div>
      <svg className="chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="年間成果と信頼の推移">
        {/* baseline */}
        <line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH} className="chart__axis" />
        {history.map((h, i) => {
          const bh = (h.finalOutcome / maxOutcome) * innerH
          return (
            <g key={i}>
              <rect
                className="chart__bar"
                x={x(i) - barW / 2}
                y={yOutcome(h.finalOutcome)}
                width={barW}
                height={Math.max(0, bh)}
                rx={2}
              />
              <text className="chart__xlabel" x={x(i)} y={H - 8} textAnchor="middle">
                {h.year}
              </text>
            </g>
          )
        })}
        {/* trust line */}
        <path className="chart__line" d={trustPath} fill="none" />
        {history.map((h, i) => (
          <circle key={i} className="chart__dot" cx={x(i)} cy={yTrust(trustNorm(h.trustAfter))} r={3} />
        ))}
      </svg>
    </section>
  )
}
