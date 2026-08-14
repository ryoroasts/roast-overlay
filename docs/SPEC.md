# Overlay — 仕様書(Session 1 成果物 / 2026-08-14)

> **このドキュメントの読み方**
> Session 2(実装)は、このドキュメントに書かれていることだけを実装する。
> 書かれていない判断が必要になったら、**実装せずに止めて聞く**。
> §9「やらないことリスト」に書かれたものは、思いついても作らない。

---

## 0. 決定事項サマリ

| 項目 | 決定 | 決めた理由 |
|---|---|---|
| **アプリ名** | **Overlay**(表示名)/ リポジトリ `roast-overlay` / ドメイン `overlay.coffee` | 2026-08-14 本人承認。RoastLog・RoastPATH・Roastime が犇めく「Roast◯◯」帯を避けられ、やることが一語で伝わる |
| **UI 言語** | **英語デフォルト + 日本語トグル** | 2026-08-14 本人承認 |
| **タグライン** | `See your roast against its design.` | §3 の観測(設計 vs 実測が最頻の話題)から |
| **配布形態** | 静的サイト・アカウント不要・**ファイルはブラウザ内で完結** | §4 の競合2社が両方ともクラウド+要ログイン。ここが最大の非対称性 |
| **v1.0 の核** | 設計 vs 実測の重ね + **温度基準アラインメント** | §4 参照。これが無いと BrewRoom を選ばない理由が無い |

---

## 1. 位置づけの再定義

現行 `kpro-diff` は「.kpro を重ねる」ツールだった。
新しい `Overlay` は **「1回の焙煎が、設計どおりに動いたかを見る」計測器**である。

- `.kpro` 単体 = 設計の比較(現行機能。維持する)
- `.klog` 単体 = **その1回の設計 vs 実測**(新規・最重要)
- `.klog` 複数 = **複数回の焙煎を揃えて比較**(新規・差別化)

---

## 2. データ仕様(実測で確定済み。**再調査不要**)

### 2.1 `.kpro`(設計プロファイル)

現行 `src/lib/kpro.ts` の理解でおおむね正しい。以下だけ追記・訂正する。

- `recommended_level` は **27本すべてに存在**(0.8〜5.6)。デフォルト Level として常に使える。
- `expect_fc`(1ハゼ予想温度)は一部のみ非0(208.7 / 209.0 / 212.8)。
- `expect_colrchange` は **27本すべて 0.0**。実質未使用。
- ベジェ再構成の精度は §2.4 を参照(**完全一致ではない**)。

### 2.2 `.klog`(実測ログ)— 構造

プレーン ASCII / LF。3ブロック構成。

```
① key:value ヘッダ(.kpro の全項目 + 機体情報 + roast_profile / fan_profile / roast_levels)
② !event 行
③ offsets 行 → カラム見出し行 → タブ区切りデータ行(1Hz)
```

> **重要:`.klog` は自己完結している。**
> `.kpro` の中身(`roast_profile` / `fan_profile` / `roast_levels`)を丸ごと含む。
> **`.klog` を1本読ませるだけで、設計カーブと実測カーブの両方が描ける。**
> `.kpro` を別途読ませる必要はない。

### 2.3 データ行のカラム(**見出し行から確定**・35本すべて同一)

```
time  #spot_temp  #=temp  =mean_temp  =profile  profile_ROR  =actual_ROR  #=desired_ROR
      power_kW  #volts-9  #Kp  #Ki  #Kd  #^actual_fan_RPM
```

空文字を除いた 0-indexed:

| idx | 名前 | 内容 | 使う? |
|---|---|---|---|
| 0 | `time` | 秒 | ✅ x軸 |
| 1 | `spot_temp` | **生の熱電対値**(ノイズ大) | 任意表示 |
| 2 | `temp` | **0.5秒移動平均** | 任意表示 |
| 3 | `mean_temp` | **7秒移動平均**。標準の豆温度線 | ✅ **主線** |
| 4 | `profile` | **設計カーブを機体が1Hzで展開した値** | ✅ **設計線** |
| 5 | `profile_ROR` | 設計カーブの RoR(℃/min) | 任意 |
| 6 | `actual_ROR` | **実測 RoR(℃/min)。自前計算は不要** | ✅ |
| 7 | `desired_ROR` | 制御目標 RoR | ✕ |
| 8 | `power_kW` | ヒーター出力 | 任意 |
| 9 | `volts-9` | 電圧-9 | ✕ |
| 10-12 | `Kp` `Ki` `Kd` | PID 実効値 | ✕ |
| 13 | `actual_fan_RPM` | 実測ファン回転数 | ✅ |

移動平均の秒数は **Kaffelogic 公式(Chris Hilder)の回答**による(community t=34, #160):
「the mean_temp line is a 7 sec rolling mean … The temp line is actually a 0.5 sec rolling mean …
the spot_temp line which is a raw thermocouple reading」

見出しの接頭辞 `#` `=` `^` は Studio の表示ヒントと思われる。**意味は未確定。無視してよい**
(カラムは固定インデックスで読む)。

### 2.4 ⚠️ 現行パーサは**最終セグメントを落としている**(新規発見・要修正)

`.klog` の `=profile` 列は「機体自身が描いた設計カーブ」なので、
現行 `buildCurve()` の答え合わせに使える。全31本で突き合わせた結果:

#### (a) バグ: カーブが焙煎の途中で終わる

`roast_profile` のペア列の構造は、パディングを除いた本体が **3ペア = 1グループ
`[アンカー, 制御点, 制御点]`**(現行の理解どおり)。ただし現行コードは
**最後のグループの制御点を捨てている**。この2点は最終アンカーより後ろにあり、
**そこからさらに伸びる最終セグメント**を表している。

実測(`1500-2000m Rest`):最終アンカーは `(495.5, 218.5)` だが、
機体の `=profile` は t=515.5 で 219.80、t=532.0 で 220.84 まで**上がり続ける**。
末尾の2点 `(515.4, 219.9)` `(558.1, 222.5)` に向かっている。

結果、**31本中6本で設計カーブが焙煎終了より手前で切れる。最悪 157秒不足。**
設計線が途中でぷつりと消えるので、公開前に必ず直す。

#### (b) 修正方法

最終グループを `[A, cp, finalAnchor]`(時間順)と解釈し、
`A → finalAnchor` のセグメントを1本追加する(制御点は `cp` を2回使う)。

```
segments.push({ start: lastAnchor, cp1: cp, cp2: cp, end: finalAnchor })
   ※ cp / finalAnchor = 最終グループの2制御点を時間順に並べたもの
```

検証済みの効果:

| | 設計カーブが焙煎終了前に切れるログ | 終端60秒の平均誤差 |
|---|---|---|
| 現行 | **6 / 31**(最悪 157s 不足) | 0.26℃ |
| 修正後 | **0 / 31** | 0.25℃ |

**精度を落とさずに欠損だけが消える。** 副次的に §5 F3 の終了点ドットも
**27プロファイル中 12本 → 22本**で描けるようになる。

#### (c) 残差(修正後も残る。これ以上は追わない)

| 時間帯 | 平均誤差 | 最大誤差 |
|---|---|---|
| **0-59s** | **2.28℃** | **14.11℃** |
| 60s〜終了60秒前 | 0.51℃ | 3.64℃ |
| 終了前60秒 | 0.25℃ | 3.16℃ |

- **60秒以降は実用上一致**(平均 ≤0.5℃)。
- **60秒未満は一致しない**。最初のアンカーが t=7〜31s にあり、機体はそこまでの
  立ち上がりを別ロジックで描いている。先頭に `(0,20)` からの直線セグメントを
  足す案を試したが**改善しない**(2.28→2.25℃、最大値は不変)。**やらない。**
- `time_jump` によるシフトでも説明できない(検証済み・改善しない)。

**→ 実装方針(F2 の前提):**
1. **`.klog` を読んだときの設計線は、必ず `=profile` 列(idx 4)を使う。**
   ベジェ再構成は使わない(機体の答えが手元にあるのに近似する意味がない)。
2. ベジェ再構成は `.kpro` 単体表示のときだけ使う。**(b) の修正は必須。**
3. README に「`.kpro` 単体表示は最初の1分が近似」と明記する。

### 2.5 イベント行

| キー | 内容 | 出現数(35本中) |
|---|---|---|
| `!first_crack` | 1ハゼ秒。**ユーザーの手押し** | **26**(9本は無し) |
| `!roast_end` | 終了秒 | 35 |
| `!development_percent` | DTR% | 26 |
| `!roast_end_reason` | 終了理由(0=正常) | 35 |
| `!motor_supply_noise` | — | 35(無視) |
| `!anti_beanlock` | 複数回出る | 35(無視) |

### 2.6 ⚠️ 必ず踏むエッジケース

実サンプル(log0001〜0004)に**中断した焙煎**が入っている。公開ツールなら必ず来る。

| ログ | roast_end | reason | first_crack | 状態 |
|---|---|---|---|---|
| log0001 | 33.4s | 2 | 無し | 中断 |
| log0002 | 17.5s | 2 | 無し | 中断 |
| log0003 | 4.7s | 2 | 無し | 中断 |
| log0004 | 5.7s | 5 | 無し | 中断 |
| log0005-0009 | 正常 | 0 | **無し**(押していない) | 正常だが FC 無し |

- `profile_file_name` が**空**のことがある(log0001-0004)。
- `profile_short_name` は **17文字で切られる**(`Ninja_MaillardPlu`)。
  **表示名には `profile_file_name` を優先し、無ければ `profile_short_name`、無ければファイル名。**
- 数値に変換できない行(`offsets` / 見出し行)が混ざる。`Number.isFinite` で弾く。
- データ行は**焙煎終了後のクーリング区間まで続く**(log0033 は終了 541s、行は 780s まで)。
  `=profile` 列は終了時点の値で**フリーズする**。
  **解析・偏差計算は必ず `t ≤ !roast_end` に限定する**(ここを間違えると誤差が数℃出る)。

### 2.7 ⚠️ プライバシー

`.klog` は **機体シリアル番号**(`model:KN1007B/J/D240480798`)、`mains_voltage`、
`calibration_data`、`motor_hours` を含む。
本ツールは**ファイルをどこにも送信しない**のでそのままで問題ないが、
将来 §9 に反して共有機能を作る場合はここを伏せる必要がある。README にこの点を書く。

---

## 3. 観測にもとづく要件(推測ではなく、フォーラムの実際の投稿から)

英語圏コミュニティ(community.kaffelogic.com)を読んだ結果、
**設計カーブと実測のズレが、この機体の最頻トピックである**ことが確認できた。

スレッドタイトルの時点でそう:

- "Overshooting Profile Curve"(t=401)
- "Profile Overshoot Early in Roast"(t=535)
- "Huehuetenango shb ep keeps overshooting profile after CC"(t=563)
- "Initial Temp Too High"(t=454)
- "Deviations from Kaffelogic roast profiles"(CoffeeSnobs)
- "Need negative boost zone after FC starts?"(t=572)

### 3.1 拾えた具体的な要求

| # | 出典 | 要求・困りごと | 対応する機能 |
|---|---|---|---|
| R1 | t=368 | 「最初の1〜2分でプロファイルをかなりオーバーシュートする。**何を見て何を直せばいい?**」 | **F7** 偏差 |
| R2 | t=368 | 回答が「**2分くらいまでに収束していれば気にするな**」。つまり**収束時刻**が判断基準として使われている | **F7** 収束時刻 |
| R3 | t=368 | 「Steve's だと**両方とも1分くらいで150℃に達する**」— ユーザーは**特定温度の通過時刻**で語る | **F6** 温度基準 |
| R4 | t=376 | 「RoR の**専用の縦軸が欲しい**。Studio は倍率調整しかない」 | **F4** RoR 軸 |
| R5 | t=376(2名・2年越し) | 「**重量減少率(%)を自動計算してほしい**」「development ratio より total roast time / development time / weight loss が見たい」 | **F8**(P1) |
| R6 | t=655 | 「**自動終了が設定温度を超えて行き過ぎる**気がする」 | **F3/F8** 終了温度の実測表示 |
| R7 | t=34 | 「発展率の手計算が log の値と合わない」→ 公式回答が**移動平均の秒数の違い**だった | §2.3 を明記 |
| R8 | t=634 | 「Studio は**Level をプリセットのラジオボタンでしか動かせず**、赤い点をドラッグできない。不便」 | **F3** 連続 Level |
| R9 | t=655, 368 | **ログを貼って「これで合ってますか」と聞き、返事が来ない**投稿が複数 | ツールの存在価値そのもの |

### 3.2 手持ち35本で R1 が再現できている(デモ素材)

フォーラムの投稿者が使っていたのと**同じ `1500-2000m Rest` プロファイル**で、
同じ現象がこの vault のログに出ている:

| ログ | プロファイル | 最大オーバーシュート | その時刻 | ±3℃ 収束 |
|---|---|---|---|---|
| log0007 | 1500-2000m Rest | **+12.06℃** | 72s | 171s |
| log0008 | 1500-2000m Rest | **+12.59℃** | 70s | 165s |
| log0012 | 1500-2000m Rest | **+12.83℃** | 69s | 163s |
| log0013 | 1200-1500m RTD | **+14.97℃** | 69s | 234s |
| log0033 | Ninja_MaillardPlus | +4.16℃ | 65s | 288s |

**→ README とフォーラム告知文はこの図を使う。**「あなたが困っているアレが、これで見えます」。

---

## 4. 競合と差別化

| | BrewRoom(brewroom.dev) | BrewedLate | Kaffelogic Studio | **Overlay** |
|---|---|---|---|---|
| アカウント | **必須** | 必須 | 不要(デスクトップ) | **不要** |
| データ送信 | クラウド | クラウド | ローカル | **送信しない** |
| .kpro | ✅ 管理・生成・出力 | ✕ | ✅ 編集 | 表示・比較のみ |
| .klog | ✅ アップロード・記録 | ✅ + AI 提案 | ✅ 単体表示 | ✅ **重ねる** |
| **複数ログの重ね** | 「compare results」= 数値の並記 | ✕ | **✕(1本ずつ)** | ✅ |
| **温度基準の揃え直し** | ✕ | ✕ | ✕ | ✅ **唯一** |
| 守備範囲 | 在庫・ギャラリー・評価・共有 | 記録・AI 提案 | 設計・編集 | **解析のみ** |

**要点**: 競合2社は「焙煎の**日記**」を作っている。Studio は「**設計**」の道具。
**「焙煎ごとの curve を並べて読む」ところだけ、誰も埋めていない。**

> **Overlay is an instrument, not a diary.**

### 4.1 先行実装(参考)

- `flaper87/obsidian-kaffelogic-plugin` — `.klog` を読んで統計を Markdown 化。
  パースの前例はあるが、可視化はしていない。

---

## 5. 機能仕様

各機能に **受け入れ条件(AC)** を付ける。
**AC はすべて、実際にブラウザでファイルを読ませて確認すること。**
数値は本セッションで手計算検証済み。**この値と合わなければ実装が間違っている。**

---

### F1. `.klog` パーサ 【P0】

`src/lib/klog.ts` を新規作成。

```ts
export interface KlogEvent { key: string; t: number }

export interface RoastLog {
  fileName: string;
  /** 表示名: profile_file_name → profile_short_name → fileName の順で採用 */
  name: string;
  header: Record<string, string>;       // key:value ブロック
  events: KlogEvent[];
  /** t <= roastEnd に切り詰めていない全行(クーリング含む) */
  rows: number[][];
  firstCrack: number | null;            // !first_crack(無いことがある)
  roastEnd: number;                     // !roast_end
  endReason: number;                    // !roast_end_reason(0 = 正常)
  developmentPercent: number | null;    // !development_percent
  roastingLevel: number;                // roasting_level(実際に焼いた Level)
  roastLevels: number[];                // roast_levels(7値)
  /** ヘッダに含まれる設計カーブ。`.kpro` と同じ形に構造化 */
  design: KproProfile;
  /** 中断ログ判定: endReason !== 0 || roastEnd < 60 */
  aborted: boolean;
}
```

**AC-F1-1**: `log0033.klog` を読み込むと
`firstCrack=468.471` / `roastEnd=541.273` / `developmentPercent=13.4501` /
`roastingLevel=1.0` / `roastLevels=[205,215,218,226,231,235,241]` / `rows.length=776`。

**AC-F1-2**: `log0001.klog` を読み込むと `aborted=true`(`endReason=2`, `roastEnd=33.42`)、
`firstCrack=null`、`name` が `log0001.klog`(`profile_file_name` が空のため)。
**エラーにならず、警告バナー付きで読み込まれること。**

**AC-F1-3**: `log0007.klog` は `aborted=false` だが `firstCrack=null`。
1ハゼに依存する表示だけが「—」になり、他は正常に出ること。

**AC-F1-4**: `name` は `log0033` で `Ninja_MaillardPlus.kpro`。
`profile_short_name` の切り詰め値 `Ninja_MaillardPlu` を**使わない**こと。

---

### F2. 設計 vs 実測の重ね描き 【P0・最重要】

`.klog` 1本につき、**同じ色**で2本の線を描く。

| 線 | データ | スタイル |
|---|---|---|
| 実測 | `mean_temp`(idx 3) | 実線 2px |
| 設計 | **`=profile`(idx 4)** ※§2.4 | 同色・破線・opacity 0.5 |

- `.kpro` を単体で読んだ場合は、従来どおりベジェ再構成で1本(実線)。
- 表示範囲は `t ≤ roastEnd`。クーリング区間は描かない。
- `spot_temp` / `temp` はチェックボックスで追加表示できる(デフォルト OFF)。

**AC-F2-1**: `log0033.klog` を1本だけ読み込むと、**グラフに線が2本**出る
(実測=実線・設計=破線)。`.kpro` の追加読み込みは不要。

**AC-F2-2**: `t=240s` にホバーすると `mean=152.08` / `profile=155.09` が読める(±0.05℃)。
`t=360s` で `mean=183.08` / `profile=185.23`。

**AC-F2-3**: `log0033` のグラフ右端が `541s` 付近で終わっている(780s まで伸びていない)。

---

### F3. Level の扱いを直す 【P0】

**現状の不具合**(2026-08-14 実機確認済み):
`App.tsx` の `level` が全プロファイル共通の単一 state になっており、
`Ninja_SlowDev`(推奨2.5)と `Ninja_SlowDev_Light`(推奨1.0)が**両方 226.0℃**と表示される。
この2本は `roast_levels` が同一で **Level だけ変えて焼き分けた実験**なので、
現状のツールでは実験の肝が終了温度に出てこない。

さらに、共通 Level=3 では終了温度 226.0℃ が設計カーブの最高点を超えるため、
**終了点のドットが描かれない**(3本読ませてドットが1個しか出ないことを SVG 上で確認済み)。

**修正内容**:

1. Level は **プロファイル/ログごとに個別に持つ**。
2. 初期値:
   - `.klog` → **`roasting_level`**(実際に焼いた値)
   - `.kpro` → **`recommended_level`**(27本すべてに存在)
3. 各行にスライダー(0〜6, 0.1刻み)+ 数値入力。Studio のプリセット制約(R8)への回答。
4. 「**Sync all**」トグルで、従来どおり全体を1つの Level に揃えるモードも残す(デフォルト OFF)。
5. **終了温度は必ず水平の基準線としてグラフに引く。**
   §2.4(b) を修正しても、**27本中5本は推奨 Level の終了温度が設計カーブの最高点を超える**
   (`0-1200m Rest` / `1200-1500m Rest` / `1500-2000m RTD` / `2000-2700m RTD` / `Cupping`)。
   これは異常ではなく、機体が設計カーブの終端より先まで焼き続ける仕様のため。
   **カーブ上のドットは「引けるときだけ」引く。引けないときは水平線だけ残し、**
   Level パネルに `227.8°C — beyond curve peak 216.2°C` のように注記する。
   **無言で消さないこと**(現状の最大の分かりにくさ)。

**AC-F3-1**: `Rwanda_Nordic v2b` / `Ninja_SlowDev` / `Ninja_SlowDev_Light` の3本を読み込むと、
終了温度が **212.0℃ / 222.0℃ / 215.0℃** と**3本とも別の値**で出る
(現状は 212.0 / 226.0 / 226.0)。
※ 222.0℃ は `Ninja_SlowDev` の推奨 Level 2.5 の補間値
(`roast_levels[2]=218` と `[3]=226` の中点)。実際に焼いたのは Level 1.5 = 216.5℃。

**AC-F3-2**: 同じ3本で、§2.4(b) 修正後は終了点ドットが**3個とも**描かれる(現状は1個)。
`Ninja_SlowDev` のドットは t≈625s(修正前はカーブ最高点 220.0℃ < 222.0℃ で描けなかった)。

**AC-F3-3**: `log0030.klog`(`roasting_level=1.50`)を読むと Level 欄が `1.5`、
終了温度(target)が `216.5℃`。実測の `mean_temp@end` **216.16℃** が併記される。

**AC-F3-4**: `Cupping v1.0.kpro`(推奨 Level 2.0 → 212.0℃、カーブ最高点 210.8℃)を読むと、
**水平線は引かれ、ドットは無く、`beyond curve peak` の注記が出る。**

**AC-F3-5**: 「Sync all」を ON にして 3.0 にすると、AC-F3-1 の3本が
212.0 / 226.0 / 226.0 になり、Ninja 2本に範囲外の注記が出る。

---

### F4. RoR 表示 【P0】

R4(専用軸の要求)への回答。

- 右軸を **Fan / RoR / なし** の3択トグルにする(3軸同時は混むので出さない)。
- RoR は **`actual_ROR`(idx 6)をそのまま使う。自前で微分しない。**
- 単位は **℃/min**。
- 設計側の `profile_ROR`(idx 5)も同色・破線で重ねられる(チェックボックス)。
- `.kpro` 単体には RoR が無いので、RoR を選ぶと「requires a .klog」と表示。

**AC-F4-1**: `log0033.klog` で右軸を RoR にすると、
`t=240s` で `16.95`、`t=360s` で `13.71`、`t=420s` で `11.02`(±0.05)。

**AC-F4-2**: RoR 軸のレンジが実データから決まり、負値(終了後の降温)を描かない
(`t ≤ roastEnd` 制限が効いている)。

---

### F5. フェーズと基準点の表示 【P0】

グラフ上に縦線とラベルを出す。

| 点 | 定義 | 既定値 |
|---|---|---|
| **Dry end**(色変わり) | `mean_temp` が指定温度を**上向きに最初に横切る**時刻 | **150.0℃**(ユーザー変更可) |
| **First crack** | `!first_crack` の時刻。**手押しであることを UI に明記** | イベント値 |
| **Roast end** | `!roast_end` の時刻 | イベント値 |

`expect_colrchange` が非0なら Dry end の既定値に使う(サンプル27本ではすべて0)。

フェーズ長のテーブル:

```
Dry        = t(Dry end)
Maillard   = t(First crack) - t(Dry end)
Development= t(Roast end)   - t(First crack)
DTR        = Development / t(Roast end)
```

**AC-F5-1**: `log0033.klog` で
Dry end = **232.5s**、Maillard = **236s**、Development = **72.8s**、DTR = **13.45%**。
(vault の `log0033.md` frontmatter と一致する)

**AC-F5-2**: `log0032.klog` で Dry end = **225.9s**、Maillard = **196s**、
Development = **84.5s**、DTR = **16.68%**。

**AC-F5-3**: `log0007.klog`(FC 無し)では Maillard / Development / DTR が「—」になり、
Dry end(**138.1s**)と Roast end(515.2s)だけ出る。**クラッシュしないこと。**

**AC-F5-4**: First crack のラベルかツールチップに
「button press — see Align by temperature」相当の注意書きがある。

---

### F6. 温度基準アラインメント 【P0・差別化の核】

**これが Overlay を選ぶ理由。ここを削るなら公開しない。**

1ハゼは自動検出ではなく**ユーザーがボタンを押した時刻**が記録される。
豆の弾け方が変わると押す位置がずれ、メイラードと発展相の配分が実態と違って記録される。
複数ログを**指定温度の通過時刻**で揃え直すと、この歪みが消える。

**UI**: グラフ上部に Align セレクタ。

```
Align by:  ( ) Time (0 = roast start)      ← デフォルト
           ( ) First crack (button)
           ( ) Temperature [ 202.2 ] °C  on [ mean_temp ▾ ]
```

**仕様**:

- 各ログについて「基準線が指定温度を上向きに最初に横切る時刻」を求め、
  その時刻が **x=0** に来るよう時間軸を平行移動する。
- 設計カーブも**同じログの**シフト量で一緒に動かす(実測と設計の対応を壊さない)。
- 基準線は `mean_temp` / `temp` / `spot_temp` から選べる。**既定は `mean_temp`**。
  (Kaffelogic 公式は「終了時刻を秒単位で見たいなら temp か spot_temp」と言っているが、
   平滑が効いていて交差点が安定するのは `mean_temp`。既定はこちら。)
- **既定温度の決め方**: 最初に読み込んだログの `!first_crack` 時点の `mean_temp` を
  0.1℃ に丸めた値。`first_crack` が無ければ `expect_fc`、それも無ければ `200.0`。
- 指定温度に到達しないログは、**線を消さずに**「did not reach 202.2°C」と印を出す。
- 温度基準を選んでいる間、F5 のフェーズ表は
  **「button」列と「temperature」列を並べて出す**(どちらが本当かをユーザーが判断できるように)。

**AC-F6-1**: `log0032.klog` → `log0033.klog` の順に読み込み、Align by Temperature を選ぶと、
既定値が **202.2℃** に入る(log0032 の FC 時点 mean_temp)。

**AC-F6-2**: そのとき通過時刻が log0032 = **422.2s**、log0033 = **454.9s**(7:34.9)。

**AC-F6-3**: フェーズ表が下記になる(vault `Profiles/_klog/log0033.md` 本文の訂正値と一致):

| | button 基準 | temperature 基準(202.2℃) |
|---|---|---|
| log0032 Development | 84.5s | **84.5s** |
| log0033 Development | 72.8s | **86.4s** |
| log0033 Maillard | 236s | **222s** |

**AC-F6-4**: 基準線を `temp` に変えると log0033 の Development が **93.0s** に変わる
(= 基準線の選択が結果に効いていることの確認)。

**AC-F6-5**: `log0031.klog`(FC をほぼ 202.2℃ちょうどで押したログ)では
button 基準 92.9s / 温度基準 92.0s と**ほぼ差が出ない**
(= 手押しがうまくいった回では補正が効かないことの確認)。

---

### F7. 設計からの偏差(トラッキング) 【P0】

R1・R2 への直接の回答。

**表示A: 偏差カーブ**(メイングラフ下の小パネル、x 軸共有・高さ 120px 程度)

```
deviation(t) = mean_temp(t) - profile(t)      ※ t ≤ roastEnd
```

0 の水平線を引き、±3℃ の帯を薄く塗る。

**表示B: 数値サマリ**(ログごと1行)

| 項目 | 定義 |
|---|---|
| Max above | `deviation` の最大値と、その時刻 |
| Max below | 最小値と、その時刻 |
| **Converged** | **それ以降ずっと `|deviation| < 3℃` を保つ最初の時刻** |
| At end | `roastEnd` 時点の `deviation` |

- 立ち上がり(t < 30s)は豆が常温から始まるため必ず大きく下振れする。
  **サマリは `t ≥ 30s` の範囲で計算する。** 偏差カーブは 0s から描いてよい。
- しきい値 3℃ と開始 30s は定数として1箇所に置く(将来 UI 化できるように)。

**AC-F7-1**: `log0033.klog` で Max above = **+4.16℃ @ 65s**、
Max below = **−17.69℃ @ 31s**、Converged = **288s**、At end ≒ **+0.67℃**。

**AC-F7-2**: `log0007.klog` で Max above = **+12.06℃ @ 72s**、Converged = **171s**。
(= §3.2 のフォーラム再現ケース)

**AC-F7-3**: `.kpro` 単体では偏差パネルが出ない(実測が無いため)。

---

### F8. 焙煎サマリ 【P1】

R5(2名が2年越しで要求)と R6 への回答。ログごとのカード。

| 表示 | 出典 |
|---|---|
| Total roast time | `!roast_end` |
| Development time / DTR% | F5 |
| Level used | `roasting_level` |
| Target end temp | `roast_levels` × Level の補間 |
| **Actual end temp** | `mean_temp` の `roastEnd` 時点値 |
| **Δ (actual − target)** | 上2つの差 ← **R6 への回答** |
| **Weight loss %** | 投入 / 焼上 の数値入力2つ。`(in−out)/in×100` |

重量はファイルに無いのでユーザーが入力する。**保存はしない**(§9)。

**AC-F8-1**: `log0033.klog` で Target = **215.0℃** / Actual = **214.45℃** / Δ = **−0.55℃**。

**AC-F8-2**: 100 → 87.6 を入力すると Weight loss = **12.4%**。

---

### F9. 英語 UI + 日本語トグル 【P0】

- 全 UI 文字列を `src/i18n/en.ts` / `src/ja.ts` に外出しし、`t('key')` で引く。
- **既定は英語。** 右上に `EN / 日本語` トグル。
- 選択は `localStorage` に保存してよい(これは設定であってデータではない)。
- 温度・時刻の書式は両言語共通(`214.5°C` / `7:34.9`)。

**AC-F9-1**: 初回アクセスで全 UI が英語。ハードコードされた日本語が1つも残っていない。

**AC-F9-2**: 日本語に切り替えると全ラベルが日本語になり、リロード後も維持される。

---

### F10. 公開整備 【P0】

- `package.json`: `"private": false`、`name` を `roast-overlay`、`description` を英語に。
- **LICENSE: MIT**(ファイルを置く)。
- `README.md` を**英語**で書き直す。含めるもの:
  - 1行の説明とスクリーンショット(§3.2 のオーバーシュート図)
  - **「Your files never leave your browser. No account, no upload.」**
  - `.klog` にシリアル番号等が含まれる旨(§2.7)と、それでも安全な理由
  - `.kpro` 単体表示は最初の1分が近似である旨(§2.4)
  - 日本語の説明への導線
- `index.html` の `<title>` / `<meta description>` を英語に
  (検索で拾わせる主戦場はここ。`Kaffelogic` の語は説明文には入れてよいが、
  **プロダクト名・ドメインには使わない**)。

**AC-F10-1**: `npm run build` が通り、`dist/` を静的配信して全機能が動く。

---

## 6. UI 構成

```
┌────────────────────────────────────────────────────────┐
│ Overlay          See your roast against its design.  [EN|日本語] │
│ Your files never leave your browser.                   │
├────────────────────────────────────────────────────────┤
│  Drop .kpro / .klog files here (or click)              │  ← accept を両方に
├────────────────────────────────────────────────────────┤
│ Loaded                                                 │
│  ● log0032  [👁][×]   ● log0033  [👁][×]                │  ← 中断ログには ⚠
├────────────────────────────────────────────────────────┤
│ Align by: (•)Time ( )First crack ( )Temp [202.2]°C     │  ← F6
│           on [mean_temp ▾]                             │
│ Right axis: (•)Fan ( )RoR ( )None    ☑Zones ☑Design    │  ← F4
│ ┌────────────────────────────────────────────────────┐ │
│ │                                                    │ │
│ │            メイングラフ(温度 × 時間)               │ │
│ │            実線=実測 / 破線=設計                    │ │
│ │            縦線 = Dry end / FC / End               │ │  ← F5
│ └────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Deviation (actual − design)      ±3℃ band         │ │  ← F7
│ └────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ Roast level                                            │  ← F3
│  log0032  [====|====] 1.0   215.0°C  (actual 214.6)    │
│  log0033  [====|====] 1.0   215.0°C  (actual 214.5)    │
│  ☐ Sync all                                            │
├────────────────────────────────────────────────────────┤
│ Phases            button    temperature (202.2°C)      │  ← F5 + F6
│  log0032 Dry       226s        226s                    │
│          Maillard  196s        196s                    │
│          Dev       84.5s       84.5s                   │
│  log0033 Dry       232s        232s                    │
│          Maillard  236s        222s                    │
│          Dev       72.8s       86.4s                   │
├────────────────────────────────────────────────────────┤
│ Summary   time / dev / DTR / level / end Δ / weight    │  ← F8 (P1)
├────────────────────────────────────────────────────────┤
│ Profile settings (scalar diff)   ※既存の DiffTable      │  ← 維持
└────────────────────────────────────────────────────────┘
```

**レイアウト規則**

- 既存のダークテーマ・`PALETTE`(`src/lib/palette.ts`)をそのまま使う。
- 1ログ = 1色。実測と設計は**同色**で、破線かどうかで区別する。
- 横軸は現行の固定 600s をやめ、**読み込んだログの最大 `roastEnd` + 30s** に自動調整する
  (Align by Temperature のときは負の時間も出るので `[min−30, max+30]`)。
- 縦軸は現行どおり 0〜250℃ 固定でよい。

---

## 7. 実装順序

上から順に。**1機能 = 1コミット。**

| # | 機能 | 依存 | 目安 |
|---|---|---|---|
| 0 | **§2.4(b) `buildCurve()` の最終セグメント追加** | — | 数行。**先に入れる**(F3 の AC がこれに依存) |
| 1 | **F1** `.klog` パーサ | — | ここが全部の土台 |
| 2 | **F3** Level を個別化 | 0 | 独立して先に潰せる。既存バグ修正 |
| 3 | **F2** 設計 vs 実測の重ね | F1 | ここで「使える」ようになる |
| 4 | **F5** フェーズ・基準点 | F1 | |
| 5 | **F7** 偏差パネル | F2 | フォーラム需要 #1 |
| 6 | **F4** RoR 軸 | F1 | |
| 7 | **F6** 温度基準アラインメント | F5 | **差別化の核。ここまでで v1.0 の中身が揃う** |
| 8 | **F9** i18n | 全部 | 文字列が固まってから最後にやる |
| 9 | **F10** 公開整備 | 全部 | Session 3 |
| — | F8 サマリ | F5 | P1。7 まで終わってから |

---

## 8. 開発時のサンプル読み込み(Session 2 向けメモ)

Session 1 で、dev サーバー経由でサンプルを読ませるために
`.tmp-samples/`(2.6MB / .kpro 27本 + .klog 35本)をプロジェクト直下に置き、
`.gitignore` に追加済み。ブラウザから下記で読み込める(手作業のドラッグ不要):

```js
const names = ['log0032.klog', 'log0033.klog'];
const dt = new DataTransfer();
for (const n of names) {
  const r = await fetch('/.tmp-samples/' + encodeURIComponent(n));
  dt.items.add(new File([await r.blob()], n));
}
document.querySelector('input[type=file]').parentElement
  .dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
```

不要になったら `rm -rf .tmp-samples` してよい(vault が原本)。

---

## 9. やらないことリスト

**思いついても作らない。作りたくなったら止めて聞く。**

| やらない | 理由 |
|---|---|
| **アカウント・ログイン・サーバー** | 「送信しない」が競合2社に対する最大の差。壊した瞬間に売りが消える |
| **クラウド保存・焙煎履歴の永続化** | 同上。日記は BrewRoom / BrewedLate の領分(§4) |
| **AI による改善提案** | BrewedLate が既にやっている。後追いになる |
| **豆の在庫管理・テイスティングノート・写真** | BrewRoom の領分。Overlay は計測器であって日記ではない |
| **`.kpro` の編集・生成・書き出し** | Kaffelogic Studio の領分。**互換性の責任を負いたくない** |
| **プロファイル自動生成・最適化** | 同上 |
| **1ハゼの自動検出** | 音がログに無い。温度基準(F6)で回避するのが本仕様の立場 |
| **Artisan / Cropster 形式の対応** | v1.0 では Kaffelogic に集中する。増やすのは反応を見てから |
| **共有 URL・パーマリンク** | §2.7 のシリアル番号が漏れる。設計から外す |
| **PDF ログの読み込み** | フォーラムに PDF 添付は見かけるが、パースの労力に見合わない |
| **ベジェ再構成の完全一致を追う** | §2.4(b) の最終セグメント追加**だけ**やる。先頭セグメントの補完は試して**効果なしと確認済み**。`.klog` があれば `=profile` 列で解決する。**それ以上は深追い禁止** |
| **モバイル最適化** | ファイルをドロップして曲線を読む道具。デスクトップ前提でよい |
| **テストの網羅** | AC をブラウザで確認すればよい。ただし F1 パーサだけは単体テストを書いてよい |

---

## 10. 参考資料

### 一次資料(このセッションで読んだもの)

- community.kaffelogic.com t=34 — **移動平均の秒数に関する Kaffelogic 公式回答**(§2.3)
- community.kaffelogic.com t=368 — オーバーシュートと「何を見ればいいか」(R1/R2/R3)
- community.kaffelogic.com t=376 — RoR 専用軸・重量減少率の要求(R4/R5)
- community.kaffelogic.com t=634 — Level がプリセットでしか動かせない不便(R8)
- community.kaffelogic.com t=655 — 終了温度の行き過ぎ・返事の来ない質問(R6/R9)
- brewroom.dev / brewedlate.com — 競合(§4)

### vault 側

- `~/Obsidian/brain/Projects/Kaffelogic焙煎修行/Profiles/_kpro/`(.kpro 27本)
- `~/Obsidian/brain/Projects/Kaffelogic焙煎修行/Profiles/_klog/`(.klog 35本 + .md 35本)
- `Profiles/_klog/log0033.md` **本文** — 温度基準アラインメントの一次資料(F6 の AC-F6-3)
- `Logs/00_この記録の前提.md` §3 — 温度基準の読者向け説明
- `Decisions.md` 2026-05-31 / 2026-08-14 — 公開判断の経緯

### 検算値の出どころ

本仕様の数値はすべて Session 1 で `.klog` を直接パースして算出し、
`_klog/*.md` の frontmatter および log0033.md 本文と突き合わせて一致を確認した。
**Session 2 は再計算せず、この値を正解として使ってよい。**
