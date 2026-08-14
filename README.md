# Overlay

**See your roast against its design.**

Overlay is a browser tool for Kaffelogic roasters. Drop in a `.klog` (a
recorded roast) and it overlays the actual temperature curve on top of the
design curve the machine was following — same graph, same color, solid vs.
dashed. Drop in several roasts and it aligns them by a chosen bean
temperature instead of the first-crack button press, so you can compare
roasts fairly even when the button was pressed a few seconds early or late.

**Your files never leave your browser. No account, no upload.** Overlay is a
static site — parsing, charting, and comparison all happen client-side. There
is no server component and nothing is ever sent anywhere.

## Why

Kaffelogic's own community forum's most common thread is some version of
"my roast overshoots the design curve in the first minute or two — is that
normal, what do I do about it?" Loading a real example roast (`1500-2000m
Rest`) into Overlay shows exactly that pattern:

- Actual temperature peaks **+12.06°C above the design curve at 1:12** into
  the roast.
- It settles back within a ±3°C band by **2:51**.
- By roast end the deviation is back down to **-0.09°C**.

Overlay's deviation panel computes those three numbers (max overshoot, when
it converges, where it lands) for every roast you load, so "is this
overshoot normal" becomes something you can read off a chart instead of
guessing.

The second, more specific problem: **first crack is a button a human
presses**, and how fast the beans pop changes exactly when that button gets
pressed. Two roasts of the same profile, pressed a few seconds apart, get
their Maillard/Development split computed differently even though the beans
did almost the same thing. Overlay's *Align by temperature* mode aligns
roasts by the moment each one crosses a chosen bean temperature instead of
the button press, and shows both the button-based and temperature-based
Development/DTR numbers side by side so you can see how much the button
timing actually mattered.

## What it does

- **Design vs. actual overlay** — load a `.klog` and see the measured curve
  (solid) and the design curve the machine was following (dashed), same
  color, one graph. `.kpro` files (design only, no roast data) render as a
  single reconstructed curve.
- **Multiple roasts, one graph** — load several `.klog`/`.kpro` files and
  compare them directly, each in its own color.
- **Align by temperature** — the differentiator. Shift each roast's time
  axis so a chosen reference temperature (default: `mean_temp`) lands at
  x = 0, instead of roast start or the first-crack button press. The design
  curve shifts with it, so the actual-vs-design relationship stays intact.
- **Deviation tracking** — a small panel under the main chart plots
  `actual − design` over time, with a ±3°C band and a summary (max
  overshoot/undershoot and when, when it converges, deviation at roast end).
- **Phases** — Dry end / Maillard / Development / DTR, computed both the
  button way and the temperature way when temperature alignment is active.
- **Level, per roast** — each loaded file gets its own Level slider
  (0–6, roast_levels-interpolated end temperature), so profiles roasted at
  different levels don't get flattened into one shared value. A "Sync all"
  toggle restores the old shared-Level behavior when you want it.
- **RoR** — actual rate-of-rise, read straight from the log's own
  `actual_ROR` column (not re-derived), with an optional design-RoR overlay.
- **Scalar diff table** — preheat/PID/zone settings side by side, with
  differences from the first-loaded file highlighted.

## Usage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ — deploy anywhere (GitHub Pages, Cloudflare Pages, S3, …)
```

Drag `.kpro` and/or `.klog` files onto the drop zone (or click to pick
files). Everything else — parsing, charting, alignment, comparison — happens
in the browser tab.

## A note on privacy

A `.klog` file includes information about the specific roaster that produced
it: a machine serial number (`model:KN1007B/...`), mains voltage,
calibration data, and motor hours. Overlay reads that data only to render
the roast (nothing about it is displayed beyond what feeds the charts) and,
as above, never transmits any file anywhere — so loading your own logs is
safe. If a future version of Overlay ever added a "share this roast" link or
export, that machine-identifying data would need to be stripped first; as of
this version, no such feature exists.

## A note on accuracy: `.kpro` vs. `.klog`

When you load a `.klog`, the design line comes straight from the log's own
`=profile` column — the exact curve the machine itself computed and
followed, not a reconstruction. It's exact.

When you load a bare `.kpro` (a profile with no associated roast), there is
no such recorded column, so Overlay reconstructs the design curve from the
profile's stored control points using cubic Béziers. That reconstruction
matches the machine's own curve closely from about the 60-second mark
onward (average error ≤0.5°C), but is measurably less accurate in the first
minute (average error ~2.3°C, because the machine's own ramp-up logic before
the first anchor point isn't recoverable from the stored data). If you need
first-minute accuracy, load the `.klog` instead of the bare `.kpro`.

## 日本語をお使いの方へ

アプリ右上の **EN / 日本語** トグルで UI 全体を日本語に切り替えられます。
選択は端末に保存され、次回アクセス時も維持されます。仕様の詳細は
[`docs/SPEC.md`](docs/SPEC.md)(日本語)を参照してください。

## License

[MIT](LICENSE)
