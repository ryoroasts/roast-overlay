# Overlay(旧 kpro-diff)

> 🚧 **2026-08-14 改称・公開準備中。** `.klog`(実測ログ)対応を含む現行の仕様は
> [`docs/SPEC.md`](docs/SPEC.md) が正。この README は Phase 1-2 時点の記述で、
> 英語版への書き換えは公開整備(F10)で行う。
> リポジトリ名 `roast-overlay` / 公開予定ドメイン `overlay.coffee`。

Kaffelogic の `.kpro` プロファイルを**重ね描き比較**する Web ツール。
Kaffelogic Studio 標準の比較が使いにくい(比較先の Zone が見えない・取り回しが悪い)問題を、
同一豆でカーブを 1 変数ずつ変える検証運用(V2 / V2a / V2b / V2c 系列)向けに解消するのが目的。

純クライアント静的アプリ。`.kpro` はブラウザ内でのみ処理され、サーバ送信は一切ない。
private 利用(`npm run dev`)から将来の WEB 公開(静的ホスティング)まで同一コードで動く。

## 使い方

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に静的出力(GitHub Pages / Cloudflare Pages 等にそのまま置ける)
```

ブラウザで `.kpro` を複数ドラッグ&ドロップすると、

- **Roast カーブ**の重ね描き(温度 × 時間)
- **Level → 終了温度**の線形補間(roast_levels テーブル)
- **スカラー差分表**(preheat / PID / zone、基準列との差分をハイライト)

が表示される。

## .kpro データ構造(リバースエンジニアリング済み)

- プレーン ASCII / LF / BOM なし / チェックサムなし。1 行 = `key:value`。
- `roast_profile` / `fan_profile` は `(時間秒, 値)` のペア列。先頭・末尾に `time=0` のパディング。
- **パディングを除いた実データは 3 ペアで 1 グループ**。各グループは
  `[アンカー, 制御点, 制御点]` で、アンカー(曲線が通る点)はグループの **1 番目**。
  残り 2 つは、そのアンカーから次のアンカーへ向かう区間の 2 制御点(格納順は不定なので時間でソート)。
- 隣接アンカー `Aᵢ → Aᵢ₊₁` を、`start=Aᵢ, cp1/cp2=グループ i の制御点(時間順), end=Aᵢ₊₁` の
  **3 次ベジェ**で描くと Kaffelogic Studio と同じ曲線になる
  (Studio のファン値 ― v2b で 7:00≒13540 ― と一致することで構造を確定)。
- `roast_levels`: Level 0〜6 の終了温度 7 値。Level は焙煎度の絶対値ではなく
  「テーブルから終了温度を選ぶインデックス」。0.1 刻みで線形補間。
- 時間軸 ×N 変換は「時間座標(偶数 index)だけ ×N、温度(奇数 index)据え置き、
  zone の time_start/end も ×N」で表現できる。

実装: パース = [`src/lib/kpro.ts`](src/lib/kpro.ts)、ベジェ展開/補間 = [`src/lib/curve.ts`](src/lib/curve.ts)。

## ロードマップ

- **Phase 1(済)**: 複数 kpro 読込 / roast カーブ重ね描き / スカラー差分表 / Level 終了温度補間
  - 軸は本家 Studio に合わせ固定(縦 0〜250℃/50℃刻み、横 0〜10:00/30秒刻み)。選択 Level の終了温度をカーブ上に点表示。
- **Phase 2(済)**: fan_profile 重ね描き(破線・第 2 軸)/ Zone 帯可視化(zone1/2/corner1 の有効区間+boost)/ ホバー差分ツールチップ(基準列との Δ・ファン rpm)
- **Phase 3**: `.klog` 実測カーブ重ね(設計 vs 実測)/ 時間軸 ×N 変換ヘルパ / 共有エクスポート
