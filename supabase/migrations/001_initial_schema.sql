-- ============================================================
-- Stratum — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── 1. WATCHLIST ITEMS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol     text        NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
  ON public.watchlist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist"
  ON public.watchlist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist"
  ON public.watchlist_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_watchlist_user ON public.watchlist_items(user_id);

-- ── 2. PRICE / INDICATOR ALERTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       text        NOT NULL,
  type         text        NOT NULL CHECK (type IN (
                             'price_above','price_below',
                             'rsi_above','rsi_below',
                             'volume_spike'
                           )),
  value        numeric     NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  triggered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
  ON public.alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON public.alerts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_alerts_user   ON public.alerts(user_id);
CREATE INDEX idx_alerts_symbol ON public.alerts(symbol);
CREATE INDEX idx_alerts_active ON public.alerts(user_id, is_active);

-- ── 3. USER SETTINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id          uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme            text    NOT NULL DEFAULT 'dark'
                           CHECK (theme IN ('dark','light','system')),
  language         text    NOT NULL DEFAULT 'id',
  ai_model         text    NOT NULL DEFAULT 'gemini-flash',
  ai_tone          text    NOT NULL DEFAULT 'analyst'
                           CHECK (ai_tone IN ('analyst','casual','technical','conservative')),
  notif_price      boolean NOT NULL DEFAULT true,
  notif_news       boolean NOT NULL DEFAULT true,
  notif_ai         boolean NOT NULL DEFAULT false,
  enabled_markets  text[]  NOT NULL DEFAULT ARRAY['IDX','NYSE','NASDAQ'],
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 4. SCREENER PRESETS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.screener_presets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  filters    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.screener_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets"
  ON public.screener_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presets"
  ON public.screener_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
  ON public.screener_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets"
  ON public.screener_presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_presets_user ON public.screener_presets(user_id);

-- ── 5. AUTO-CREATE USER SETTINGS ON SIGNUP ───────────────────
-- Trigger: when a new user signs up, insert default settings row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 6. UPDATED_AT TRIGGER ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_screener_presets_updated_at
  BEFORE UPDATE ON public.screener_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
