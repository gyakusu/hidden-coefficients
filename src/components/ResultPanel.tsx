// ============================================================================
//  年度末レビュー「決算と反省」（設計書 §4.1）。
//  結果の数字は伏せ気味に、プレイヤー自身の意思決定と学びを可視化する。
//   ① 決算サマリ（信頼ティア連動の霧つき内訳）
//   ② プロセス指標（結果に依らない、自分で制御できた指標）
//   ③ 仮説ノート（毎年1問、最も効くと思う活動を宣言＝エンディングで答え合わせ）
// ============================================================================

import { useState } from 'react'
import * as C from '../game/config'
import { decompose, trustNorm, trustTier } from '../game/engine'
import { generateFeedback, marketInfo } from '../game/hints'
import type { ActivityKey, GameState, Hypothesis, YearResult } from '../game/types'
import { ACTIVITIES, ACTIVITY_META, Icon, InfoPopover } from './ui'

const TONE_ICON = {
  positive: 'trending_up',
  neutral: 'info',
  warning: 'warning',
  misleading: 'visibility_off',
} as const

/** 直接成果に寄与しうる活動のうち最大寄与のキーを返す（high ティアのぼかし表示用）。 */
function topContributor(result: YearResult): ActivityKey {
  const keys: ActivityKey[] = ['meeting', 'docs', 'visit', 'va', 'research']
  let best: ActivityKey = 'meeting'
  let bestVal = -Infinity
  for (const k of keys) {
    if (result.contributions[k] > bestVal) {
      bestVal = result.contributions[k]
      best = k
    }
  }
  return best
}

/** 前年からの配分変化量（探索度）。0=去年と同じ、1=まるで別物。 */
function explorationRate(cur: YearResult['allocation'], prev?: YearResult['allocation']): number | null {
  if (!prev) return null
  const keys = Object.keys(cur) as ActivityKey[]
  const l1 = keys.reduce((s, k) => s + Math.abs((cur[k] || 0) - (prev[k] || 0)), 0)
  return Math.min(1, l1 / 2 / C.TOTAL_HOURS)
}

/** 信頼推移のミニ・スパークライン（実数は出さず、傾向だけ）。 */
function TrustSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 96
  const h = 20
  const pad = 2
  const max = Math.max(...values, 0.0001)
  const step = (w - pad * 2) / (values.length - 1)
  const pts = values
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - (v / max) * (h - pad * 2)).toFixed(1)}`)
    .join(' ')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" />
      <circle cx={pad + (values.length - 1) * step} cy={h - pad - (values.at(-1)! / max) * (h - pad * 2)} r={2.2} />
    </svg>
  )
}

export default function ResultPanel({
  state,
  result,
  onContinue,
}: {
  state: GameState
  result: YearResult
  onContinue: (hypothesis: Hypothesis | null) => void
}) {
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null)

  const fb = generateFeedback(result)
  const isFinal = result.year >= C.PLAY_YEARS
  const tier = trustTier(result.trustNormAtStart)

  const finished = state.history.at(-1)
  const prevRecord = state.history.at(-2)
  const prevOutcome = prevRecord?.finalOutcome
  const delta = prevOutcome != null ? result.finalOutcome - prevOutcome : null

  const split = decompose(result)
  const envShare = split.market + split.noise // 環境＋運（実力以外）
  const news = marketInfo(result.marketCoef, result.year)

  const explore = explorationRate(result.allocation, prevRecord?.allocation)
  const investHours =
    result.allocation.report + result.allocation.visit + result.allocation.develop + result.allocation.research
  const investRate = investHours / C.TOTAL_HOURS
  const trustValues = state.history.map((r) => trustNorm(r.trustAfter))
  const trustUp =
    prevRecord && finished ? finished.trustAfter - prevRecord.trustAfter : (finished?.trustAfter ?? 0)

  // 3分割バー（high のみ）。負値も面積で見せるため絶対値で正規化。
  const mag = { skill: Math.abs(split.skill), market: Math.abs(split.market), noise: Math.abs(split.noise) }
  const magTotal = mag.skill + mag.market + mag.noise || 1

  const hypoOptions = ACTIVITIES.filter((mmeta) => !mmeta.promotedOnly || state.promoted)

  return (
    <section className="result card">
      <div className="result__review-head">
        <h2>
          <Icon name="fact_check" size={18} />
          {result.year}年目・年度末レビュー
        </h2>
        <InfoPopover label="年度末レビューとは" title="決算と反省" anchor="parent">
          <p>1年の<strong>決算</strong>（結果の内訳）と、結果に左右されない<strong>プロセス指標</strong>を確認する画面。</p>
          <p>内訳の解像度は<strong>信頼</strong>で決まる——信頼が低いうちは霧が濃い。正誤や係数の答えは
            <strong>最終年</strong>まで伏せられる。</p>
        </InfoPopover>
      </div>

      {/* ① 決算サマリ */}
      <div className="result__headline">
        <div className="result__outcome">
          <span className="result__outcome-label">
            成果
            <InfoPopover label="この数字の読み方" title="成果の読み方" anchor="parent">
              この数字には<strong>ノイズ</strong>（運）と<strong>市況</strong>（環境）が乗っている。1年だけで
              「効く／効かない」を決めつけず、傾向で見極めよう。
            </InfoPopover>
          </span>
          <span className="result__outcome-num">{result.finalOutcome.toFixed(1)}</span>
          {delta != null && (
            <span className={`result__delta ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              <Icon name={delta >= 0 ? 'arrow_upward' : 'arrow_downward'} size={14} />
              {Math.abs(delta).toFixed(1)}
            </span>
          )}
        </div>
        <ul className="result__gains">
          <li>
            <Icon name="handshake" size={15} className="result__gain-icon" />
            信頼 <strong>+{result.trustGain.toFixed(1)}</strong>
          </li>
          {result.awarenessGain > 0 && (
            <li>
              <Icon name="diversity_3" size={15} className="result__gain-icon" />
              意識 <strong>+{result.awarenessGain.toFixed(3)}</strong>
            </li>
          )}
        </ul>
      </div>

      {/* 内訳（信頼ティア連動の霧） */}
      <div className="result__breakdown">
        <span className="result__breakdown-label">
          成果の内訳
          <InfoPopover label="内訳の読み方" title="実力・市況・運" anchor="parent">
            成果は「<strong>実力</strong>（あなたの行動）× <strong>市況</strong>（環境）× <strong>運</strong>（ノイズ）」でできている。
            信頼が高いほど、この内訳がはっきり見えるようになる。
          </InfoPopover>
        </span>
        {tier === 'low' && (
          <p className="result__fog">
            <Icon name="foggy" size={16} />
            信頼が低く、内訳は<strong>霧の中</strong>。実力なのか、環境や運なのか——まだ切り分けられない。
          </p>
        )}
        {tier === 'mid' && (
          <div className="result__split2">
            <span className="split-chip is-skill">
              実力分 <b>＋</b>
            </span>
            <span className={`split-chip ${envShare >= 0 ? 'is-up' : 'is-down'}`}>
              環境・運分 <b>{envShare >= 0 ? '＋寄り' : '−寄り'}</b>
            </span>
            <span className="result__split-note">（向きのみ。大きさはまだ読めない）</span>
          </div>
        )}
        {tier === 'high' && (
          <div className="result__split3">
            <div className="split-bar" role="img" aria-label="実力・市況・運の内訳">
              <span className="split-seg is-skill" style={{ width: `${(mag.skill / magTotal) * 100}%` }} />
              <span className="split-seg is-market" style={{ width: `${(mag.market / magTotal) * 100}%` }} />
              <span className="split-seg is-noise" style={{ width: `${(mag.noise / magTotal) * 100}%` }} />
            </div>
            <ul className="split-legend">
              <li><i className="dot is-skill" />実力 {Math.round((mag.skill / magTotal) * 100)}%</li>
              <li><i className="dot is-market" />市況 {split.market >= 0 ? '+' : '−'}{Math.round((mag.market / magTotal) * 100)}%</li>
              <li><i className="dot is-noise" />運 {split.noise >= 0 ? '+' : '−'}{Math.round((mag.noise / magTotal) * 100)}%</li>
            </ul>
            <p className="result__split-top">
              今年もっとも成果を押し上げたのは
              <span className="result__split-top-name" style={{ color: ACTIVITY_META[topContributor(result)].accent }}>
                <Icon name={ACTIVITY_META[topContributor(result)].icon} size={15} />
                {ACTIVITY_META[topContributor(result)].label}
              </span>
              のようだ。
            </p>
          </div>
        )}
      </div>

      {/* 手応えコメント（従来の定性シグナル） */}
      <div className={`result__signal tone-${fb.tone}`}>
        <p className="result__signal-text">
          <Icon name={TONE_ICON[fb.tone]} size={18} className="result__signal-icon" />
          <span className="result__signal-msg">
            {fb.signal}
            <InfoPopover label="このコメントについて" title="手応えコメント" anchor="parent">
              上司の反応や手応えは<strong>定性的なヒント</strong>。信頼が低いうちは精度が粗く、
              ときに誤った印象を与えることもある。鵜呑みにせず、数字の推移と合わせて判断しよう。
            </InfoPopover>
          </span>
        </p>
        <p className="result__dialogue">{fb.dialogue}</p>
      </div>

      {/* ② プロセス指標 */}
      <div className="result__process">
        <span className="result__process-label">
          <Icon name="checklist" size={16} />プロセス指標
          <InfoPopover label="プロセス指標とは" title="プロセス指標" anchor="parent">
            成果がノイズや市況で汚れていても、これらは汚れない。<strong>自分で制御できた</strong>ことの記録だ。
            結果が振るわなくても、ここが健全なら「やるべきことはやれていた」。
          </InfoPopover>
        </span>
        <ul className="proc">
          <li className="proc__item">
            <span className="proc__k">信頼の推移</span>
            <span className="proc__v">
              <Icon
                name={trustUp > 0.5 ? 'north_east' : trustUp < -0.5 ? 'south_east' : 'east'}
                size={15}
                className={trustUp > 0.5 ? 'is-up' : trustUp < -0.5 ? 'is-down' : 'is-flat'}
              />
              <TrustSpark values={trustValues} />
            </span>
          </li>
          <li className="proc__item">
            <span className="proc__k">探索度</span>
            <span className="proc__v">
              {explore == null ? (
                <em>初年度</em>
              ) : (
                <>
                  <b>{Math.round(explore * 100)}%</b>
                  <span className="proc__tag">{explore >= 0.25 ? '実験的' : '活用寄り'}</span>
                </>
              )}
            </span>
          </li>
          <li className="proc__item">
            <span className="proc__k">投資率</span>
            <span className="proc__v">
              <b>{Math.round(investRate * 100)}%</b>
              <span className="proc__tag">未来へ張った時間</span>
            </span>
          </li>
          <li className="proc__item proc__item--wide">
            <span className="proc__k">今年の市況</span>
            <span className={`proc__v proc__news proc__news--${news.news}`}>
              <Icon
                name={news.news === 'up' ? 'trending_up' : news.news === 'down' ? 'trending_down' : 'trending_flat'}
                size={15}
              />
              {news.news === 'up' ? '追い風' : news.news === 'down' ? '向かい風' : '平年並み'}だった
            </span>
          </li>
        </ul>
      </div>

      {/* ③ 仮説ノート */}
      <div className="result__hypo">
        <span className="result__hypo-q">
          <Icon name="quiz" size={16} />
          いま、最も成果に効くと思う活動は？
          <InfoPopover label="仮説ノートとは" title="仮説ノート" anchor="parent">
            毎年の<strong>現時点の見立て</strong>を1つ宣言しておく。正誤はその場では教えない——
            エンディングで<strong>9年分の変遷</strong>を真実と並べ、あなたの推定がいつ収束したかを振り返る。
          </InfoPopover>
        </span>
        <div className="result__hypo-opts">
          {hypoOptions.map((mmeta) => {
            const on = hypothesis === mmeta.key
            return (
              <button
                key={mmeta.key}
                type="button"
                className={`hypo-chip ${on ? 'is-on' : ''}`}
                style={on ? { borderColor: mmeta.accent, color: mmeta.accent } : undefined}
                onClick={() => setHypothesis(on ? null : mmeta.key)}
              >
                <Icon name={mmeta.icon} size={15} />
                {mmeta.label}
              </button>
            )
          })}
          <button
            type="button"
            className={`hypo-chip hypo-chip--unknown ${hypothesis === 'unknown' ? 'is-on' : ''}`}
            onClick={() => setHypothesis(hypothesis === 'unknown' ? null : 'unknown')}
          >
            <Icon name="help" size={15} fill={false} />
            まだ分からない
          </button>
        </div>
      </div>

      <div className="result__actions">
        <button type="button" className="btn btn--primary btn--icon" onClick={() => onContinue(hypothesis)}>
          {isFinal ? '報告会へ' : '次の年へ'}
          <Icon name="arrow_forward" size={20} />
        </button>
      </div>
    </section>
  )
}
