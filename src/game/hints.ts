// ============================================================================
//  毎年のフィードバック生成（設計書 §6）。
//  - 定性シグナル + 同僚/上司のセリフ
//  - ヒントの信頼度は信頼ptに連動（低いと曖昧 or ミスリード）
//  - 「VAに全振りしたのに不発」という罠を意図的に踏ませる
// ============================================================================

import type { ActivityKey, YearResult } from './types'
import { marketNews, trustTier } from './engine'
import type { MarketNews } from './engine'

export type FeedbackTone = 'positive' | 'neutral' | 'warning' | 'misleading'

export interface Feedback {
  tone: FeedbackTone
  /** 成果に関する定性シグナル。 */
  signal: string
  /** 同僚・上司のセリフ。 */
  dialogue: string
}

const ACTIVITY_LABEL: Record<ActivityKey, string> = {
  meeting: '会議',
  docs: '資料作成',
  visit: '現場訪問',
  va: 'VA提案',
  report: '報告',
  develop: '育成',
  research: '競合調査',
}

const DIALOGUE: Record<'low' | 'mid' | 'high', string[]> = {
  low: [
    '同僚A「正直、いま何が効いているのか…手応えがつかめないな」',
    '上司「数字が乱高下している。まだ周りが見えていないんじゃないか」',
    '同僚B「現場とはまだ距離がある感じがするね」',
  ],
  mid: [
    '同僚A「最近、現場の声が少しずつ届くようになってきた気がする」',
    '上司「ブレが収まってきたな。観測が安定してきた証拠だ」',
    '同僚B「協力してくれる人が増えてきたよ」',
  ],
  high: [
    '上司「チームが一枚岩だ。君の提案も通りやすくなってきた」',
    '同僚A「数字が安定している。これなら判断材料にできるね」',
    '同僚B「現場は完全に味方だ。何でも相談できる」',
  ],
}

/** 配列から決定的に1つ選ぶ（年で回す。Math.random は使わず再現性を保つ）。 */
function pick<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length]
}

// ---- 市況ニュース（設計書 §3.3）：方向だけ開示し、大きさは伏せる ----
const MARKET_HEADLINES: Record<MarketNews, string[]> = {
  up: [
    '円安が進行。輸出環境は追い風だ。',
    '受注が上向き、業界全体が活気づいている。',
    '市況は好転。今年は成果が出やすい環境かもしれない。',
  ],
  down: [
    '景気後退の足音。市場は冷え込み気味だ。',
    '取引先が投資を絞り、逆風が強まっている。',
    '市況は軟調。努力が数字に表れにくい年になりそうだ。',
  ],
  flat: [
    '市況に大きな動きはない。環境はおおむね平年並みだ。',
    '相場は小動き。良くも悪くも平年並みの一年になりそうだ。',
  ],
}

export interface MarketInfo {
  news: MarketNews
  headline: string
}

/** 市況係数から、年初に流す「ニュース」（向き＋見出し）を組み立てる。 */
export function marketInfo(market: number, year: number): MarketInfo {
  const news = marketNews(market)
  return { news, headline: pick(MARKET_HEADLINES[news], year) }
}

/** 直接成果に寄与しうるアクティビティのうち、最大寄与のものを返す。 */
function topContributor(result: YearResult): { key: ActivityKey; value: number } {
  const keys: ActivityKey[] = ['meeting', 'docs', 'visit', 'va', 'research']
  let best: { key: ActivityKey; value: number } = { key: 'meeting', value: -1 }
  for (const k of keys) {
    if (result.contributions[k] > best.value) best = { key: k, value: result.contributions[k] }
  }
  return best
}

export function generateFeedback(result: YearResult): Feedback {
  const tier = trustTier(result.trustNormAtStart)
  const dialogue = pick(DIALOGUE[tier], result.year)

  const vaHours = result.allocation.va
  const gateClosed = result.vaGate < 0.2
  const top = topContributor(result)

  // --- 罠：VAに注力したのにゲートが閉じていて不発 ---
  if (vaHours >= 300 && gateClosed) {
    if (tier === 'low') {
      return {
        tone: 'misleading',
        signal:
          'VA提案に多くの時間を割いたが、数字はまるで動かなかった。「VA提案は成果に効かない活動」——そう結論づけたくなる手応えのなさだ。',
        dialogue,
      }
    }
    return {
      tone: 'warning',
      signal:
        'VA提案に時間を注いだが、空回りした感覚が残る。効かないのか——それとも、何か前提条件が足りていないのか？',
      dialogue,
    }
  }

  // --- 信頼が低い年は、ヒント自体が曖昧 or ミスリード ---
  if (tier === 'low') {
    // 偽の手応え：実際には弱い会議/資料に「効いた気がする」と誤認させる
    const decoy = result.allocation.docs > result.allocation.visit ? 'docs' : 'meeting'
    return {
      tone: 'misleading',
      signal: `ノイズが大きく、何が効いたのか判然としない。強いて言えば${ACTIVITY_LABEL[decoy]}に手応えがあった……気がする（当てにはならない）。`,
      dialogue,
    }
  }

  // --- 信頼が中〜高なら、最大寄与に沿った（概ね正しい）シグナル ---
  if (top.value <= 0) {
    return {
      tone: 'neutral',
      signal: '目立った成果の手応えはなかった。配分を見直す余地がありそうだ。',
      dialogue,
    }
  }

  const certainty = tier === 'high' ? 'はっきりと' : 'なんとなく'
  const signalByKey: Record<ActivityKey, string> = {
    va: `VA提案が${certainty}成果に結びついた手応えがある。前提（信頼）が整い、係数が立ち上がっている。`,
    visit: `現場訪問が${certainty}効いている手応え。足を運んだ分が数字になっている。`,
    docs: `資料作成が${certainty}効いた感触。会議も少しやりやすくなった気がする（交差項？）。`,
    meeting: `会議をこなした感はあるが、成果への直結は${certainty}薄いと感じる。`,
    // 競合調査は「初年度は劇的に効く」——この手応えが2年目以降の裏切りへの伏線になる。
    research: `競合調査が${certainty}効いた手応え。知らなかった市場の事情が、そのまま数字を押し上げた。`,
    report: '',
    develop: '',
  }

  return {
    tone: top.key === 'va' ? 'positive' : 'neutral',
    signal: signalByKey[top.key],
    dialogue,
  }
}
