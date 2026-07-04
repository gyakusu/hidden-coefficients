import type { ReactNode } from 'react'
import * as C from '../game/config'
import { counterfactualScore, knowledgeStock, skillScore, trustNorm } from '../game/engine'
import type { Scenario } from '../game/scenario'
import type { Durability, GameState, Hypothesis } from '../game/types'
import HistoryChart from './HistoryChart'
import { ACTIVITY_META, Icon } from './ui'

function gradeFor(score: number) {
  return C.GRADES.find((g) => score >= g.min) ?? C.GRADES[C.GRADES.length - 1]
}

function analyze(state: GameState, scenario: Scenario) {
  const h = state.history
  const gatedA = scenario.activityOf.gated
  const cumA = scenario.activityOf.cumulative
  const cumTau = scenario.params.cumulative.tau
  const infoTier2 = scenario.params.cumulative.infoTier2
  const gateStart = h.find((r) => r.vaGate > 0)?.year ?? null
  const gateFull = h.find((r) => r.vaGate >= 1)?.year ?? null
  const trapYears = h.filter((r) => r.allocation[gatedA] >= 300 && r.vaGate < 0.2).map((r) => r.year)
  const best = h.reduce((a, b) => (b.finalOutcome > a.finalOutcome ? b : a), h[0])
  const visitYears = h.filter((r) => r.allocation[cumA] > 0)
  // 知識ストックが飽和（年初 ≥ TIER2）した後もなお累積活動へ多く割いた年＝成果面はほぼ空振り。
  const visitSaturatedWaste = h
    .filter((r) => r.knowledgeAtStart >= infoTier2 && r.allocation[cumA] >= 400)
    .map((r) => r.year)
  return {
    gateStart,
    gateFull,
    trapYears,
    bestYear: best?.year ?? null,
    bestOutcome: best?.finalOutcome ?? 0,
    finalTrust: trustNorm(state.trust),
    finalAwareness: state.awareness,
    visitYearCount: visitYears.length,
    visitFinalStock: knowledgeStock(state.cumHours, cumTau),
    visitSaturatedWaste,
  }
}

/** 仮説①（which）の答え合わせ：真の主力は「ゲート付き」を担う活動、累積活動は頼れる二番手。 */
function hypoVerdict(h: Hypothesis | null, scenario: Scenario): { mark: string; cls: string; note: string } {
  if (h == null || h === 'unknown') return { mark: '—', cls: 'is-hold', note: '保留' }
  if (h === scenario.activityOf.gated) return { mark: '✓', cls: 'is-right', note: '正解' }
  if (h === scenario.activityOf.cumulative) return { mark: '△', cls: 'is-near', note: '二番手' }
  return { mark: '✗', cls: 'is-wrong', note: '' }
}

/** 各活動の「来年も同じだけ効くか」の真実。累積活動だけが年をまたいで飽和＝弱まる。 */
function durabilityTruth(h: Hypothesis | null, scenario: Scenario): Durability | null {
  if (h == null || h === 'unknown') return null
  return h === scenario.activityOf.cumulative ? 'weaken' : 'steady'
}

const DUR_LABEL: Record<Durability, string> = {
  steady: '来年も効く',
  weaken: '弱まる',
  unknown: '分からない',
}

/** 仮説②（how）の答え合わせ。①で選んだ活動の真の非定常性に照らして判定する。 */
function durVerdict(
  h: Hypothesis | null,
  d: Durability | null,
  scenario: Scenario,
): { mark: string; cls: string; label: string } {
  const label = d ? DUR_LABEL[d] : '—'
  const truth = durabilityTruth(h, scenario)
  if (d == null || d === 'unknown' || truth == null) return { mark: '', cls: 'is-hold', label }
  return d === truth ? { mark: '✓', cls: 'is-right', label } : { mark: '✗', cls: 'is-wrong', label }
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

/** 成果側4活動（会議・資料作成・現場訪問・VA提案）の、この配属での真の姿を組み立てる。 */
function outcomeReveal(
  scenario: Scenario,
  key: 'meeting' | 'docs' | 'visit' | 'va',
): { coef: ReactNode; klass: string; desc: ReactNode; highlight?: string } {
  const role = scenario.roleOf[key]
  const p = scenario.params
  const dummyLabel = ACTIVITY_META[scenario.activityOf.dummy].label
  const concaveLabel = ACTIVITY_META[scenario.activityOf.concave].label
  // 会議は役割に関わらず「最低200回の出席義務」が絡む（固定制約）。
  const meetingNote = key === 'meeting' ? '（会議は最低200回の出席義務つき。）' : ''

  switch (role) {
    case 'gated':
      return {
        coef: `${p.gated.coef.toFixed(3)}/h（開）／ 0（閉）`,
        klass: '真の主力変数',
        highlight: 'is-key',
        desc: (
          <>
            信頼が閾値（正規化 {p.gated.gateStart.toFixed(2)}〜{p.gated.gateFull.toFixed(2)}）を越えて
            初めて立ち上がる。「効かない」のではなく前提が足りないだけ、という罠。{meetingNote}
          </>
        ),
      }
    case 'cumulative':
      return {
        coef: `成果 最大 ${p.cumulative.valueMax.toFixed(1)}×ΔK（τ=${Math.round(p.cumulative.tau)}h）／ 信頼 ${p.cumulative.trustRate}/h（線形）`,
        klass: '非定常（累積飽和）＋信頼源',
        desc: (
          <>
            累積投入で知識ストック K を積み、その年の<strong>差分だけ</strong>が成果に——初回は大きく効くが、
            繰り返すほど飽和して逓減する。ただし信頼は毎年線形に稼げるので、飽和後は
            「<strong>信頼維持の一手</strong>」へ役割が変わる（死に枠にはならない）。{meetingNote}
          </>
        ),
      }
    case 'concave':
      return {
        coef: `0 → ${p.concave.valueMax.toFixed(1)}（凹・飽和）`,
        klass: '弱い変数（逓減）',
        desc: (
          <>
            最初のわずかな投入で大半が出て、作り込むほど逓減（τ={Math.round(p.concave.tau)}h）。かけすぎは悪手。
            {dummyLabel}の係数を「多少」底上げする交差項も持つ。{meetingNote}
          </>
        ),
      }
    default: // dummy
      return {
        coef: `${p.dummy.base.toFixed(3)}〜${(p.dummy.base + p.concave.boost).toFixed(3)}/h`,
        klass: 'ほぼ定数（ダミー）',
        desc: (
          <>
            ほぼ定数。{concaveLabel}に時間をかけると「多少」上がるが、誤差。{meetingNote}
          </>
        ),
      }
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
  const scenario = state.scenario
  const rawScore = state.cumulativeOutcome
  const skill = skillScore(state.history)
  const grade = gradeFor(skill) // ランクは実力点（市況調整後）で判定する
  const counterfactual = counterfactualScore(state.history, scenario)
  const a = analyze(state, scenario)
  const m = ACTIVITY_META
  const gatedLabel = m[scenario.activityOf.gated].label
  const cumLabel = m[scenario.activityOf.cumulative].label

  // 素点と実力点の乖離（＝運・市況がどれだけ結果を動かしたか）。
  const rel = skill > 0 ? (rawScore - skill) / skill : 0
  const divergence = rel > 0.08 ? 'tailwind' : rel < -0.08 ? 'headwind' : 'even'
  const tuition = skill - counterfactual // 探索の授業料（最終配分を貫いた場合との差）

  const outcomeKeys: ('meeting' | 'docs' | 'visit' | 'va')[] = ['meeting', 'docs', 'visit', 'va']

  return (
    <div className="end">
      <div className="end__inner">
        <p className="end__phase">
          <Icon name="menu_book" size={16} />10年目・説明フェーズ
        </p>
        <h1 className="end__h1">10年間の同定、完了。</h1>
        <p className="end__dept-line">
          <Icon name="badge" size={15} />
          配属：<strong>{scenario.dept.name}</strong>
          <span className="end__seed">{scenario.seedLabel}</span>
        </p>

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
            毎年の年度末に宣言した見立てを、真実と並べる。<strong>どの活動が効くか（which）</strong>と
            <strong>それが来年も効くか（how）</strong>——2軸で、あなたの推定がいつ核心へ届いたかを振り返る。
            これは点数ではなく、<strong>推定が収束していく過程</strong>の記録だ。
          </p>
          <ul className="end__hypo">
            {state.history.map((r) => {
              const v = hypoVerdict(r.hypothesis, scenario)
              const dv = durVerdict(r.hypothesis, r.durability, scenario)
              const named = r.hypothesis != null && r.hypothesis !== 'unknown'
              const label = named ? ACTIVITY_META[r.hypothesis as Exclude<Hypothesis, 'unknown'>].label : 'まだ分からない'
              return (
                <li key={r.year} className="end__hypo-row">
                  <span className="end__hypo-year">{r.year}年目</span>
                  <span className="end__hypo-guess">
                    {label}
                    {named && r.durability && (
                      <span className={`end__hypo-how ${dv.cls}`}>
                        <Icon name="update" size={12} />来年:{dv.label}{dv.mark && ` ${dv.mark}`}
                      </span>
                    )}
                  </span>
                  <span className={`end__hypo-mark ${v.cls}`}>{v.mark}{v.note && <em>{v.note}</em>}</span>
                </li>
              )
            })}
          </ul>
          <p className="end__hypo-foot">
            この配属（{scenario.dept.name}）での真の主力は <strong>{gatedLabel}</strong>（前提が整えば）。
            <strong>{cumLabel}</strong>は序盤の頼れる二番手だが、成果面は<strong>繰り返すほど飽和</strong>する——
            同じ配分でも、効き方は時期で変わる。<em>別の部署なら、この答えは違う。</em>
          </p>
        </section>

        <section className="end__section card">
          <h2><Icon name="insights" size={18} />あなたのプレイ分析</h2>
          <ul className="end__analysis">
            <li>
              {gatedLabel}（真の主力）のゲートが開き始めたのは
              {a.gateStart ? <strong> {a.gateStart}年目</strong> : <strong> ついぞ開かなかった</strong>}
              {a.gateFull && <>、全開になったのは <strong>{a.gateFull}年目</strong></>}。
            </li>
            {a.trapYears.length > 0 ? (
              <li className="is-warn">
                <strong>{a.trapYears.join('・')}年目</strong>は、信頼が足りないまま{gatedLabel}に注力していた——
                ゲートが閉じており、その時間の多くは成果にならなかった（罠）。
              </li>
            ) : (
              <li className="is-ok">信頼が低いまま主力に賭ける「罠」は、うまく避けられていた。</li>
            )}
            {a.visitYearCount > 0 && (
              <li className={a.visitSaturatedWaste.length > 0 ? 'is-warn' : 'is-ok'}>
                {cumLabel}（累積活動）は <strong>{a.visitYearCount}年</strong>使い、知識ストックは
                <strong> {(a.visitFinalStock * 100).toFixed(0)}%</strong> まで積み上がった。
                {a.visitSaturatedWaste.length > 0 ? (
                  <>
                    ——うち <strong>{a.visitSaturatedWaste.join('・')}年目</strong> は知識が飽和した後の追加投入で、
                    成果面はほぼ空振りだった（信頼稼ぎには依然有効）。同じ配分の反復では、この飽和は見えてこない。
                  </>
                ) : (
                  '序盤の効きを取り切り、飽和したあとは深追いしなかった。'
                )}
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
          <h2><Icon name="lock_open" size={18} />種明かし：この配属（{scenario.dept.name}）の隠れ構造</h2>
          <p className="end__reveal-lead">
            あなたが観測していた「成果」は、次の関数に<strong>運（ノイズ）</strong>と<strong>市況</strong>を掛けたものだった。
            <strong>効き方の“形”は6種で固定</strong>だが、<strong>どの活動がどの形を担うかは配属で入れ替わる</strong>。
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
              {outcomeKeys.map((k) => {
                const rev = outcomeReveal(scenario, k)
                return (
                  <tr key={k} className={rev.highlight}>
                    <td><RevealName icon={m[k].icon} color={m[k].accent}>{m[k].label}</RevealName></td>
                    <td>{rev.coef}</td>
                    <td>{rev.klass}</td>
                    <td>{rev.desc}</td>
                  </tr>
                )
              })}
              <tr>
                <td><RevealName icon={m.report.icon} color={m.report.accent}>報告</RevealName></td>
                <td>{C.COEF.report}/h</td>
                <td>定数（直接成果ゼロ）</td>
                <td>だが信頼ptの最大の源泉。「効かない」のに最重要だった。</td>
              </tr>
              <tr>
                <td><RevealName icon="diversity_3" color={m.develop.accent}>部署の力</RevealName></td>
                <td>×{C.AWARENESS_BASE} → 最大 ×{scenario.params.delayed.max}</td>
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
              ①主力（ゲート付き）の係数を開く ②観測ノイズを縮める（±{C.NOISE_MAX * 100}% → ±{C.NOISE_MIN * 100}%）
              ③上申で会議制約を外す。
            </li>
            <li>
              <strong>2種類の不確実性：</strong>
              <em>運（ノイズ）</em>は信頼を積めば縮められる。<em>市況</em>は何をしても縮まない。
              制御できる不確実性は制御し、できないものは「できない」と知る——それが評価の二軸化の意味だ。
            </li>
            <li>
              <strong>配属で答えは変わる：</strong>
              学んだのは「{gatedLabel}が正解」ではなく、<em>ノイズの奥の構造を推定する“やり方”</em>だ。
              次の配属では、主力もダミーも別の活動に入れ替わる。
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
            <Icon name="replay" size={22} />別の部署でもう一度
          </button>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onTitle}>
            <Icon name="home" size={20} />タイトルへ
          </button>
        </div>
      </div>
    </div>
  )
}
