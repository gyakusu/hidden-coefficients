import * as C from '../game/config'
import { trustNorm } from '../game/engine'
import type { GameState } from '../game/types'
import HistoryChart from './HistoryChart'

function gradeFor(score: number) {
  return C.GRADES.find((g) => score >= g.min) ?? C.GRADES[C.GRADES.length - 1]
}

function analyze(state: GameState) {
  const h = state.history
  const gateStart = h.find((r) => r.vaGate > 0)?.year ?? null
  const gateFull = h.find((r) => r.vaGate >= 1)?.year ?? null
  const trapYears = h.filter((r) => r.allocation.va >= 300 && r.vaGate < 0.2).map((r) => r.year)
  const best = h.reduce((a, b) => (b.finalOutcome > a.finalOutcome ? b : a), h[0])
  return {
    gateStart,
    gateFull,
    trapYears,
    bestYear: best?.year ?? null,
    bestOutcome: best?.finalOutcome ?? 0,
    finalTrust: trustNorm(state.trust),
    finalAwareness: state.awareness,
  }
}

export default function EndScreen({
  state,
  onReplay,
  onTitle,
}: {
  state: GameState
  onReplay: () => void
  onTitle: () => void
}) {
  const score = state.cumulativeOutcome
  const grade = gradeFor(score)
  const a = analyze(state)

  return (
    <div className="end">
      <div className="end__inner">
        <p className="end__phase">10年目・説明フェーズ</p>
        <h1 className="end__h1">10年間の同定、完了。</h1>

        <div className={`end__scorecard rank-${grade.rank}`}>
          <div className="end__rank">{grade.rank}</div>
          <div className="end__score-block">
            <div className="end__score-num">{score.toFixed(1)}</div>
            <div className="end__score-label">累積部署成果</div>
          </div>
          <div className="end__grade-text">
            <strong>{grade.title}</strong>
            <p>{grade.comment}</p>
          </div>
        </div>

        <HistoryChart history={state.history} />

        <section className="end__section card">
          <h2>あなたのプレイ分析</h2>
          <ul className="end__analysis">
            <li>
              VA提案のゲートが開き始めたのは
              {a.gateStart ? <strong> {a.gateStart}年目</strong> : <strong> ついぞ開かなかった</strong>}
              {a.gateFull && <>、全開になったのは <strong>{a.gateFull}年目</strong></>}。
            </li>
            {a.trapYears.length > 0 ? (
              <li className="is-warn">
                <strong>{a.trapYears.join('・')}年目</strong>は、信頼が足りないままVA提案に注力していた——
                ゲートが閉じており、その時間の多くは成果にならなかった（罠）。
              </li>
            ) : (
              <li className="is-ok">信頼が低いままVA提案に賭ける「罠」は、うまく避けられていた。</li>
            )}
            <li>
              最高の年は <strong>{a.bestYear}年目</strong>（成果 {a.bestOutcome.toFixed(1)}）。
              最終的な信頼は <strong>{(a.finalTrust * 100).toFixed(0)}%</strong>
              {state.promoted && <>、チーム意識は <strong>×{a.finalAwareness.toFixed(2)}</strong></>}。
            </li>
          </ul>
        </section>

        <section className="end__section card">
          <h2>種明かし：隠されていた構造</h2>
          <p className="end__reveal-lead">
            あなたが観測していた「成果」は、次の関数にノイズを掛けたものだった。
          </p>
          <table className="end__table">
            <thead>
              <tr>
                <th>要素</th>
                <th>真の係数（/h）</th>
                <th>分類</th>
                <th>何が起きていたか</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>会議</td>
                <td>{C.COEF.meetingBase}〜{(C.COEF.meetingBase + C.COEF.meetingDocsBoost).toFixed(3)}</td>
                <td>ほぼ定数（ダミー）</td>
                <td>最低200回の縛りで埋めるだけ。資料作成で「多少」上がるが、誤差。</td>
              </tr>
              <tr>
                <td>資料作成</td>
                <td>{C.COEF.docs}</td>
                <td>弱い変数</td>
                <td>単体は小。会議への弱い交差項で「効いた気」にさせる罠。</td>
              </tr>
              <tr>
                <td>現場訪問</td>
                <td>{C.COEF.visit}</td>
                <td>中程度の変数</td>
                <td>成果も信頼も稼ぐ優等生。序盤の安定札。</td>
              </tr>
              <tr className="is-key">
                <td>VA提案</td>
                <td>{C.COEF.va}（ゲート開）／ 0（ゲート閉）</td>
                <td>真の主力変数</td>
                <td>信頼が閾値（正規化 {C.VA_GATE_START}〜{C.VA_GATE_FULL}）を越えて初めて立ち上がる。</td>
              </tr>
              <tr>
                <td>報告</td>
                <td>{C.COEF.report}</td>
                <td>定数（直接成果ゼロ）</td>
                <td>だが信頼ptの最大の源泉。「効かない」のに最重要だった。</td>
              </tr>
              <tr>
                <td>部署の力（人数/意識）</td>
                <td>×{C.AWARENESS_BASE} → 最大 ×{C.AWARENESS_MAX}</td>
                <td>定数 → 変数（昇進）</td>
                <td>昇進までは固定。育成で初めて動かせる「隠れ倍率」に。</td>
              </tr>
            </tbody>
          </table>
          <ul className="end__notes">
            <li>
              <strong>信頼ptの三役：</strong>
              ①VA係数のゲートを開く ②観測ノイズを縮める（±{C.NOISE_MAX * 100}% → ±{C.NOISE_MIN * 100}%）
              ③上申で会議制約を外す。
            </li>
            <li>
              <strong>ノイズ：</strong>毎年 0.8〜1.2 のランダム係数。1年のデータは当てにならない。
              信頼が高いほど振れ幅が縮み、係数が「見える」ようになっていた。
            </li>
          </ul>
        </section>

        <section className="end__section end__theme">
          <p>
            効くと思ったら効かない。効かないと思ったら、前提次第で効く。
            周囲との関係そのものが、成果を左右する<strong>隠れた変数</strong>だった。
          </p>
          <p className="end__theme-quote">「それまで定数だった社員一人一人の意識が、大きな変数となった。」</p>
        </section>

        <div className="end__actions">
          <button type="button" className="btn btn--primary btn--big" onClick={onReplay}>
            もう一度プレイ ▶
          </button>
          <button type="button" className="btn btn--ghost" onClick={onTitle}>
            タイトルへ
          </button>
        </div>
      </div>
    </div>
  )
}
