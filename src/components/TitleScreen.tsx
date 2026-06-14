import { Icon } from './ui'

const RULES = [
  { icon: 'event', k: '期間', body: <>社会人1〜10年目（10ターン）。毎年 <b>2000時間</b> を配分する。</> },
  { icon: 'emoji_events', k: '勝敗', body: <>最終的な <b>累積部署成果</b> のみで決まる。</> },
  { icon: 'blur_on', k: '沼', body: <>成果にはノイズが乗る。1年のデータは信用できない。</> },
  { icon: 'key', k: '鍵', body: <>何が効く<b>変数</b>で、何が効かない<b>定数</b>か——観測から見抜け。</> },
] as const

export default function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="title">
      <div className="title__inner">
        <p className="title__eyebrow">SYSTEM IDENTIFICATION SIMULATOR</p>
        <h1 className="title__h1">変数を見極めろ</h1>
        <p className="title__lead">
          仕事の成果は、見えない関数で決まっている。<br />
          あなたに見えるのは <b>入力（時間配分）</b> と <b>出力（成果）</b> だけ。<br />
          その間にある<strong>係数</strong>は、誰も教えてくれない。
        </p>

        <ul className="title__rules">
          {RULES.map((r) => (
            <li key={r.k}>
              <Icon name={r.icon} className="title__rule-icon" size={22} />
              <span><span className="title__rule-k">{r.k}</span>{r.body}</span>
            </li>
          ))}
        </ul>

        <p className="title__hint">
          <Icon name="lightbulb" size={18} />
          <span>
            効かないように見えるものは、本当に定数だろうか。
            それとも、<em>前提条件</em>がまだ満たされていないだけだろうか。
          </span>
        </p>

        <button type="button" className="btn btn--primary btn--big btn--icon" onClick={onStart}>
          1年目を始める<Icon name="play_arrow" size={22} />
        </button>
      </div>
    </div>
  )
}
