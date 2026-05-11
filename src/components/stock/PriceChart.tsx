import { useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import type { Candle } from "@/lib/mock-data";

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? +(sum / period).toFixed(2) : null);
  }
  return out;
}

export function PriceChart({
  candles,
  fairPrice,
}: {
  candles: Candle[];
  fairPrice?: number | null;
}) {
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);

  const data = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const s20 = sma(closes, 20);
    const s50 = sma(closes, 50);
    return candles.map((c, i) => ({
      date: c.time,
      price: c.close,
      sma20: s20[i],
      sma50: s50[i],
    }));
  }, [candles]);

  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const positive = last >= first;
  const stroke = positive ? "var(--color-success)" : "var(--color-destructive)";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button
          onClick={() => setShowSMA20((v) => !v)}
          className={`rounded-full border px-2 py-0.5 transition ${
            showSMA20
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border/50 text-muted-foreground"
          }`}
        >
          SMA 20
        </button>
        <button
          onClick={() => setShowSMA50((v) => !v)}
          className={`rounded-full border px-2 py-0.5 transition ${
            showSMA50
              ? "border-warning/50 bg-warning/10 text-warning"
              : "border-border/50 text-muted-foreground"
          }`}
        >
          SMA 50
        </button>
        {fairPrice ? (
          <span className="ml-auto rounded-full border border-border/50 px-2 py-0.5 text-muted-foreground">
            Fair Value: <span className="text-foreground num">{fairPrice.toLocaleString()}</span>
          </span>
        ) : null}
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="line" />
            <Area
              type="monotone"
              dataKey="price"
              name="Price"
              stroke={stroke}
              strokeWidth={2}
              fill="url(#px)"
            />
            {showSMA20 && (
              <Line
                type="monotone"
                dataKey="sma20"
                name="SMA 20"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            {showSMA50 && (
              <Line
                type="monotone"
                dataKey="sma50"
                name="SMA 50"
                stroke="var(--color-warning)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            )}
            {fairPrice ? (
              <ReferenceLine
                y={fairPrice}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="2 4"
                label={{
                  value: "Fair",
                  fill: "var(--color-muted-foreground)",
                  fontSize: 10,
                  position: "right",
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
