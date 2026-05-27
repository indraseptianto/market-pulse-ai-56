import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/common/GlassCard";
import { X, Plus } from "lucide-react";

interface Props {
  onClose: () => void;
  onAdd: (tx: { type: "BUY" | "SELL" | "DIV"; symbol: string; name?: string; lots: number; price: number; date: string }) => void;
}

export function TransactionModal({ onClose, onAdd }: Props) {
  const [type, setType] = useState<"BUY" | "SELL" | "DIV">("BUY");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [lots, setLots] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = () => {
    if (!symbol || !lots || !price) return;
    onAdd({ type, symbol: symbol.toUpperCase(), name: name || symbol.toUpperCase(), lots: Number(lots), price: Number(price), date });
    onClose();
  };

  const typeColor = type === "BUY" ? "border-green-500/60 bg-green-500/15 text-green-400" : type === "SELL" ? "border-red-500/60 bg-red-500/15 text-red-400" : "border-yellow-500/60 bg-yellow-500/15 text-yellow-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${typeColor}`}>Add Transaction</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["BUY","SELL","DIV"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${type === t ? typeColor : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                {t === "BUY" ? "📈 BUY" : t === "SELL" ? "📉 SELL" : "💰 DIV"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="BBRI" className="font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stock Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bank BRI" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Lots</label><Input type="number" value={lots} onChange={(e) => setLots(e.target.value)} placeholder="1000" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Price (IDR)</label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {lots && price && (
            <div className="rounded-lg bg-accent/50 p-3 text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-mono font-semibold">IDR {(Number(lots) * Number(price) * 100).toLocaleString("id-ID")}</span>
              <span className="text-muted-foreground ml-2 text-xs">(1 lot = 100 shares)</span>
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full" disabled={!symbol || !lots || !price}>
            <Plus className="h-4 w-4 mr-1.5" />Add Transaction
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
