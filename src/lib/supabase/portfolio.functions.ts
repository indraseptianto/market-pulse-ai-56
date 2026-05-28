import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer, isSupabaseConfigured } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string | null;
  avgBuyPrice: number;
  totalLots: number;
  realizedPnL: number;
  dividendsReceived: number;
}

export interface Transaction {
  id: string;
  symbol: string;
  type: "BUY" | "SELL" | "DIV";
  lots: number;
  price: number;
  date: string;
  note: string | null;
}

// ── Validation schemas ─────────────────────────────────────────────────────────

const AddTransactionSchema = z.object({
  type: z.enum(["BUY", "SELL", "DIV"]),
  symbol: z.string().min(1).max(20),
  name: z.string().optional(),
  lots: z.number().positive(),
  price: z.number().nonnegative(),
  date: z.string(),
  note: z.string().optional(),
});

const DeletePositionSchema = z.object({
  symbol: z.string().min(1),
});

// ── Server Functions ──────────────────────────────────────────────────────────

/** Get all portfolio positions for authenticated user */
export const getPortfolioPositions = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase not configured", positions: [] };
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return { success: false, error: "Supabase client unavailable", positions: [] };
    }

    const { data: positions, error } = await supabase
      .from("portfolio_positions")
      .select("*")
      .eq("user_id", data.userId)
      .order("symbol");

    if (error) {
      return { success: false, error: error.message, positions: [] };
    }

    return {
      success: true,
      positions: (positions ?? []).map((p) => ({
        id: p.id,
        symbol: p.symbol,
        name: p.name,
        avgBuyPrice: Number(p.avg_buy_price),
        totalLots: Number(p.total_lots),
        realizedPnL: Number(p.realized_pnl),
        dividendsReceived: Number(p.dividends_received),
      })),
    };
  });

/** Add a transaction (BUY/SELL/DIV) and update position */
export const addTransaction = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof AddTransactionSchema>) => AddTransactionSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase not configured" };
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return { success: false, error: "Supabase client unavailable" };
    }

    // Get user from session (passed via data or context)
    // For now, require userId in data payload for SSR calls
    const userId = (data as { userId?: string; symbol: string }).userId;
    if (!userId) {
      return { success: false, error: "User not authenticated" };
    }

    const { symbol, type, lots, price, date, note } = data;

    // Insert transaction record
    const { error: txError } = await supabase.from("portfolio_transactions").insert({
      user_id: userId,
      symbol: symbol.toUpperCase(),
      type,
      lots,
      price,
      date,
      notes: note,
    });

    if (txError) {
      return { success: false, error: `Transaction insert failed: ${txError.message}` };
    }

    // Update or insert position
    const { data: existing } = await supabase
      .from("portfolio_positions")
      .select("*")
      .eq("user_id", userId)
      .eq("symbol", symbol.toUpperCase())
      .single();

    if (type === "BUY") {
      const newTotalLots = existing ? Number(existing.total_lots) + lots : lots;
      const newAvg = existing
        ? (Number(existing.avg_buy_price) * Number(existing.total_lots) + price * lots) / newTotalLots
        : price;

      if (existing) {
        await supabase
          .from("portfolio_positions")
          .update({
            total_lots: newTotalLots,
            avg_buy_price: newAvg,
            name: data.name || existing.name,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("portfolio_positions").insert({
          user_id: userId,
          symbol: symbol.toUpperCase(),
          name: data.name || symbol.toUpperCase(),
          avg_buy_price: newAvg,
          total_lots: newTotalLots,
        });
      }
    } else if (type === "SELL") {
      const pnl = (price - Number(existing?.avg_buy_price ?? price)) * lots * 100;
      if (existing) {
        await supabase
          .from("portfolio_positions")
          .update({
            total_lots: Math.max(0, Number(existing.total_lots) - lots),
            realized_pnl: Number(existing.realized_pnl) + pnl,
          })
          .eq("id", existing.id);
      }
    } else if (type === "DIV") {
      const divReceived = price * lots * 100;
      if (existing) {
        await supabase
          .from("portfolio_positions")
          .update({
            dividends_received: Number(existing.dividends_received) + divReceived,
          })
          .eq("id", existing.id);
      }
    }

    return { success: true };
  });

/** Delete a portfolio position */
export const deletePortfolioPosition = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof DeletePositionSchema>) => DeletePositionSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase not configured" };
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return { success: false, error: "Supabase client unavailable" };
    }

    const userId = (data as { userId?: string; symbol: string }).userId;
    if (!userId) {
      return { success: false, error: "User not authenticated" };
    }

    // Delete all transactions and position
    await supabase
      .from("portfolio_transactions")
      .delete()
      .eq("user_id", userId)
      .eq("symbol", data.symbol.toUpperCase());

    const { error } = await supabase
      .from("portfolio_positions")
      .delete()
      .eq("user_id", userId)
      .eq("symbol", data.symbol.toUpperCase());

    return { success: !error, error: error?.message };
  });

/** Get transaction history for a symbol or all */
export const getTransactionHistory = createServerFn({ method: "POST" })
  .validator((data: { userId: string; symbol?: string }) =>
    z.object({ userId: z.string().uuid(), symbol: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase not configured", transactions: [] };
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
      return { success: false, error: "Supabase client unavailable", transactions: [] };
    }

    let query = supabase
      .from("portfolio_transactions")
      .select("*")
      .eq("user_id", data.userId)
      .order("date", { ascending: false });

    if (data.symbol) {
      query = query.eq("symbol", data.symbol.toUpperCase());
    }

    const { data: transactions, error } = await query.limit(500);

    if (error) {
      return { success: false, error: error.message, transactions: [] };
    }

    return {
      success: true,
      transactions: (transactions ?? []).map((t) => ({
        id: t.id,
        symbol: t.symbol,
        type: t.type as "BUY" | "SELL" | "DIV",
        lots: Number(t.lots),
        price: Number(t.price),
        date: t.date,
        note: t.notes,
      })),
    };
  });