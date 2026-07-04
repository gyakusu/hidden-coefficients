# docs — 設計ドキュメント

『変数を見極めろ（hidden-coefficients）』の設計に関する資料を置いています。

| ファイル | 内容 |
|---|---|
| [`concept-original.md`](./concept-original.md) | **最初期のコンセプト原本**（当時のまま保存 ＋ 実装との対応注釈）。このゲームの出発点。 |
| [`idea-real-world-expansion.md`](./idea-real-world-expansion.md) | **拡張の設計＋実装記録**（2026-07 ディレクターフィードバック対応）。非定常係数・市況・年次振り返り。P1〜P3 実装済み。**※§1 は下記改訂により破棄** |
| [`design-revision-2026-07.md`](./design-revision-2026-07.md) | **設計改訂（2026-07・最新）**。フィードバック誤読の訂正：「競合調査」を新項目とせず現場訪問へ吸収。「やってみないと分からない」を設計原則化。**実装は未着手（設計のみ）** |

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
docs/design-revision-2026-07.md   ← 設計改訂（最新・実装待ち）
```

- 推敲済みの正式な設計書：[`../game_design.md`](../game_design.md)
- 実装：[`../src/`](../src)
