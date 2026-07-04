import { useState } from 'react'
import { Icon, InfoPopover } from './ui'

const RULES = [
  { icon: 'event', k: '期間', body: <>社会人1〜10年目（10ターン）。毎年 <b>2000時間</b> を配分する。</> },
  { icon: 'emoji_events', k: '勝敗', body: <>最終的な <b>累積部署成果</b> のみで決まる。</> },
  { icon: 'blur_on', k: '沼', body: <>成果にはノイズが乗る。1年のデータは信用できない。</> },
  { icon: 'badge', k: '配属', body: <>どの活動が効く<b>変数</b>かは<b>配属ごとに変わる</b>。前の部署の常識は通用しない。</> },
  { icon: 'key', k: '鍵', body: <>効く<b>変数</b>と効かない<b>定数</b>を——観測から見抜け。</> },
] as const

export type StartOpts = { seed?: string; fromPassphrase?: boolean }

export default function TitleScreen({ onStart }: { onStart: (opts?: StartOpts) => void }) {
  const [showCode, setShowCode] = useState(false)
  const [passphrase, setPassphrase] = useState('')

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

        <div className="title__help">
          <InfoPopover label="はじめての方へ・遊び方" title="はじめての方へ" symbol="help" anchor="parent">
            <ol>
              <li>ゲーム開始時に<strong>架空の部署へ配属</strong>される。配属で「効く活動」は変わる。</li>
              <li>毎年 <strong>2000時間</strong> を活動に配分して［実行］。</li>
              <li>出た<strong>成果</strong>と上司の<strong>コメント</strong>を観測する。</li>
              <li>結果には<strong>ノイズ</strong>が乗る。1年では分からない——同じ配分を続け、平均で見極める。</li>
              <li>何が効く<strong>変数</strong>で何が効かない<strong>定数</strong>か、10年かけて推定しよう。</li>
            </ol>
            <p>ゲーム中は各所の「i」「？」でいつでもヒントを確認できる。</p>
          </InfoPopover>
          <span className="title__help-label">はじめての方へ（遊び方）</span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--big btn--icon"
          onClick={() => onStart()}
        >
          配属されて始める<Icon name="play_arrow" size={22} />
        </button>

        <div className="title__code">
          <button
            type="button"
            className="title__code-toggle"
            aria-expanded={showCode}
            onClick={() => setShowCode((v) => !v)}
          >
            <Icon name={showCode ? 'expand_less' : 'expand_more'} size={16} />
            合言葉で配属を固定（研修・再現用）
          </button>
          {showCode && (
            <div className="title__code-body">
              <p className="title__code-note">
                同じ合言葉なら<strong>全員が同じ部署・同じ市況</strong>でプレイできる（研修の同期／結果の再現）。
                翌期は合言葉を変えるだけで「答えの伝承」を無効化できる。
              </p>
              <div className="title__code-row">
                <input
                  type="text"
                  className="title__code-input"
                  placeholder="例：2026年新人研修A班"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  aria-label="合言葉"
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  disabled={!passphrase.trim()}
                  onClick={() => onStart({ seed: passphrase.trim(), fromPassphrase: true })}
                >
                  <Icon name="vpn_key" size={18} />この合言葉で始める
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
