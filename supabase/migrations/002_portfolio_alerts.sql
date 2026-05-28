-- ============================================================
-- Stratum — Portfolio & Transaction Tables
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── 1. PORTFOLIO POSITIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol        text        NOT NULL,
  name          text,
  avg_buy_price numeric     NOT NULL DEFAULT 0,
  total_lots    numeric     NOT NULL DEFAULT 0,
  realized_pnl   numeric     NOT NULL DEFAULT 0,
  dividends_received numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON public.portfolio_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON public.portfolio_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON public.portfolio_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON public.portfolio_positions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_portfolio_user ON public.portfolio_positions(user_id);

-- ── 2. TRANSACTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('BUY', 'SELL', 'DIV')),
  lots        numeric     NOT NULL,
  price       numeric     NOT NULL,
  date        timestamptz NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.portfolio_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.portfolio_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.portfolio_transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_user   ON public.portfolio_transactions(user_id);
CREATE INDEX idx_transactions_symbol ON public.portfolio_transactions(user_id, symbol);
CREATE INDEX idx_transactions_date   ON public.portfolio_transactions(user_id, date DESC);

-- Trigger: updated_at for positions
CREATE TRIGGER set_portfolio_positions_updated_at
  BEFORE UPDATE ON public.portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. PORTFOLIO SNAPSHOTS (for P&L history) ───────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  total_value numeric     NOT NULL,
  total_cost  numeric     NOT NULL,
  unreal_pnl  numeric     NOT NULL,
  realized_pnl numeric    NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON NOT EXISTS public.portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON public.portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_snapshots_user ON public.portfolio_snapshots(user_id);
CREATE INDEX idx_snapshots_date ON public.portfolio_snapshots(user_id, date DESC);

-- ── 4. ENHANCED ALERTS TABLE ──────────────────────────────────
-- (Drops and recreates with more fields than the basic one in 001)
DROP TABLE IF EXISTS public.alerts CASCADE;

CREATE TABLE IF NOT EXISTS public.alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       text        NOT NULL,
  alert_type   text        NOT NULL CHECK (alert_type IN (
                             'price_above','price_below',
                             'percent_change_up','percent_change_down',
                             'volume_spike','rsi_above','rsi_below',
                             'dividend_yield_above','new_52w_high','new_52w_low'
                           )),
  value        numeric     NOT NULL,
  current_value numeric,
  is_active    boolean     NOT NULL DEFAULT true,
  is_triggered boolean     NOT NULL DEFAULT false,
  triggered_at timestamptz,
  note         text,
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

CREATE INDEX idx_alerts_user    ON public.alerts(user_id);
CREATE INDEX idx_alerts_symbol ON public.alerts(symbol);
CREATE INDEX idx_alerts_active ON public.alerts(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_alerts_triggered ON public.alerts(user_id, is_triggered) WHERE is_triggered = true;