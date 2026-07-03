import type { ReactNode } from 'react'
import * as C from '../game/config'
import { counterfactualScore, knowledgeStock, skillScore, trustNorm } from '../game/engine'
import type { GameState, Hypothesis } from '../game/types'
import HistoryChart from './HistoryChart'
import { ACTIVITY_META, Icon } from './ui'

function gradeFor(score: number) {
  return C.GRADES.find((g) => score >= g.min) ?? C.GRADES[C.GRADES.length - 1]
}

function analyze(state: GameState) {
  const h = state.history
  const gateStart = h.find((r) => r.vaGate > 0)?.year ?? null
  const gateFull = h.find((r) => r.vaGate >= 1)?.year ?? null
  const trapYears = h.filter((r) => r.allocation.va >= 300 && r.vaGate < 0.2).map((r) => r.year)
  const best = h.reduce((a, b) => (b.finalOutcome > a.finalOutcome ? b : a), h[0])
  const researchYears = h.filter((r) => r.allocation.research > 0)
  return {
    gateStart,
    gateFull,
    trapYears,
    bestYear: best?.year ?? null,
    bestOutcome: best?.finalOutcome ?? 0,
    finalTrust: trustNorm(state.trust),
    finalAwareness: state.awareness,
    researchYearCount: researchYears.length,
    researchFinalStock: knowledgeStock(state.researchCumHours),
  }
}

/** 仮説の答え合わせ：ゲームの真の主力は VA提案。現場訪問・競合調査は二番手。 */
function hypoVerdict(h: Hypothesis | null): { mark: string; cls: string; note: string } {
  if (h == null || h === 'unknown') return { mark: '—', cls: 'is-hold', note: '保留' }
  if (h === 'va') return { mark: '✓', cls: 'is-right', note: '正解' }
  if (h === 'visit' || h === 'research') return { mark: '△', cls: 'is-near', note: '二番手' }
  return { mark: '✗', cls: 'is-wrong', note: '' }
}

/** 種明かしテーブルの 1 行。アイコンは ACTIVITY_META か個別指定。 */
function RevealName({ icon, color, children }: { icon: string; color: string; children: ReactNode }) {
  return (
    <span className="end__table-name">
      <Icon name={icon} size={18} style={{ color }} />
      {children}
    </span>
  )
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
  const rawScore = state.cumulativeOutcome
  const skill = skillScore(state.history)
  const grade = gradeFor(skill) // ランクは実力点（市況調整後）で判定する
  const counterfactual = counterfactualScore(state.history)
  const a = analyze(state)
  const m = ACTIVITY_META

  // 素点と実力点の乖離（＝運・市況がどれだけ結果を動かしたか）。
  const rel = skill > 0 ? (rawScore - skill) / skill : 0
  const divergence = rel > 0.08 ? 'tailwind' : rel < -0.08 ? 'headwind' : 'even'
  const tuition = skill - counterfactual // 探索の授業料（最終配分を貫いた場合との差）

  return (
    <div className="end">
      <div className="end__inner">
        <p className="end__phase">
          <Icon name="menu_book" size={16} />10年目・説明フェーズ
        </p>
        <h1 className="end__h1">10年間の同定、完了。</h1>

        <div className={`end__scorecard rank-${grade.rank}`}>
          <div className="end__rank">{grade.rank}</div>
          <div className="end__score-block">
            <div className="end__score-num">{skill.toFixed(1)}</div>
            <div className="end__score-label">実力点（市況調整後）</div>
            <div className="end__score-sub">
              素点 <strong>{rawScore.toFixed(1)}</strong>（世間の評価・運と市況込み）
            </div>
          </div>
          <div className="end__grade-text">
            <strong>{grade.title}</strong>
            <p>{grade.comment}</p>
          </div>
        </div>

        {divergence !== 'even' && (
          <div className={`end__divergence is-${divergence}`}>
            <Icon name={divergence === 'tailwind' ? 'air' : 'cloudy'} size={18} />
            {divergence === 'tailwind' ? (
              <p>
                <strong>追い風の10年だった。</strong>
                素点は実力点を上回っている。この数字のすべてが、あなたの実力ではない。
              </p>
            ) : (
              <p>
                <strong>向かい風の10年だった。</strong>
                素点は実力点を下回っている。この数字の低さは、あなたのせいではない——やるべきことは、やれていた。
              </p>
            )}
          </div>
        )}

        <HistoryChart history={state.history} />

        <section className="end__section card">
          <h2><Icon name="quiz" size={18} />仮説の収束：あなたの推定の物語</h2>
          <p className="end__reveal-lead">
            毎年の年度末に宣言した「最も効くと思う活動」を、真実と並べる。何年目に核心へたどり着いたか——
            これは点数ではなく、あなたの<strong>推定が収束していく過程</strong>の記録だ。
          </p>
          <ul className="end__hypo">
            {state.history.map((r) => {
              const v = hypoVerdict(r.hypothesis)
              const label =
                r.hypothesis == null || r.hypothesis === 'unknown'
                  ? 'まだ分からない'
                  : ACTIVITY_META[r.hypothesis].label
              return (
                <li key={r.year} className="end__hypo-row">
                  <span className="end__hypo-year">{r.year}年目</span>
                  <span className="end__hypo-guess">{label}</span>
                  <span className={`end__hypo-mark ${v.cls}`}>{v.mark}{v.note && <em>{v.note}</em>}</span>
                </li>
              )
            })}
          </ul>
          <p className="end__hypo-foot">
            真の主力は <strong>VA提案</strong>（前提が整えば）。現場訪問・競合調査は頼れる二番手だった。
          </p>
        </section>

        <section className="end__section card">
          <h2><Icon name="insights" size={18} />あなたのプレイ分析</h2>
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
            {a.researchYearCount > 0 && (
              <li className={a.researchYearCount >= 3 ? 'is-warn' : 'is-ok'}>
                競合調査は <strong>{a.researchYearCount}年</strong>使い、知識ストックは
                <strong> {(a.researchFinalStock * 100).toFixed(0)}%</strong> まで埋まった。
                {a.researchYearCount >= 3
                  ? '——初回は大きく効くが、埋まった後の追加投入はほぼ成果にならない（逓減の罠）。'
                  : '初回に大きく効く一手を、うまく序盤で回収できていた。'}
              </li>
            )}
            <li>
              最高の年は <strong>{a.bestYear}年目</strong>（成果 {a.bestOutcome.toFixed(1)}）。
              最終的な信頼は <strong>{(a.finalTrust * 100).toFixed(0)}%</strong>
              {state.promoted && <>、チーム意識は <strong>×{a.finalAwareness.toFixed(2)}</strong></>}。
            </li>
            <li>
              <strong>反実仮想：</strong>
              もし最終年の配分を1年目から貫いていたら（市況・運は同じ系列で）、実力点は約
              <strong> {counterfactual.toFixed(1)}</strong> だった。
              {tuition > 5 ? (
                <>——実際との差 <strong>{tuition.toFixed(1)}</strong> が、正解を探し当てるまでに払った「授業料」だ。</>
              ) : tuition < -5 ? (
                <>——実際の方が高い。年ごとに配分を練り上げた判断が、単純な貫き通しを上回った。</>
              ) : (
                <>——実際とほぼ同じ。早い段階で最適な配分に到達できていた。</>
              )}
            </li>
          </ul>
        </section>

        <section className="end__section card">
          <h2><Icon name="lock_open" size={18} />種明かし：隠されていた構造</h2>
          <p className="end__reveal-lead">
            あなたが観測していた「成果」は、次の関数に<strong>運（ノイズ）</strong>と<strong>市況</strong>を掛けたものだった。
          </p>
          <table className="end__table">
            <thead>
              <tr>
                <th>要素</th>
                <th>真の係数</th>
                <th>分類</th>
                <th>何が起きていたか</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><RevealName icon={m.meeting.icon} color={m.meeting.accent}>会議</RevealName></td>
                <td>{C.COEF.meetingBase}〜{(C.COEF.meetingBase + C.COEF.meetingDocsBoost).toFixed(3)}/h</td>
                <td>ほぼ定数（ダミー）</td>
                <td>最低200回の縛りで埋めるだけ。資料作成で「多少」上がるが、誤差。</td>
              </tr>
              <tr>
                <td><RevealName icon={m.docs.icon} color={m.docs.accent}>資料作成</RevealName></td>
                <td>0 → {C.DOCS_VALUE_MAX}（凹・飽和）</td>
                <td>弱い変数（逓減）</td>
                <td>最初の1時間で大半が出て、作り込むほど逓減（τ={C.DOCS_TAU}h）。かけすぎは悪手。</td>
              </tr>
              <tr>
                <td><RevealName icon={m.visit.icon} color={m.visit.accent}>現場訪問</RevealName></td>
                <td>{C.COEF.visit}/h</td>
                <td>中程度の変数</td>
                <td>成果も信頼も稼ぐ優等生。序盤の安定札。</td>
              </tr>
              <tr>
                <td><RevealName icon={m.research.icon} color={m.research.accent}>競合調査</RevealName></td>
                <td>最大 {C.RESEARCH_COEF_MAX}×ΔK（τ={C.RESEARCH_TAU}h）</td>
                <td>非定常（累積飽和）</td>
                <td>累積で知識ストック K を積み、その年の<strong>差分だけ</strong>が成果に。初回は大きく効き、2回目以降はほぼゼロ。</td>
              </tr>
              <tr className="is-key">
                <td><RevealName icon={m.va.icon} color={m.va.accent}>VA提案</RevealName></td>
                <td>{C.COEF.va}/h（開）／ 0（閉）</td>
                <td>真の主力変数</td>
                <td>信頼が閾値（正規化 {C.VA_GATE_START}〜{C.VA_GATE_FULL}）を越えて初めて立ち上がる。</td>
              </tr>
              <tr>
                <td><RevealName icon={m.report.icon} color={m.report.accent}>報告</RevealName></td>
                <td>{C.COEF.report}/h</td>
                <td>定数（直接成果ゼロ）</td>
                <td>だが信頼ptの最大の源泉。「効かない」のに最重要だった。</td>
              </tr>
              <tr>
                <td><RevealName icon="diversity_3" color={m.develop.accent}>部署の力</RevealName></td>
                <td>×{C.AWARENESS_BASE} → 最大 ×{C.AWARENESS_MAX}</td>
                <td>定数 → 変数（昇進）</td>
                <td>昇進までは固定。育成で初めて動かせる「隠れ倍率」に。</td>
              </tr>
              <tr className="is-macro">
                <td><RevealName icon="public" color="#8fb4d9">市況</RevealName></td>
                <td>×{(1 - C.MACRO_RANGE).toFixed(2)} 〜 ×{(1 + C.MACRO_RANGE).toFixed(2)}</td>
                <td>外生（縮まない）</td>
                <td>行動と無関係にその年の成果へ掛かる倍率。信頼でも縮まない。ランクは市況を割り戻した実力点で判定。</td>
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
              <strong>2種類の不確実性：</strong>
              <em>運（ノイズ）</em>は信頼を積めば縮められる。<em>市況</em>は何をしても縮まない。
              制御できる不確実性は制御し、できないものは「できない」と知る——それが評価の二軸化の意味だ。
            </li>
          </ul>
        </section>

        <section className="end__section end__theme card">
          <p>
            効くと思ったら効かない。効かないと思ったら、前提次第で効く。
            <strong>変数だと思っていたものが、もう定数になっていることもある。そして、どうやっても変数にできないものもある。</strong>
          </p>
          <p className="end__theme-quote">「それまで定数だった社員一人一人の意識が、大きな変数となった。」</p>
        </section>

        <div className="end__actions">
          <button type="button" className="btn btn--primary btn--big btn--icon" onClick={onReplay}>
            <Icon name="replay" size={22} />もう一度プレイ
          </button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onTitle}>
            <Icon name="home" size={20} />タイトルへ
          </button>
        </div>
      </div>
    </div>
  )
}
