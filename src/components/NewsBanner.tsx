// ============================================================================
//  市況ニュース（設計書 §3.3）。年初に「方向だけ」を開示する。
//  大きさ（市況係数の値）は伏せる——「今年の好成績はどこまで自分か？」を問うため。
// ============================================================================

import { marketInfo } from '../game/hints'
import type { MarketNews } from '../game/engine'
import { Icon, InfoPopover } from './ui'

const NEWS_META: Record<MarketNews, { icon: string; label: string; tone: string }> = {
  up: { icon: 'trending_up', label: '追い風', tone: 'up' },
  down: { icon: 'trending_down', label: '向かい風', tone: 'down' },
  flat: { icon: 'trending_flat', label: '平年並み', tone: 'flat' },
}

export default function NewsBanner({ market, year }: { market: number; year: number }) {
  const { news, headline } = marketInfo(market, year)
  const meta = NEWS_META[news]

  return (
    <section className={`news news--${meta.tone}`}>
      <span className="news__icon">
        <Icon name={meta.icon} size={20} />
      </span>
      <div className="news__body">
        <span className="news__head">
          <span className="news__tag">市況</span>
          <span className="news__label">{meta.label}</span>
          <InfoPopover label="市況ニュースとは" title="市況（マクロ環境）" anchor="parent">
            <p>年初に流れる<strong>景気の方向</strong>。あなたの行動とは無関係に、その年の成果に
              倍率として掛かる<strong>外生の係数</strong>だ。</p>
            <p>信頼を積んでもこのブレは<strong>縮まない</strong>。分かるのは向きだけ——大きさは伏せてある。
              「今年の数字は、どこまで自分の実力か？」を頭の片隅に置いておこう。</p>
          </InfoPopover>
        </span>
        <p className="news__text">{headline}</p>
      </div>
    </section>
  )
}
