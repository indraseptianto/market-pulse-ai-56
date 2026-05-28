// ── Supabase React Query hooks ────────────────────────────────────────────────
// All hooks are user-scoped — they return empty/null when not authenticated.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./client";
import type { Alert, UserSettings, ScreenerPreset } from "./types";

// ── Auth helper ───────────────────────────────────────────────────────────────
// Cached userId — valid for 30s per serverless invocation.
// This avoids 6+ redundant getUser() calls per page load.
// The Supabase client already caches session in localStorage, so this
// only adds one network call on cold start instead of one per hook.
let _cachedUid: { uid: string | null; expiresAt: number } | null = null;

export async function getCurrentUserId(): Promise<string | null> {
  if (_cachedUid && Date.now() < _cachedUid.expiresAt) {
    return _cachedUid.uid;
  }
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  _cachedUid = { uid, expiresAt: Date.now() + 30_000 };
  return uid;
}

// Clear cached userId (call on logout)
export function clearCachedUserId() {
  _cachedUid = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST
// ─────────────────────────────────────────────────────────────────────────────

export function useWatchlist() {
  return useQuery({
    queryKey: ["supabase", "watchlist"],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      if (!uid) return [] as string[];
      const { data, error } = await supabase
        .from("watchlist_items")
        .select("symbol")
        .eq("user_id", uid)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => r.symbol);
    },
    staleTime: 30_000,
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("watchlist_items")
        .insert({ user_id: uid, symbol: symbol.toUpperCase() });
      if (error && error.code !== "23505") throw error; // ignore duplicate
    },
    onMutate: async (symbol) => {
      // Cancel outgoing refetches
      await qc.cancelQueries({ queryKey: ["supabase", "watchlist"] });
      const snapshot = qc.getQueryData<string[]>(["supabase", "watchlist"]);
      // Optimistically add symbol
      qc.setQueryData<string[]>(["supabase", "watchlist"], (old) =>
        old ? [...old, symbol.toUpperCase()] : [symbol.toUpperCase()],
      );
      return { snapshot };
    },
    onError: (_err, _symbol, context) => {
      // Rollback on failure
      if (context?.snapshot !== undefined) {
        qc.setQueryData(["supabase", "watchlist"], context.snapshot);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["supabase", "watchlist"] }),
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("watchlist_items")
        .delete()
        .eq("user_id", uid)
        .eq("symbol", symbol.toUpperCase());
      if (error) throw error;
    },
    onMutate: async (symbol) => {
      await qc.cancelQueries({ queryKey: ["supabase", "watchlist"] });
      const snapshot = qc.getQueryData<string[]>(["supabase", "watchlist"]);
      qc.setQueryData<string[]>(["supabase", "watchlist"], (old) =>
        old ? old.filter((s) => s !== symbol.toUpperCase()) : [],
      );
      return { snapshot };
    },
    onError: (_err, _symbol, context) => {
      if (context?.snapshot !== undefined) {
        qc.setQueryData(["supabase", "watchlist"], context.snapshot);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["supabase", "watchlist"] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────────────────

export function useAlerts(symbol?: string) {
  return useQuery({
    queryKey: ["supabase", "alerts", symbol ?? "all"],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      if (!uid) return [] as Alert[];
      let q = supabase
        .from("alerts")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (symbol) q = q.eq("symbol", symbol.toUpperCase());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Alert[];
    },
    staleTime: 30_000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alert: Omit<Alert, "id" | "user_id" | "created_at" | "triggered_at">) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("alerts")
        .insert({ ...alert, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("alerts")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "alerts"] }),
  });
}

export function useToggleAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("alerts")
        .update({ is_active })
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "alerts"] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// USER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export function useUserSettings() {
  return useQuery({
    queryKey: ["supabase", "user-settings"],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      if (!uid) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", uid)
        .single();
      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return (data ?? null) as UserSettings | null;
    },
    staleTime: 60_000,
  });
}

export function useSaveUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<Omit<UserSettings, "user_id" | "updated_at">>) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_settings")
        .upsert({ user_id: uid, ...settings }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "user-settings"] }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENER PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export function useScreenerPresets() {
  return useQuery({
    queryKey: ["supabase", "screener-presets"],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      if (!uid) return [] as ScreenerPreset[];
      const { data, error } = await supabase
        .from("screener_presets")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScreenerPreset[];
    },
    staleTime: 60_000,
  });
}

export function useSaveScreenerPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: Record<string, unknown> }) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("screener_presets")
        .insert({ user_id: uid, name, filters });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "screener-presets"] }),
  });
}

export function useDeleteScreenerPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await getCurrentUserId();
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("screener_presets")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase", "screener-presets"] }),
  });
}
