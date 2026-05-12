export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      watchlist_items: {
        Row: {
          id: string
          user_id: string
          symbol: string
          added_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          added_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          added_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          symbol: string
          type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "volume_spike"
          value: number
          is_active: boolean
          triggered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          symbol: string
          type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "volume_spike"
          value: number
          is_active?: boolean
          triggered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          symbol?: string
          type?: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "volume_spike"
          value?: number
          is_active?: boolean
          triggered_at?: string | null
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          theme: "dark" | "light" | "system"
          language: string
          ai_model: string
          ai_tone: "analyst" | "casual" | "technical" | "conservative"
          notif_price: boolean
          notif_news: boolean
          notif_ai: boolean
          enabled_markets: string[]
          updated_at: string
        }
        Insert: {
          user_id: string
          theme?: "dark" | "light" | "system"
          language?: string
          ai_model?: string
          ai_tone?: "analyst" | "casual" | "technical" | "conservative"
          notif_price?: boolean
          notif_news?: boolean
          notif_ai?: boolean
          enabled_markets?: string[]
          updated_at?: string
        }
        Update: {
          user_id?: string
          theme?: "dark" | "light" | "system"
          language?: string
          ai_model?: string
          ai_tone?: "analyst" | "casual" | "technical" | "conservative"
          notif_price?: boolean
          notif_news?: boolean
          notif_ai?: boolean
          enabled_markets?: string[]
          updated_at?: string
        }
      }
      screener_presets: {
        Row: {
          id: string
          user_id: string
          name: string
          filters: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          filters?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          filters?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// ── Convenience row types ─────────────────────────────────────────────────────
export type WatchlistItem   = Database["public"]["Tables"]["watchlist_items"]["Row"]
export type Alert           = Database["public"]["Tables"]["alerts"]["Row"]
export type UserSettings    = Database["public"]["Tables"]["user_settings"]["Row"]
export type ScreenerPreset  = Database["public"]["Tables"]["screener_presets"]["Row"]
