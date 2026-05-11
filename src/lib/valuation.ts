// Lightweight fair-value heuristics blending Graham number, fair-PE,
// and book-value anchor. Returns a verdict plus components for the UI.

export type Verdict = "Undervalued" | "Fair Value" | "Overvalued" | "Insufficient Data";

export interface ValuationInput {
  price: number;
  eps?: number | null;
  book_value?: number | null;
  pe_ratio?: number | null;
  roe?: number | null;
  dividend_yield?: number | null;
  earnings_growth?: number | null;
}

export interface ValuationResult {
  verdict: Verdict;
  fairPrice: number | null; // blended
  upsidePct: number | null; // (fair - price) / price * 100
  components: {
    label: string;
    value: number | null;
    note?: string;
  }[];
  score: number; // -100..+100, positive = cheap
}

export function evaluateValuation(input: ValuationInput): ValuationResult {
  const { price, eps, book_value, pe_ratio, roe, dividend_yield, earnings_growth } = input;
  const components: ValuationResult["components"] = [];

  // 1. Graham Number = sqrt(22.5 * EPS * BV) — classic defensive value
  let graham: number | null = null;
  if (eps && book_value && eps > 0 && book_value > 0) {
    graham = +Math.sqrt(22.5 * eps * book_value).toFixed(2);
  }
  components.push({ label: "Graham Number", value: graham, note: "√(22.5 × EPS × BV)" });

  // 2. Fair PE multiple — anchored to ROE & growth (Lynch-ish), capped
  let fairPE: number | null = null;
  if (eps && eps > 0) {
    const growthAnchor = Math.min(
      Math.max((earnings_growth ?? 6) + (roe ? roe / 4 : 0), 5),
      28,
    );
    fairPE = +growthAnchor.toFixed(2);
  }
  const fairPEPrice = fairPE && eps ? +(fairPE * eps).toFixed(2) : null;
  components.push({
    label: "Fair PE Price",
    value: fairPEPrice,
    note: fairPE ? `Fair PE ≈ ${fairPE.toFixed(1)}×` : undefined,
  });

  // 3. Book value anchor (P/B = 1.5 baseline, +ROE bonus)
  let bvAnchor: number | null = null;
  if (book_value && book_value > 0) {
    const targetPB = Math.min(1.2 + (roe ? roe / 30 : 0), 4);
    bvAnchor = +(book_value * targetPB).toFixed(2);
  }
  components.push({ label: "Book-value Anchor", value: bvAnchor });

  // 4. Dividend support
  if (dividend_yield && dividend_yield > 0) {
    components.push({
      label: "Dividend Yield",
      value: dividend_yield,
      note: `${dividend_yield.toFixed(2)}%`,
    });
  }

  const blendValues = [graham, fairPEPrice, bvAnchor].filter(
    (v): v is number => v !== null && v > 0,
  );

  if (blendValues.length === 0) {
    return {
      verdict: "Insufficient Data",
      fairPrice: null,
      upsidePct: null,
      components,
      score: 0,
    };
  }
  const fairPrice = +(blendValues.reduce((a, b) => a + b, 0) / blendValues.length).toFixed(2);
  const upsidePct = +(((fairPrice - price) / price) * 100).toFixed(2);

  // PE sanity — penalize extreme PE
  let peAdj = 0;
  if (pe_ratio && pe_ratio > 0) {
    if (pe_ratio < 10) peAdj += 6;
    else if (pe_ratio > 30) peAdj -= 8;
    else if (pe_ratio > 20) peAdj -= 3;
  }
  const score = Math.max(-100, Math.min(100, +(upsidePct + peAdj).toFixed(1)));

  let verdict: Verdict;
  if (score >= 15) verdict = "Undervalued";
  else if (score <= -15) verdict = "Overvalued";
  else verdict = "Fair Value";

  return { verdict, fairPrice, upsidePct, components, score };
}
