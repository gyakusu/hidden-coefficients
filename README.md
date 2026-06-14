# 変数を見極めろ（hidden-coefficients）

> 仕事の成果を「隠された関数」と捉え、何が**変数**で何が**定数**かを見抜くシミュレーションゲーム。
> 表向きはリソース配分パズル、その実態は **ノイズ込みの観測データから隠れた係数構造を推定するゲーム**（システム同定）です。

[`game_design.md`](./game_design.md) の設計書に基づいた React アプリケーションで、GitHub Actions により GitHub Pages へ公開できます。

🎮 **公開先（Pages 有効化後）**: https://gyakusu.github.io/hidden-coefficients/

---

## ゲームの遊び方

- 社会人 **1〜10 年目**（10 ターン）を進めます。毎年 **2000 時間** を各アクティビティに配分します。
- 勝敗は **最終的な累積部署成果** のみで決まります。
- 各アクティビティの「成果への効き目（係数）」は**伏せられています**。観測（毎年の成果とヒント）から推定してください。
- 成果には毎年ランダムなノイズが乗ります。**1 年のデータは信用できません。**

### 隠れたメカニクス（プレイ中は非公開）

| 仕組み | 内容 |
|---|---|
| **信頼pt** | 報告・現場訪問で貯まる遅延報酬。①VA提案のゲートを開く ②観測ノイズを縮める ③上申で会議制約を外す、の三役を担う |
| **VA提案ゲート** | 信頼が一定値に達するまで VA提案の係数は立ち上がらない。「効かない」のではなく前提が足りないだけ、という罠 |
| **交差項** | 資料作成は会議の係数を *多少* 底上げする（ダミーに騙される罠） |
| **昇進（5年目）** | 定数だった「部署の力」が変数化。アクティビティ「育成」が解放され、以後の成果を底上げできる |
| **上申** | 信頼と累積成果が一定以上で、会議の最低回数制約を解除できる |

ゲーム終了後（10 年目・説明フェーズ）に、隠されていた構造の**種明かし**と、あなたのプレイ分析が表示されます。

---

## 開発

前提: Node.js 20+ / npm

```bash
npm install      # 依存をインストール
npm run dev      # 開発サーバ（http://localhost:5173/hidden-coefficients/）
npm test         # ゲームエンジンの単体テスト（Vitest）
npm run typecheck# 型チェック（tsc）
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド結果をローカルで確認
```

### 技術スタック

- **Vite + React 18 + TypeScript**
- ゲームロジックは UI から分離（`src/game/`）し、純粋関数として Vitest で検証
- チャートは依存を増やさず素の SVG で描画

---

## 公開（GitHub Pages）

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **「GitHub Actions」** に設定します。
2. `main` ブランチへ push すると [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) が走り、型チェック・テスト・ビルドを経て Pages へ公開されます。
   - 任意のブランチから試したい場合は、**Actions タブ → Deploy to GitHub Pages → Run workflow** で手動実行できます。
3. 公開 URL は `https://<ユーザー名>.github.io/hidden-coefficients/` です。

> **base パスについて**: `vite.config.ts` の `base: '/hidden-coefficients/'` はプロジェクトページ用の設定です。
> 独自ドメインやユーザーページ（ルート公開）に移す場合は、ここを `'/'` などに変更してください。

CI（型チェック + エンジンの単体テスト + ビルド）は [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) で、PR と feature ブランチへの push 時に実行されます。

---

## プロジェクト構成

```
src/
├─ game/                 ゲームの中核（UI 非依存・テスト対象）
│  ├─ config.ts          チューニング・パラメータ（設計書 §9 に対応）
│  ├─ engine.ts          成果関数・信頼・ノイズ・ゲートの純粋ロジック
│  ├─ hints.ts           毎年のフィードバック生成（信頼に連動した精度）
│  ├─ types.ts           型定義
│  └─ engine.test.ts     単体テスト + 戦略バランスのキャリブレーション
├─ hooks/useGame.ts      ターン進行の状態遷移（useReducer）
├─ components/           画面（タイトル / プレイ / 結果 / 昇進 / エンディング）
└─ styles.css            スタイル
```

ゲームバランスを調整したいときは、まず `src/game/config.ts` を編集してください。
`engine.test.ts` のキャリブレーションが「上級 > 均等 > 罠（VA全振り）」の関係を担保します。
