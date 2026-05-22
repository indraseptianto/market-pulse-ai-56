// Deterministic mock dataset (seeded RNG) so SSR & client render identical markup.

export interface Equity {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  market_cap: number;
  sector: string;
  industry?: string;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  roe?: number | null;
  roa?: number | null;
  debt_to_equity?: number | null;
  dividend_yield?: number | null;
  // Extended fundamentals
  eps?: number | null;
  book_value?: number | null;
  prev_close?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  high_52w?: number | null;
  low_52w?: number | null;
  beta?: number | null;
  shares_outstanding?: number | null;
  revenue_ttm?: number | null;
  net_income_ttm?: number | null;
}

const SECTORS = [
  "Financials",
  "Energy",
  "Consumer",
  "Technology",
  "Healthcare",
  "Industrials",
  "Materials",
  "Utilities",
  "Telecom",
  "Real Estate",
];

// Mulberry32 — small deterministic PRNG
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SEED = [
  ["BBCA", "Bank Central Asia", 9750, 1.32, "Financials"],
  ["BBRI", "Bank Rakyat Indonesia", 4720, -0.84, "Financials"],
  ["BMRI", "Bank Mandiri", 6325, 0.55, "Financials"],
  ["TLKM", "Telkom Indonesia", 3110, -1.45, "Telecom"],
  ["ASII", "Astra International", 5125, 2.18, "Industrials"],
  ["UNVR", "Unilever Indonesia", 2240, -0.32, "Consumer"],
  ["GOTO", "GoTo Gojek Tokopedia", 78, 4.82, "Technology"],
  ["BREN", "Barito Renewables", 8125, 6.21, "Energy"],
  ["ADRO", "Adaro Energy", 2810, 1.95, "Energy"],
  ["ANTM", "Aneka Tambang", 1850, -2.74, "Materials"],
  ["INCO", "Vale Indonesia", 4220, 0.89, "Materials"],
  ["MDKA", "Merdeka Copper Gold", 2620, 3.15, "Materials"],
  ["KLBF", "Kalbe Farma", 1545, -0.65, "Healthcare"],
  ["ICBP", "Indofood CBP", 11250, 0.18, "Consumer"],
  ["INDF", "Indofood Sukses Makmur", 6925, 0.72, "Consumer"],
  ["PGAS", "Perusahaan Gas Negara", 1640, -1.20, "Energy"],
  ["PTBA", "Bukit Asam", 2890, 2.35, "Energy"],
  ["SMGR", "Semen Indonesia", 4180, -0.95, "Materials"],
  ["UNTR", "United Tractors", 25450, 1.05, "Industrials"],
  ["EXCL", "XL Axiata", 2340, 0.43, "Telecom"],
  ["AMRT", "Sumber Alfaria Trijaya", 2810, -0.71, "Consumer"],
  ["MAPI", "Mitra Adiperkasa", 1605, 1.57, "Consumer"],
  ["JSMR", "Jasa Marga", 4520, -0.22, "Industrials"],
  ["BRIS", "Bank Syariah Indonesia", 2680, 0.93, "Financials"],
  ["BUKA", "Bukalapak.com", 124, -3.12, "Technology"],
  ["EMTK", "Elang Mahkota Teknologi", 525, 5.42, "Technology"],
  ["MEDC", "Medco Energi", 1240, 1.84, "Energy"],
  ["TINS", "Timah", 970, 4.05, "Materials"],
  ["WSKT", "Waskita Karya", 215, -2.95, "Industrials"],
  ["PWON", "Pakuwon Jati", 442, 0.68, "Real Estate"],
] as const;

export const mockEquities: Equity[] = SEED.map(([symbol, name, price, pct, sector]) => {
  const p = price as number;
  const c = pct as number;
  const r = rng(hashStr(symbol as string));
  const pe = +(8 + r() * 30).toFixed(2);
  const pb = +(0.5 + r() * 5).toFixed(2);
  const eps = +(p / pe).toFixed(2);
  const bv = +(p / pb).toFixed(2);
  const shares = Math.round(5e8 + r() * 8e10);
  const high52 = +(p * (1.05 + r() * 0.6)).toFixed(2);
  const low52 = +(p * (0.55 + r() * 0.35)).toFixed(2);
  return {
    symbol: symbol as string,
    name: name as string,
    price: p,
    change: +(p * (c / 100)).toFixed(2),
    change_pct: c,
    volume: Math.round(1_000_000 + r() * 80_000_000),
    market_cap: Math.round(p * shares),
    sector: sector as string,
    industry: sector as string,
    pe_ratio: pe,
    pb_ratio: pb,
    roe: +(2 + r() * 28).toFixed(2),
    roa: +(1 + r() * 18).toFixed(2),
    debt_to_equity: +(0.1 + r() * 2).toFixed(2),
    dividend_yield: +(r() * 7).toFixed(2),
    eps,
    book_value: bv,
    prev_close: +(p - p * (c / 100)).toFixed(2),
    day_high: +(p * (1 + r() * 0.015)).toFixed(2),
    day_low: +(p * (1 - r() * 0.015)).toFixed(2),
    high_52w: high52,
    low_52w: low52,
    beta: +(0.5 + r() * 1.4).toFixed(2),
    shares_outstanding: shares,
    revenue_ttm: Math.round(p * shares * (0.15 + r() * 0.6)),
    net_income_ttm: Math.round(p * shares * (0.02 + r() * 0.12)),
  };
});

export const mockSectors = SECTORS.map((name, i) => {
  const r = rng(hashStr("sector:" + name));
  return {
    name,
    change_pct: +((r() - 0.45) * 4).toFixed(2),
    market_cap: Math.round(1e11 + r() * 9e11) + i,
  };
});

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const mockCandles = (basePrice = 5000, days = 90, seedKey = "candles"): Candle[] => {
  const r = rng(hashStr(`${seedKey}:${basePrice}:${days}`));
  const out: Candle[] = [];
  let prev = basePrice * 0.9;
  // Anchor end date deterministically (today UTC date) — drop time portion
  const today = new Date();
  const anchor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let i = days; i >= 0; i--) {
    const drift = (r() - 0.48) * basePrice * 0.025;
    const open = prev;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) * (1 + r() * 0.012);
    const low = Math.min(open, close) * (1 - r() * 0.012);
    out.push({
      time: new Date(anchor - i * 86400000).toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.round(1e6 + r() * 5e7),
    });
    prev = close;
  }
  const lastClose = out[out.length - 1]?.close ?? basePrice;
  const scale = lastClose > 0 ? basePrice / lastClose : 1;
  return out.map((c, i) => ({
    ...c,
    open: +(c.open * scale).toFixed(2),
    high: +(c.high * scale).toFixed(2),
    low: +(c.low * scale).toFixed(2),
    close: i === out.length - 1 ? +basePrice.toFixed(2) : +(c.close * scale).toFixed(2),
  }));
};

export const findMockEquity = (symbol: string): Equity | undefined =>
  mockEquities.find((e) => e.symbol.toUpperCase() === symbol.toUpperCase());
