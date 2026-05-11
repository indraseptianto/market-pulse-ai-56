import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type { Candle } from "@/lib/mock-data";
import type { IndicatorToggles } from "@/routes/chart";

export type ChartType = "candles" | "line" | "area" | "heikin";

type IndPoint = { time: number; [k: string]: number | string | null };

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:       "transparent",
  text:     "#94a3b8",
  grid:     "rgba(255,255,255,0.05)",
  border:   "rgba(255,255,255,0.08)",
  up:       "#10b981",
  down:     "#ef4444",
  upA:      "rgba(16,185,129,0.4)",
  downA:    "rgba(239,68,68,0.4)",
  blue:     "#38bdf8",
  blueA:    "rgba(56,189,248,0.3)",
  amber:    "#f59e0b",
  violet:   "#a78bfa",
  pink:     "#f472b6",
  teal:     "#2dd4bf",
  slate:    "#475569",
  slateA:   "rgba(148,163,184,0.6)",
  slateMid: "rgba(148,163,184,0.3)",
};

// ── Chart option factories ────────────────────────────────────────────────────
function mainOpts(hasVolume: boolean) {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: T.bg },
      textColor: T.text,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: 11,
    },
    grid: { vertLines: { color: T.grid }, horzLines: { color: T.grid } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: T.border,
      scaleMargins: { top: 0.06, bottom: hasVolume ? 0.20 : 0.04 },
    },
    timeScale: {
      borderColor: T.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 5,
    },
    handleScroll: true,
    handleScale: true,
  };
}

function subOpts() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: T.bg },
      textColor: T.text,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: 10,
    },
    grid: { vertLines: { color: T.grid }, horzLines: { color: T.grid } },
    rightPriceScale: { borderColor: T.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: {
      borderColor: T.border,
      timeVisible: false,
      secondsVisible: false,
      rightOffset: 5,
    },
    handleScroll: false,
    handleScale: false,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let pO = candles[0]?.open ?? 0, pC = candles[0]?.close ?? 0;
  for (const c of candles) {
    const haC = (c.open + c.high + c.low + c.close) / 4;
    const haO = out.length === 0 ? (c.open + c.close) / 2 : (pO + pC) / 2;
    out.push({ ...c, open: haO, close: haC, high: Math.max(c.high, haO, haC), low: Math.min(c.low, haO, haC) });
    pO = haO; pC = haC;
  }
  return out;
}

function toUTC(s: string): UTCTimestamp {
  return Math.floor(new Date(s).getTime() / 1000) as UTCTimestamp;
}

function dsToUTC(unix: number): UTCTimestamp {
  return (unix > 1e10 ? Math.floor(unix / 1000) : unix) as UTCTimestamp;
}

function pickNum(pt: IndPoint, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = pt[k];
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string" && v !== "") { const n = Number(v); if (isFinite(n)) return n; }
  }
  return null;
}

function addLine(
  chart: IChartApi,
  data: IndPoint[],
  keys: string[],
  color: string,
  lw: 1 | 2 = 1,
) {
  const s = chart.addSeries(LineSeries, { color, lineWidth: lw, priceLineVisible: false, lastValueVisible: false });
  s.setData(
    data
      .map((pt) => { const v = pickNum(pt, ...keys); return v != null ? { time: dsToUTC(pt.time), value: v } : null; })
      .filter((x): x is { time: UTCTimestamp; value: number } => x !== null),
  );
  return s;
}

// ── Sub-pane definitions ──────────────────────────────────────────────────────
// These are the indicator keys that get their own sub-chart below the main chart
const SUB_PANES: { key: keyof IndicatorToggles; label: string; height: number }[] = [
  { key: "rsi",        label: "RSI (14)",       height: 100 },
  { key: "macd",       label: "MACD (12,26,9)", height: 100 },
  { key: "adx",        label: "ADX (14)",       height: 100 },
  { key: "stochastic", label: "Stochastic",     height: 100 },
  { key: "cci",        label: "CCI (20)",       height: 100 },
  { key: "mfi",        label: "MFI (14)",       height: 100 },
  { key: "obv",        label: "OBV",            height: 100 },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function AdvancedChart({
  candles,
  type = "candles",
  indicators,
  indicatorData = {},
  height = 480,
}: {
  candles: Candle[];
  type?: ChartType;
  indicators: IndicatorToggles;
  indicatorData?: Record<string, IndPoint[]>;
  height?: number;
}) {
  const mainRef  = useRef<HTMLDivElement>(null);
  // Fixed refs for all possible sub-panes — never conditionally created
  const rsiRef   = useRef<HTMLDivElement>(null);
  const macdRef  = useRef<HTMLDivElement>(null);
  const adxRef   = useRef<HTMLDivElement>(null);
  const stochRef = useRef<HTMLDivElement>(null);
  const cciRef   = useRef<HTMLDivElement>(null);
  const mfiRef   = useRef<HTMLDivElement>(null);
  const obvRef   = useRef<HTMLDivElement>(null);

  const paneRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    rsi: rsiRef, macd: macdRef, adx: adxRef,
    stochastic: stochRef, cci: cciRef, mfi: mfiRef, obv: obvRef,
  };

  const display = useMemo(
    () => (type === "heikin" ? heikinAshi(candles) : candles),
    [candles, type],
  );

  useEffect(() => {
    if (!mainRef.current || display.length === 0) return;

    const ind = indicatorData;

    // ── Main chart ────────────────────────────────────────────────────────
    const chart = createChart(mainRef.current, mainOpts(indicators.volume));

    // Price series
    if (type === "line") {
      const s = chart.addSeries(LineSeries, { color: T.blue, lineWidth: 2 });
      s.setData(display.map((c) => ({ time: toUTC(c.time), value: c.close })));
    } else if (type === "area") {
      const s = chart.addSeries(AreaSeries, {
        topColor: T.blueA, bottomColor: "rgba(56,189,248,0)", lineColor: T.blue, lineWidth: 2,
      });
      s.setData(display.map((c) => ({ time: toUTC(c.time), value: c.close })));
    } else {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: T.up, downColor: T.down, wickUpColor: T.up, wickDownColor: T.down, borderVisible: false,
      });
      s.setData(display.map((c) => ({ time: toUTC(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));
    }

    // Volume
    if (indicators.volume) {
      const v = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol", color: T.slate });
      v.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      v.setData(display.map((c) => ({
        time: toUTC(c.time), value: c.volume,
        color: c.close >= c.open ? T.upA : T.downA,
      })));
    }

    // ── Overlay indicators ────────────────────────────────────────────────
    if (indicators.sma20  && ind.sma20?.length)  addLine(chart, ind.sma20,  ["sma", "value"], T.blue);
    if (indicators.sma50  && ind.sma50?.length)  addLine(chart, ind.sma50,  ["sma", "value"], T.amber);
    if (indicators.sma200 && ind.sma200?.length) addLine(chart, ind.sma200, ["sma", "value"], T.pink);
    if (indicators.ema20  && ind.ema20?.length)  addLine(chart, ind.ema20,  ["ema", "value"], T.violet);
    if (indicators.ema50  && ind.ema50?.length)  addLine(chart, ind.ema50,  ["ema", "value"], T.teal);

    if (indicators.bollinger && ind.bollinger?.length) {
      addLine(chart, ind.bollinger, ["upper"],          T.slateA);
      addLine(chart, ind.bollinger, ["middle", "basis"],T.slateMid);
      addLine(chart, ind.bollinger, ["lower"],          T.slateA);
    }

    if (indicators.vwap && ind.vwap?.length)
      addLine(chart, ind.vwap, ["vwap", "value"], T.teal, 2);

    if (indicators.supertrend && ind.supertrend?.length) {
      const bull: { time: UTCTimestamp; value: number }[] = [];
      const bear: { time: UTCTimestamp; value: number }[] = [];
      for (const pt of ind.supertrend) {
        const v = pickNum(pt, "supertrend", "value");
        const dir = pickNum(pt, "direction", "trend");
        if (v == null) continue;
        (dir === 1 ? bull : bear).push({ time: dsToUTC(pt.time), value: v });
      }
      if (bull.length) { const s = chart.addSeries(LineSeries, { color: T.up,   lineWidth: 2, priceLineVisible: false, lastValueVisible: false }); s.setData(bull); }
      if (bear.length) { const s = chart.addSeries(LineSeries, { color: T.down, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }); s.setData(bear); }
    }

    if (indicators.ichimoku && ind.ichimoku?.length) {
      addLine(chart, ind.ichimoku, ["tenkan",  "tenkanSen"],   T.amber);
      addLine(chart, ind.ichimoku, ["kijun",   "kijunSen"],    T.down);
      addLine(chart, ind.ichimoku, ["senkouA", "senkouSpanA"], "rgba(16,185,129,0.45)");
      addLine(chart, ind.ichimoku, ["senkouB", "senkouSpanB"], "rgba(239,68,68,0.45)");
    }

    if (indicators.atr && ind.atr?.length)
      addLine(chart, ind.atr, ["atr", "value"], "rgba(251,191,36,0.5)");

    chart.timeScale().fitContent();

    // ── Sub-charts ────────────────────────────────────────────────────────
    // Collect all sub-charts that actually get created
    const subCharts: IChartApi[] = [];

    const makeSubChart = (
      ref: React.RefObject<HTMLDivElement | null>,
      build: (c: IChartApi) => void,
    ) => {
      if (!ref.current) return;
      const c = createChart(ref.current, subOpts());
      build(c);
      // Fit to same logical range as main chart AFTER main has fitted
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) c.timeScale().setVisibleLogicalRange(range);
      subCharts.push(c);
    };

    if (indicators.rsi && ind.rsi?.length) {
      makeSubChart(rsiRef, (c) => {
        const s = addLine(c, ind.rsi, ["rsi", "value"], T.violet, 2);
        s.createPriceLine({ price: 70, color: "rgba(239,68,68,0.5)",  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
        s.createPriceLine({ price: 30, color: "rgba(16,185,129,0.5)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
      });
    }

    if (indicators.macd && ind.macd?.length) {
      makeSubChart(macdRef, (c) => {
        const hist = c.addSeries(HistogramSeries, { color: T.slate });
        hist.setData(
          ind.macd
            .map((pt) => { const v = pickNum(pt, "histogram", "hist"); return v != null ? { time: dsToUTC(pt.time), value: v, color: v >= 0 ? "rgba(16,185,129,0.6)" : "rgba(239,68,68,0.6)" } : null; })
            .filter((x): x is { time: UTCTimestamp; value: number; color: string } => x !== null),
        );
        addLine(c, ind.macd, ["macd",   "macdLine"],   T.blue,  2);
        addLine(c, ind.macd, ["signal", "signalLine"],  T.amber, 2);
      });
    }

    if (indicators.adx && ind.adx?.length) {
      makeSubChart(adxRef, (c) => {
        addLine(c, ind.adx, ["adx",     "value"],  T.blue,  2);
        addLine(c, ind.adx, ["plusDI",  "diPlus",  "+di"], T.up);
        addLine(c, ind.adx, ["minusDI", "diMinus", "-di"], T.down);
      });
    }

    if (indicators.stochastic && ind.stochastic?.length) {
      makeSubChart(stochRef, (c) => {
        addLine(c, ind.stochastic, ["k", "stochK", "%k"], T.blue,  2);
        addLine(c, ind.stochastic, ["d", "stochD", "%d"], T.amber, 1);
      });
    }

    if (indicators.cci && ind.cci?.length) {
      makeSubChart(cciRef, (c) => {
        const s = addLine(c, ind.cci, ["cci", "value"], T.amber, 2);
        s.createPriceLine({ price:  100, color: "rgba(239,68,68,0.5)",  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "+100" });
        s.createPriceLine({ price: -100, color: "rgba(16,185,129,0.5)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "-100" });
      });
    }

    if (indicators.mfi && ind.mfi?.length) {
      makeSubChart(mfiRef, (c) => {
        const s = addLine(c, ind.mfi, ["mfi", "value"], T.pink, 2);
        s.createPriceLine({ price: 80, color: "rgba(239,68,68,0.5)",  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "80" });
        s.createPriceLine({ price: 20, color: "rgba(16,185,129,0.5)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "20" });
      });
    }

    if (indicators.obv && ind.obv?.length) {
      makeSubChart(obvRef, (c) => {
        addLine(c, ind.obv, ["obv", "value"], T.teal, 2);
      });
    }

    // ── Bidirectional time-scale sync ─────────────────────────────────────
    // Main → all subs
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      subCharts.forEach((sub) => sub.timeScale().setVisibleLogicalRange(range));
    });
    // Each sub → main + other subs (prevents drift)
    subCharts.forEach((sub, i) => {
      sub.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range) return;
        chart.timeScale().setVisibleLogicalRange(range);
        subCharts.forEach((other, j) => {
          if (j !== i) other.timeScale().setVisibleLogicalRange(range);
        });
      });
    });

    return () => {
      chart.remove();
      subCharts.forEach((c) => c.remove());
    };
  }, [display, type, indicators, indicatorData]);

  return (
    <div className="flex flex-col gap-0">
      {/* Main chart */}
      <div ref={mainRef} style={{ width: "100%", height }} />

      {/* Sub-panes — ALL divs always rendered (hidden when inactive) so refs stay attached.
          This is critical: if a div unmounts, its ref becomes null and the chart can't be created. */}
      {SUB_PANES.map((pane) => {
        const isActive = indicators[pane.key] && (indicatorData[pane.key]?.length ?? 0) > 0;
        return (
          <div
            key={pane.key}
            className="mt-1"
            style={{ display: isActive ? "block" : "none" }}
          >
            <div className="flex items-center gap-2 border-t border-border/30 px-1 py-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {pane.label}
              </span>
            </div>
            <div
              ref={paneRefs[pane.key] as React.RefObject<HTMLDivElement>}
              style={{ width: "100%", height: pane.height }}
            />
          </div>
        );
      })}
    </div>
  );
}
