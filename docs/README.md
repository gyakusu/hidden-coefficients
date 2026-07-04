# docs — 設計ドキュメント

『変数を見極めろ（hidden-coefficients）』の設計に関する資料を置いています。

| ファイル | 内容 |
|---|---|
| [`concept-original.md`](./concept-original.md) | **最初期のコンセプト原本**（当時のまま保存 ＋ 実装との対応注釈）。このゲームの出発点。 |
| [`idea-real-world-expansion.md`](./idea-real-world-expansion.md) | **拡張の設計＋実装記録**（2026-07 ディレクターフィードバック対応）。非定常係数・市況・年次振り返り。P1〜P3 実装済み。**※§1 は下記改訂により破棄** |
| [`design-revision-2026-07.md`](./design-revision-2026-07.md) | **設計改訂（2026-07）**。フィードバック誤読の訂正：「競合調査」を新項目とせず現場訪問へ吸収。「やってみないと分からない」を設計原則化。**§5 全タスク実装済み**（`94d4426`） |
| [`improvement-proposal-2026-07.md`](./improvement-proposal-2026-07.md) | **改善提案（2026-07・最新）**。外部批評（READMEネタバレ／リプレイ耐性／初見の理不尽化／研修運用）への応答：ネタバレ隔離・配属シャッフル（シード乱数化）・初見救済・研修キット。**P0（ネタバレ隔離）・P1（配属シャッフル）実装済み**（§2.7）。P2・P3 未着手 |
| [`mechanics-spoilers.md`](./mechanics-spoilers.md) | **🔒 隠れたメカニクスの種明かし（ネタバレ）**。README から隔離した仕組み一覧（P0）。**未プレイの人は読まないこと。** |

## ドキュメントの流れ

```
docs/concept-original.md          ← 最初期コンセプト（種・このフォルダ）
        │  推敲
        ▼
game_design.md                    ← 正式な設計書（リポジトリ直下）
        │  実装
        ▼
src/                              ← React アプリ本体
        │  ディレクターFB → 拡張
        ▼
docs/idea-real-world-expansion.md ← 拡張設計＋実装記録（§1 は誤読につき破棄）
        │  デザイナーFB再確認 → 改訂
        ▼
docs/design-revision-2026-07.md   ← 設計改訂（実装済み）
        │  外部批評 → 改善提案
        ▼
docs/improvement-proposal-2026-07.md ← 改善提案（P0・P1 実装済み／P2・P3 未着手）
        │  P0：ネタバレ隔離
        ▼
docs/mechanics-spoilers.md           ← 種明かし（READMEから隔離）
```

- 推敲済みの正式な設計書：[`../game_design.md`](../game_design.md)
- 実装：[`../src/`](../src)
