import { useMemo } from "react";

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

interface IndicatorChartProps {
  candles: Candle[];
  indicator: string;
  className?: string;
}

// Simple indicator computation (client-side fallback)
function computeSMA(prices: number[], period: number): number[] {
  return prices.map((_, i) => {
    if (i < period - 1) return prices[i];
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return sum / period;
  });
}

function computeEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeRSI(prices: number[], period: number): number[] {
  const rsi: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) { rsi.push(50); continue; }
    let gain = 0, loss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j] - prices[j - 1];
      if (diff > 0) gain += diff;
      else loss -= diff;
    }
    const avgGain = gain / period;
    const avgLoss = loss / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

export function IndicatorChart({ candles, indicator, className }: IndicatorChartProps) {
  const prices = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const indicatorData = useMemo(() => {
    const ind = indicator.toUpperCase();
    switch (ind) {
      case "SMA": return computeSMA(prices, 20);
      case "EMA": return computeEMA(prices, 12);
      case "RSI": return computeRSI(prices, 14);
      case "MACD": return computeEMA(prices, 12); // simplified
      case "BB": return computeSMA(prices, 20); // simplified
      case "ATR": return computeSMA(prices.map((_, i) => i > 0 ? Math.max(highs[i] - lows[i], Math.abs(highs[i] - prices[i-1]), Math.abs(lows[i] - prices[i-1])) : 0), 14);
      default: return prices;
    }
  }, [candles, indicator, prices, highs, lows]);

  const min = Math.min(...indicatorData);
  const max = Math.max(...indicatorData);
  const range = max - min || 1;

  const width = 400;
  const height = 120;
  const points = indicatorData.slice(-60).map((v, i) => {
    const x = (i / (Math.min(indicatorData.length, 60) - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const lastVal = indicatorData[indicatorData.length - 1];

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {indicator} — Last: {typeof lastVal === "number" ? lastVal.toFixed(2) : "—"}
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-blue-400"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
