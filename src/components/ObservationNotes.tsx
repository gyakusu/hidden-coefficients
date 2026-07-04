// ============================================================================
//  観測メモ（フィールドノート）。
//  行動選択中（時間配分の画面）に、状況把握を助ける情報をページ末尾に出す。
//  ※ 隠れた係数・正解そのものは明かさない。既出のヒントの再掲と、
//    客観的なルール／ノイズの読み方など「考える材料」に留める。
// ============================================================================

import * as C from '../game/config'
import { canPetition, noiseWidth, trustNorm, trustTier } from '../game/engine'
import { generateFeedback } from '../game/hints'
import type { GameState } from '../game/types'
import { Icon, InfoPopover } from './ui'

interface Guide {
  icon: string
  text: string
}

/** 現在の状態から、ネタバレにならない「読みの指針」を組み立てる。 */
function readingGuides(state: GameState): Guide[] {
  const tn = trustNorm(state.trust)
  const tier = trustTier(tn)
  const noisePct = Math.round(noiseWidth(tn) * 100)
  const guides: Guide[] = []

  // 初年度はチャートも前回ヒントも無いので、まず配属と方針を一言。
  if (state.history.length === 0) {
    guides.push({
      icon: 'badge',
      text: `${state.scenario.dept.name}に配属された。${state.scenario.dept.flavor} 部署が違えば「効く活動」も違う——前の常識は、ここでは当てにならない。`,
    })
    guides.push({
      icon: 'flag',
      text: 'まだ観測データが1点もない。初年度はどこに賭けても“正解”は見えない——まず1年動かして反応を見よう。',
    })
  }

  // ノイズの大きさ＝今の数字をどこまで信じてよいか（信頼ptで縮む）。
  guides.push({
    icon: 'blur_on',
    text:
      tier === 'low'
        ? `いまは数字のブレが大きい（±${noisePct}%）。1年の結果だけで「効く／効かない」を決めつけない方がいい。`
        : tier === 'mid'
          ? `ブレが少し収まってきた（±${noisePct}%）。傾向が読み取りやすくなりつつある。`
          : `ブレが小さい（±${noisePct}%）。いまの数字はかなり信用できる。`,
  })

  // 観測の基本：繰り返して平均を取るとノイズが薄まる（が、年は有限）。
  guides.push({
    icon: 'repeat',
    text: '同じ配分を続けて平均を取れば、ノイズに隠れた“本当の効き”が見えてくる。ただし使える年は有限だ。',
  })

  // 市況：向きは分かるが大きさは伏せられ、信頼でも縮まない外生要因。
  guides.push({
    icon: 'public',
    text: '成果には今年の市況（環境）も掛かっている。向きはニュースで分かるが、大きさは読めない——信頼を積んでもこのブレは縮まない。',
  })

  // 会議制約のリマインド（解除済みかどうかで出し分け）。
  if (state.constraintsReleased) {
    guides.push({ icon: 'lock_open', text: '上申により、会議の最低回数の縛りは外れている。' })
  } else {
    guides.push({
      icon: 'gavel',
      text: `会議は最低${C.MEETING_MIN_COUNT}回（${C.MEETING_MIN_HOURS}h）が必須。${
        canPetition(state) ? 'いまなら『上申』でこの縛りを外せそうだ。' : ''
      }`,
    })
  }

  // 昇進後のみ：育成は遅延報酬であることを忘れないように。
  if (state.promoted) {
    guides.push({
      icon: 'school',
      text: '育成は今年の成果には表れない。効いてくるのは翌年以降だ。',
    })
  }

  return guides
}

export default function ObservationNotes({ state }: { state: GameState }) {
  // 直近年のヒント（レビュー画面で一度見せた定性シグナル）を再掲する。
  const last = state.history.at(-1)
  const lastFb = last ? generateFeedback(last, state.scenario) : null
  const guides = readingGuides(state)

  return (
    <section className="notes card">
      <div className="notes__head">
        <h2>
          <Icon name="sticky_note_2" size={18} />観測メモ
        </h2>
        <InfoPopover label="観測メモとは" title="観測メモとは" anchor="parent">
          ネタバレなしの「考える材料」。前回の手応えの再掲と、いまの数字をどこまで信じてよいか
          （ノイズの目安）をまとめている。迷ったらここを見直そう。
        </InfoPopover>
      </div>

      {last && lastFb && (
        <div className={`notes__recall tone-${lastFb.tone}`}>
          <div className="notes__recall-head">
            <span className="notes__recall-label">前回（{last.year}年目）の手応え</span>
            <span className="notes__recall-outcome">成果 {last.finalOutcome.toFixed(1)}</span>
          </div>
          <p className="notes__recall-signal">{lastFb.signal}</p>
          <p className="notes__recall-dialogue">{lastFb.dialogue}</p>
        </div>
      )}

      <ul className="notes__guides">
        {guides.map((g, i) => (
          <li key={i}>
            <Icon name={g.icon} size={16} className="notes__guide-icon" />
            <span>{g.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
