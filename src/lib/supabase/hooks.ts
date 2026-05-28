import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, getSupabaseBrowser, isSupabaseConfigured } from "./client";
import { addTransaction, getPortfolioPositions, getTransactionHistory, deletePortfolioPosition } from "./portfolio.functions";
import type { PortfolioPosition, Transaction } from "./portfolio.functions";

// ── Types for hook return ──────────────────────────────────────────────────────

export interface UsePortfolioOptions {
  userId?: string | null;
  /** If false, falls back to localStorage (default: true) */
  useSupabase?: boolean;
}

export interface PortfolioStore {
  positions: PortfolioPosition[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface TransactionResult {
  success: boolean;
  error?: string;
}

// ── Hook: Portfolio Store (Supabase or localStorage fallback) ──────────────────

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const { userId, useSupabase = true } = options;
  const queryClient = useQueryClient();

  // Check if we should use Supabase
  const useSb = useSupabase && isSupabaseConfigured() && !!userId;

  // ── Load from localStorage (fallback) ────────────────────────────
  const [localPositions, setLocalPositions] = useState<PortfolioPosition[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || useSb) return;
    try {
      const raw = localStorage.getItem("stratum_portfolio");
      setLocalPositions(raw ? JSON.parse(raw) : []);
    } catch {
      setLocalError("Failed to load portfolio");
    }
  }, [useSb]);

  // ── Supabase Query ──────────────────────────────────────────────
  const {
    data: supabaseData,
    isLoading: sbLoading,
    error: sbError,
    refetch: sbRefetch,
  } = useQuery({
    queryKey: ["portfolio", userId],
    queryFn: async () => {
      const result = await getPortfolioPositions({ data: { userId: userId! } });
      return result;
    },
    enabled: !!useSb && !!userId,
    staleTime: 30_000,
    retry: 1,
  });

  // ── Compute combined state ─────────────────────────────────────
  const positions = useSb
    ? (supabaseData?.positions ?? [])
    : localPositions;

  const isLoading = useSb ? sbLoading : false;
  const error = useSb
    ? (sbError ? String(sbError) : supabaseData?.error ?? null)
    : localError;

  const refetch = useCallback(() => {
    if (useSb) {
      queryClient.invalidateQueries({ queryKey: ["portfolio", userId] });
    } else {
      try {
        const raw = localStorage.getItem("stratum_portfolio");
        setLocalPositions(raw ? JSON.parse(raw) : []);
      } catch { /* ignore */ }
    }
  }, [useSb, userId, queryClient]);

  // ── Mutations ──────────────────────────────────────────────────

  /** Add transaction with Supabase or localStorage fallback */
  const addTxMutation = useMutation({
    mutationFn: async (tx: {
      type: "BUY" | "SELL" | "DIV";
      symbol: string;
      name?: string;
      lots: number;
      price: number;
      date: string;
    }) => {
      if (useSb && userId) {
        // Supabase path
        const result = await addTransaction({ data: { ...tx, userId } });
        return result;
      } else {
        // localStorage fallback
        const raw = localStorage.getItem("stratum_portfolio");
        const positions: Array<{
          symbol: string; name: string; avgBuyPrice: number; totalLots: number;
          realizedPnL: number; dividendsReceived: number;
          transactions: Array<{ type: string; date: string; lots: number; price: number }>;
        }> = raw ? JSON.parse(raw) : [];

        const existing = positions.find((p) => p.symbol === tx.symbol);
        if (existing) {
          const newTx = { type: tx.type, date: tx.date, lots: tx.lots, price: tx.price };
          if (tx.type === "BUY") {
            const newTotal = existing.totalLots + tx.lots;
            existing.avgBuyPrice = newTotal > 0 ? ((existing.avgBuyPrice * existing.totalLots) + (tx.price * tx.lots)) / newTotal : tx.price;
            existing.totalLots = newTotal;
            existing.transactions.push(newTx);
          } else if (tx.type === "SELL") {
            existing.totalLots = Math.max(0, existing.totalLots - tx.lots);
            existing.realizedPnL += (tx.price - existing.avgBuyPrice) * tx.lots * 100;
            existing.transactions.push(newTx);
          } else {
            existing.dividendsReceived += tx.price * tx.lots * 100;
            existing.transactions.push(newTx);
          }
        } else {
          positions.push({
            symbol: tx.symbol, name: tx.name || tx.symbol,
            avgBuyPrice: tx.type === "BUY" ? tx.price : 0,
            totalLots: tx.type === "BUY" ? tx.lots : 0,
            realizedPnL: tx.type === "SELL" ? tx.price * tx.lots * 100 : 0,
            dividendsReceived: tx.type === "DIV" ? tx.price * tx.lots * 100 : 0,
            transactions: [{ type: tx.type, date: tx.date, lots: tx.lots, price: tx.price }],
          });
        }
        localStorage.setItem("stratum_portfolio", JSON.stringify(positions));
        return { success: true };
      }
    },
    onSuccess: () => {
      if (useSb) {
        queryClient.invalidateQueries({ queryKey: ["portfolio", userId] });
      } else {
        setLocalPositions((prev) => {
          // Re-read from localStorage
          const raw = localStorage.getItem("stratum_portfolio");
          return raw ? JSON.parse(raw) : prev;
        });
      }
    },
  });

  /** Delete position */
  const deleteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      if (useSb && userId) {
        const result = await deletePortfolioPosition({ data: { symbol, userId } });
        return result;
      } else {
        const raw = localStorage.getItem("stratum_portfolio");
        const positions: PortfolioPosition[] = raw ? JSON.parse(raw) : [];
        const filtered = positions.filter((p) => p.symbol !== symbol);
        localStorage.setItem("stratum_portfolio", JSON.stringify(filtered));
        return { success: true };
      }
    },
    onSuccess: () => {
      if (useSb) {
        queryClient.invalidateQueries({ queryKey: ["portfolio", userId] });
      } else {
        setLocalPositions((prev) => {
          const raw = localStorage.getItem("stratum_portfolio");
          return raw ? JSON.parse(raw) : prev;
        });
      }
    },
  });

  return {
    positions,
    isLoading,
    error,
    refetch,
    addTransaction: addTxMutation.mutateAsync,
    deletePosition: deleteMutation.mutateAsync,
    isAdding: addTxMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ── Hook: Transaction History ─────────────────────────────────────────────────

export function useTransactionHistory(userId: string | null, symbol?: string) {
  return useQuery({
    queryKey: ["transactions", userId, symbol],
    queryFn: async () => {
      if (!userId) return { success: true, transactions: [] as Transaction[] };
      const result = await getTransactionHistory({ data: { userId, symbol } });
      return result;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Hook: Auth state listener ───────────────────────────────────────────────

export function useAuthState(callback: (userId: string | null) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sb = getSupabaseBrowser();
    if (!sb) {
      callback(null);
      return;
    }

    // Get initial session
    sb.auth.getSession().then(({ data }) => {
      callback(data.session?.user?.id ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      callback(session?.user?.id ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}

// ── Hook: Check Supabase availability ───────────────────────────────────────

export function useSupabaseStatus() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<{ userId: string | null }>({ userId: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sb = getSupabaseBrowser();
    if (!sb) return;

    sb.auth.getSession().then(({ data }) => {
      setSession({ userId: data.session?.user?.id ?? null });
    });
  }, []);

  return {
    configured,
    authenticated: !!session.userId,
    userId: session.userId,
  };
}