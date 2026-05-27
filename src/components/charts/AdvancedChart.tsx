import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type UTCTimestamp,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type { Candle } from "@/lib/mock-data";
import type { IndicatorToggles } from "@/routes/chart";
import { getCandles } from "@/lib/datasectors.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ChartType = "candles" | "line" | "area" | "heikin";

type IndPoint = { time: number; [k: string]: number | string | null };

// ── Drawing types ─────────────────────────────────────────────────────────────
interface Drawing {
  id: string;
  type: "line" | "fibo" | "h-line" | "arrow";
  points: [UTCTimestamp, number][];
  color: string;
  width: number;
}

interface ChartTemplate {
  id: string;
  name: string;
  indicators: string[];
  overlays: string[];
  comparison: string[];
  timeframe: string;
}

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
  symbol,
}: {
  candles: Candle[];
  type?: ChartType;
  indicators: IndicatorToggles;
  indicatorData?: Record<string, IndPoint[]>;
  height?: number;
  symbol?: string;
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

  // ── Drawing Tools ────────────────────────────────────────────────────────────
  const [drawingMode, setDrawingMode] = useState<"none" | "line" | "fibo" | "h-line" | "arrow">("none");
  const [drawingColor, setDrawingColor] = useState("#f59e0b");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingPoints, setDrawingPoints] = useState<[UTCTimestamp, number][]>([]);

  // ── Chart Templates ───────────────────────────────────────────────────────────
  const [activeTemplate, setActiveTemplate] = useState("Default");
  const [savedTemplates, setSavedTemplates] = useState<ChartTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // ── Multi-Symbol Comparison ───────────────────────────────────────────────────
  const [comparisonTickers, setComparisonTickers] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<Record<string, { time: UTCTimestamp; value: number }[]>>({});
  const [compareInput, setCompareInput] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);

  // Comparison colors
  const COMP_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#2dd4bf", "#f59e0b"];
  // Drawing tool preset colors
  const DRAW_COLORS = ["#f59e0b", "#ef4444", "#10b981", "#38bdf8", "#a78bfa", "#f472b6"];

  // ── Load from localStorage on mount ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("stratum_chart_templates");
      if (saved) setSavedTemplates(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!symbol || typeof window === "undefined") return;
    try {
      const key = `stratum_drawings_${symbol}`;
      const saved = localStorage.getItem(key);
      if (saved) setDrawings(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [symbol]);

  // ── Persist drawings on change ────────────────────────────────────────────────
  useEffect(() => {
    if (!symbol || typeof window === "undefined") return;
    try {
      localStorage.setItem(`stratum_drawings_${symbol}`, JSON.stringify(drawings));
    } catch { /* ignore */ }
  }, [drawings, symbol]);

  // ── Persist templates on change ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("stratum_chart_templates", JSON.stringify(savedTemplates));
    } catch { /* ignore */ }
  }, [savedTemplates]);

  // ── Save drawing to state ────────────────────────────────────────────────────
  const finalizeDrawing = useCallback(
    (pts: [UTCTimestamp, number][]) => {
      if (pts.length < 1) return;
      const d: Drawing = {
        id: `d_${Date.now()}`,
        type: drawingMode === "none" ? "line" : drawingMode,
        points: pts,
        color: drawingColor,
        width: 1,
      };
      setDrawings((prev) => [...prev, d]);
      setDrawingPoints([]);
      setDrawingMode("none");
    },
    [drawingMode, drawingColor],
  );

  // ── Render drawings helper ────────────────────────────────────────────────────
  const renderDrawings = useCallback(
    (chart: IChartApi) => {
      drawings.forEach((d) => {
        if (d.type === "h-line" && d.points.length >= 1) {
          const price = d.points[0][1];
          const ser = chart.addSeries(LineSeries, {
            color: d.color, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
            lineStyle: 1,
          });
          const times = chart.timeScale().getVisibleRange();
          if (times) {
            const data = [
              { time: times.from as UTCTimestamp, value: price },
              { time: times.to as UTCTimestamp, value: price },
            ];
            ser.setData(data as any);
          }
        } else if (d.type === "fibo" && d.points.length >= 2) {
          const p1 = d.points[0], p2 = d.points[1];
          const diff = p2[1] - p1[1];
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((lvl) => p1[1] + diff * lvl);
          const start = Math.min(p1[0], p2[0]), end = Math.max(p1[0], p2[0]);
          levels.forEach((price) => {
            const ser = chart.addSeries(LineSeries, {
              color: d.color, lineWidth: 1,
              priceLineVisible: false, lastValueVisible: false,
            });
            ser.setData([
              { time: start, value: price },
              { time: end, value: price },
            ] as any);
          });
        } else if (d.points.length >= 1) {
          // line or arrow
          const ser = chart.addSeries(LineSeries, {
            color: d.color, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false,
          });
          ser.setData(
            d.points.map((pt) => ({ time: pt[0], value: pt[1] })) as any,
          );
        }
      });
    },
    [drawings],
  );

  // ── Add comparison ticker ─────────────────────────────────────────────────────
  const addComparison = useCallback(async () => {
    const ticker = compareInput.trim().toUpperCase();
    if (!ticker || comparisonTickers.includes(ticker) || comparisonTickers.length >= 5) return;
    setCompareLoading(true);
    try {
      const result = await getCandles({ data: { symbol: ticker, interval: "1D" } });
      const data = (result?.data ?? []) as Array<{ close: number; time: string | number }>;
      if (!data.length) { setCompareLoading(false); return; }
      const closes = data.map((c) => c.close as number);
      const base = closes[0];
      const normalized = closes.map((v, i) => ({
        time: toUTC(typeof data[i].time === "string" ? data[i].time : new Date((data[i].time as number) * 1000).toISOString()),
        value: ((v / base) - 1) * 100,
      }));
      setComparisonData((prev) => ({ ...prev, [ticker]: normalized }));
      setComparisonTickers((prev) => [...prev, ticker]);
      setCompareInput("");
    } catch { /* ignore */ } finally { setCompareLoading(false); }
  }, [compareInput, comparisonTickers]);

  const removeComparison = useCallback((ticker: string) => {
    setComparisonTickers((prev) => prev.filter((t) => t !== ticker));
    setComparisonData((prev) => { const n = { ...prev }; delete n[ticker]; return n; });
  }, []);

  // ── Clear all drawings ────────────────────────────────────────────────────────
  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setDrawingPoints([]);
  }, []);

  // ── Save template ─────────────────────────────────────────────────────────────
  const saveTemplate = useCallback(() => {
    if (!templateName.trim()) return;
    const tmpl: ChartTemplate = {
      id: `tpl_${Date.now()}`,
      name: templateName.trim(),
      indicators: Object.entries(indicators).filter(([, v]) => v).map(([k]) => k),
      overlays: [],
      comparison: comparisonTickers,
      timeframe: "1D",
    };
    setSavedTemplates((prev) => [...prev.filter((t) => t.name !== tmpl.name), tmpl]);
    setActiveTemplate(tmpl.name);
    setTemplateName("");
    setShowSaveTemplate(false);
  }, [templateName, indicators, comparisonTickers]);

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

    // ── Render saved drawings ─────────────────────────────────────────────────
    renderDrawings(chart);

    // ── Drawing interaction: click to place points ─────────────────────────────
    if (drawingMode !== "none") {
      chart.subscribeClick((param) => {
        if (!param.point || param.time === undefined) return;
        const price = param.seriesData.size > 0
          ? (param.seriesData.values().next().value as number | undefined)
          : undefined;
        if (price === undefined) return;
        const pt: [UTCTimestamp, number] = [param.time as UTCTimestamp, price];
        const pts = [...drawingPoints, pt];
        setDrawingPoints(pts);

        const need = drawingMode === "h-line" ? 1 : drawingMode === "fibo" ? 2 : 2;
        if (pts.length >= need) finalizeDrawing(pts);
      });
    }

    // ── Comparison lines (normalized %) ───────────────────────────────────────
    const compSeries: ISeriesApi<"Line">[] = [];
    comparisonTickers.forEach((ticker, idx) => {
      const data = comparisonData[ticker];
      if (!data?.length) return;
      const ser = chart.addSeries(LineSeries, {
        color: COMP_COLORS[idx % COMP_COLORS.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        visible: true,
      });
      ser.setData(data as any);
      compSeries.push(ser);
    });

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
  }, [display, type, indicators, indicatorData, drawingMode, drawingPoints, drawings, comparisonTickers, comparisonData, renderDrawings, finalizeDrawing]);

  // ── Toolbar ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* Main chart */}
      <div ref={mainRef} style={{ width: "100%", height, position: "relative" }}>
        {/* ── Floating toolbar ── */}
        <div
          className="absolute top-2 right-2 z-20 flex flex-col gap-2 rounded-lg border border-border/50 bg-background/90 p-2 shadow-sm backdrop-blur-sm"
          style={{ minWidth: 180 }}
        >
          {/* Drawing Tools */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Draw</span>
            <div className="flex flex-wrap gap-1">
              {(["line", "fibo", "h-line", "arrow"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={drawingMode === mode ? "default" : "outline"}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => { setDrawingMode(drawingMode === mode ? "none" : mode); setDrawingPoints([]); }}
                >
                  {mode === "h-line" ? "H-Line" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] text-muted-foreground" onClick={clearDrawings}>
                ✕
              </Button>
            </div>
          </div>

          {/* Drawing Colors */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Color</span>
            <div className="flex gap-1">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDrawingColor(c)}
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${drawingColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Chart Templates */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Template</span>
            {showSaveTemplate ? (
              <div className="flex gap-1">
                <Input
                  className="h-7 text-[10px]"
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveTemplate()}
                />
                <Button size="sm" className="h-7 text-[10px]" onClick={saveTemplate}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowSaveTemplate(false)}>✕</Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <select
                  className="flex-1 rounded border border-border bg-background px-1 py-1 text-[10px] text-foreground"
                  value={activeTemplate}
                  onChange={(e) => setActiveTemplate(e.target.value)}
                >
                  <option value="Default">Default</option>
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowSaveTemplate(true)}>+</Button>
              </div>
            )}
          </div>

          {/* Multi-Symbol Comparison */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Compare (max 5)</span>
            {comparisonTickers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {comparisonTickers.map((ticker, idx) => (
                  <span
                    key={ticker}
                    className="flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px]"
                    style={{ borderColor: COMP_COLORS[idx % COMP_COLORS.length], color: COMP_COLORS[idx % COMP_COLORS.length] }}
                  >
                    {ticker}
                    <button onClick={() => removeComparison(ticker)} className="ml-0.5 leading-none">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                className="h-7 text-[10px]"
                placeholder="Ticker…"
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComparison()}
                disabled={compareLoading}
              />
              <Button size="sm" className="h-7 text-[10px]" onClick={addComparison} disabled={compareLoading}>
                {compareLoading ? "…" : "+"}
              </Button>
            </div>
          </div>
        </div>
      </div>

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
