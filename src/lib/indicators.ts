// Pure technical indicator calculations. Inputs/outputs are arrays aligned by index.

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0 || period <= 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i];
      if (i === period - 1) {
        prev = sum / period;
        out[i] = prev;
      }
      continue;
    }
    prev = values[i] * k + (prev as number) * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = 100 - 100 / (1 + (avgL === 0 ? 100 : avgG / avgL));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + (avgL === 0 ? 100 : avgG / avgL));
  }
  return out;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(values: number[], fast = 12, slow = 26, signalP = 9): MACDResult {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const macdLine = values.map((_, i) =>
    ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null,
  );
  // Signal: EMA of macdLine where defined
  const startIdx = macdLine.findIndex((v) => v != null);
  const sliced = startIdx >= 0 ? (macdLine.slice(startIdx) as number[]) : [];
  const sigSliced = ema(sliced, signalP);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  if (startIdx >= 0) {
    for (let i = 0; i < sigSliced.length; i++) signal[startIdx + i] = sigSliced[i];
  }
  const histogram = macdLine.map((v, i) =>
    v != null && signal[i] != null ? v - (signal[i] as number) : null,
  );
  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  middle: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

export function bollinger(values: number[], period = 20, stdMul = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = (middle[i] as number);
    const variance =
      slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + stdMul * sd;
    lower[i] = mean - stdMul * sd;
  }
  return { middle, upper, lower };
}

export function atr(
  high: number[],
  low: number[],
  close: number[],
  period = 14,
): (number | null)[] {
  const out: (number | null)[] = new Array(close.length).fill(null);
  if (close.length < 2) return out;
  const tr: number[] = [high[0] - low[0]];
  for (let i = 1; i < close.length; i++) {
    tr.push(
      Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1]),
      ),
    );
  }
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;
  for (let i = period; i < close.length; i++) {
    out[i] = ((out[i - 1] as number) * (period - 1) + tr[i]) / period;
  }
  return out;
}

export function stochastic(
  high: number[],
  low: number[],
  close: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): { k: (number | null)[]; d: (number | null)[] } {
  const raw: (number | null)[] = new Array(close.length).fill(null);
  for (let i = period - 1; i < close.length; i++) {
    // Use loop instead of spread operator to avoid RangeError on large arrays
    let h = -Infinity, l = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (high[j] > h) h = high[j];
      if (low[j] < l) l = low[j];
    }
    raw[i] = h === l ? 50 : ((close[i] - l) / (h - l)) * 100;
  }
  const rawNum = raw.map((v) => (v == null ? 0 : v));
  const k = sma(rawNum, smoothK);
  // mask leading nulls
  for (let i = 0; i < period - 1 + smoothK - 1; i++) k[i] = null;
  const kNum = k.map((v) => (v == null ? 0 : v));
  const d = sma(kNum, smoothD);
  for (let i = 0; i < period - 1 + smoothK - 1 + smoothD - 1; i++) d[i] = null;
  return { k, d };
}

export function vwap(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
): number[] {
  let cumPV = 0;
  let cumV = 0;
  return close.map((_, i) => {
    const tp = (high[i] + low[i] + close[i]) / 3;
    cumPV += tp * volume[i];
    cumV += volume[i];
    return cumV === 0 ? tp : cumPV / cumV;
  });
}

// Higher-level: produce a structured technical summary for AI / display.
export function technicalSummary(close: number[], high: number[], low: number[]) {
  const last = close[close.length - 1];
  const sma20 = sma(close, 20);
  const sma50 = sma(close, 50);
  const sma200 = sma(close, 200);
  const rsi14 = rsi(close, 14);
  const m = macd(close);
  const bb = bollinger(close, 20, 2);
  const atr14 = atr(high, low, close, 14);

  const lastRSI = lastNum(rsi14);
  const lastMACD = lastNum(m.macd);
  const lastSig = lastNum(m.signal);
  const lastHist = lastNum(m.histogram);
  const prevHist = m.histogram[m.histogram.length - 2] ?? null;
  const lastSMA20 = lastNum(sma20);
  const lastSMA50 = lastNum(sma50);
  const lastSMA200 = lastNum(sma200);
  const lastBBU = lastNum(bb.upper);
  const lastBBL = lastNum(bb.lower);
  const lastATR = lastNum(atr14);

  const trend =
    lastSMA20 != null && lastSMA50 != null && lastSMA200 != null
      ? lastSMA20 > lastSMA50 && lastSMA50 > lastSMA200
        ? "Strong Uptrend"
        : lastSMA20 < lastSMA50 && lastSMA50 < lastSMA200
          ? "Strong Downtrend"
          : lastSMA20 > lastSMA50
            ? "Uptrend"
            : "Downtrend"
      : "Neutral";

  const macdCross =
    lastMACD != null && lastSig != null
      ? lastMACD > lastSig
        ? "Bullish"
        : "Bearish"
      : "—";

  const histTurning =
    prevHist != null && lastHist != null
      ? lastHist > 0 && prevHist <= 0
        ? "Bullish crossover"
        : lastHist < 0 && prevHist >= 0
          ? "Bearish crossover"
          : null
      : null;

  const rsiState =
    lastRSI == null
      ? "—"
      : lastRSI > 70
        ? "Overbought"
        : lastRSI < 30
          ? "Oversold"
          : lastRSI > 50
            ? "Bullish"
            : "Bearish";

  // Score 0..100
  let score = 50;
  if (trend.includes("Strong Up")) score += 20;
  else if (trend.includes("Up")) score += 10;
  else if (trend.includes("Strong Down")) score -= 20;
  else if (trend.includes("Down")) score -= 10;
  if (macdCross === "Bullish") score += 8;
  if (macdCross === "Bearish") score -= 8;
  if (lastRSI != null) {
    if (lastRSI > 70) score -= 6;
    else if (lastRSI < 30) score += 6;
    else score += (lastRSI - 50) * 0.2;
  }
  if (histTurning === "Bullish crossover") score += 6;
  if (histTurning === "Bearish crossover") score -= 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const stance =
    score >= 70 ? "Bullish" : score >= 55 ? "Mildly Bullish" : score >= 45 ? "Neutral" : score >= 30 ? "Mildly Bearish" : "Bearish";

  // Support / resistance from last 60 bars
  const tail = close.slice(-60);
  const support = Math.min(...tail);
  const resistance = Math.max(...tail);

  return {
    last,
    trend,
    stance,
    score,
    macdCross,
    histTurning,
    rsiState,
    rsi: lastRSI,
    macd: lastMACD,
    signal: lastSig,
    sma20: lastSMA20,
    sma50: lastSMA50,
    sma200: lastSMA200,
    bbUpper: lastBBU,
    bbLower: lastBBL,
    atr: lastATR,
    support,
    resistance,
  };
}

function lastNum(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}
