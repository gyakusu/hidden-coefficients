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
          <li><span className="title__rule-k">期間</span>社会人1〜10年目（10ターン）。毎年 <b>2000時間</b> を配分する。</li>
          <li><span className="title__rule-k">勝敗</span>最終的な <b>累積部署成果</b> のみで決まる。</li>
          <li><span className="title__rule-k">沼</span>成果にはノイズが乗る。1年のデータは信用できない。</li>
          <li><span className="title__rule-k">鍵</span>何が効く<b>変数</b>で、何が効かない<b>定数</b>か——観測から見抜け。</li>
        </ul>

        <p className="title__hint">
          ヒント：効かないように見えるものは、本当に定数だろうか。
          それとも、<em>前提条件</em>がまだ満たされていないだけだろうか。
        </p>

        <button type="button" className="btn btn--primary btn--big" onClick={onStart}>
          1年目を始める ▶
        </button>
      </div>
    </div>
  )
}
