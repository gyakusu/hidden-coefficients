import { Icon } from './ui'

export default function PromotionModal({ onAck }: { onAck: () => void }) {
  return (
    <div className="modal__overlay" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="modal card">
        <span className="modal__badge">
          <Icon name="trending_up" size={16} />昇進イベント・5年目
        </span>
        <h2 id="promo-title" className="modal__title">
          <Icon name="workspace_premium" size={28} />昇進した。
        </h2>
        <p>
          立場が上がり、操作できるパラメータが増えた。これまで<strong>定数</strong>として
          手の届かなかった「部署そのものの力」——メンバー一人ひとりの意識——が、
          今や<strong>あなたが動かせる変数</strong>になった。
        </p>
        <p className="modal__unlock">
          <Icon name="school" size={26} />
          <span>
            新しいアクティビティ <strong>「育成」</strong> が解放された。
            時間を割くほどチーム意識が高まり、<em>翌年以降</em>のすべての成果を底上げする。
          </span>
        </p>
        <blockquote className="modal__quote">
          「それまで定数だった社員一人一人の意識が、大きな変数となった。」
        </blockquote>
        <div className="modal__actions">
          <button type="button" className="btn btn--primary btn--icon" onClick={onAck}>
            5年目を始める<Icon name="arrow_forward" size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
