// ベジェ展開・時間グリッドへのリサンプリング・Level 補間

import type { BezierSegment, CurveData, Point } from './kpro';

/** 3 次ベジェ 1 軸の値を t∈[0,1] で評価 */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evalSegment(seg: BezierSegment, t: number): Point {
  return {
    t: cubic(seg.start.t, seg.cp1.t, seg.cp2.t, seg.end.t, t),
    v: cubic(seg.start.v, seg.cp1.v, seg.cp2.v, seg.end.v, t),
  };
}

/**
 * カーブを密なポリラインに展開する。
 * 各セグメントを stepsPerSeg 分割。時間方向に概ね単調増加する点列を返す。
 */
export function expandCurve(curve: CurveData, stepsPerSeg = 60): Point[] {
  const pts: Point[] = [];
  if (curve.segments.length === 0) {
    // セグメントが無くてもアンカーが 1 点でもあれば返す
    return [...curve.anchors];
  }
  curve.segments.forEach((seg, si) => {
    const start = si === 0 ? 0 : 1; // 連結点の重複を避ける
    for (let k = start; k <= stepsPerSeg; k++) {
      pts.push(evalSegment(seg, k / stepsPerSeg));
    }
  });
  return pts;
}

/**
 * 密ポリライン上で、指定時間 t における値を線形補間で得る。
 * t が範囲外なら null(チャートで線を途切れさせる)。
 */
export function valueAtTime(poly: Point[], t: number): number | null {
  if (poly.length === 0) return null;
  if (t < poly[0].t || t > poly[poly.length - 1].t) return null;
  // poly は時間昇順前提。二分探索でも良いが規模が小さいので線形。
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return a.v;
      const f = (t - a.t) / (b.t - a.t);
      return a.v + f * (b.v - a.v);
    }
  }
  return poly[poly.length - 1].v;
}

/**
 * 密ポリライン上で、指定温度 value に最初に到達する時間を返す。
 * 終了温度(止める点)をグラフ上に打つために使う。範囲外なら null。
 */
export function timeAtValue(poly: Point[], value: number): number | null {
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const lo = Math.min(a.v, b.v);
    const hi = Math.max(a.v, b.v);
    if (value >= lo && value <= hi) {
      if (b.v === a.v) return a.t;
      const f = (value - a.v) / (b.v - a.v);
      return a.t + f * (b.t - a.t);
    }
  }
  return null;
}

/**
 * roast_levels(Level 0..6 の終了温度 7 値)から、
 * 指定 Level(0.1 刻み)の終了温度を線形補間。
 * Level は焙煎度の絶対値ではなく「テーブルから終了温度を選ぶインデックス」。
 */
export function levelToTemp(roastLevels: number[], level: number): number | null {
  if (roastLevels.length === 0) return null;
  const maxIdx = roastLevels.length - 1;
  const L = Math.max(0, Math.min(maxIdx, level));
  const i = Math.floor(L);
  if (i >= maxIdx) return roastLevels[maxIdx];
  const frac = L - i;
  return roastLevels[i] + frac * (roastLevels[i + 1] - roastLevels[i]);
}
