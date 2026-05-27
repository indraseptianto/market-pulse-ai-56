import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface ParsedRow {
  type: "BUY" | "SELL" | "DIV";
  symbol: string;
  name?: string;
  lots: number;
  price: number;
  date: string;
}

interface Props { onImport: (rows: ParsedRow[]) => void; }

export function CsvImport({ onImport }: Props) {
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split("\n").slice(1);
    const rows: ParsedRow[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 5) continue;
      const [date, typeRaw, symbol, lotsStr, priceStr, ...rest] = parts;
      const type = typeRaw.toUpperCase().startsWith("BUY") ? "BUY" as const : typeRaw.toUpperCase().startsWith("SELL") ? "SELL" as const : "DIV" as const;
      const lots = parseInt(lotsStr) || 0;
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
      if (symbol && lots > 0 && price > 0) {
        rows.push({ type, symbol: symbol.toUpperCase(), name: rest[0] || symbol, lots, price, date: date || new Date().toISOString().split("T")[0] });
      }
    }
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) { setError("Empty file"); return; }
      const rows = parseCSV(text);
      if (rows.length === 0) { setError("No valid rows. Expected: date,type,symbol,lots,price[,name]"); return; }
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />Upload Broker CSV
      </Button>
      {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4" />{error}</div>}
      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle className="h-4 w-4" />{preview.length} transactions parsed</div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-accent/30 p-2 space-y-1">
            {preview.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium">{r.type} {r.symbol}</span>
                <span className="text-muted-foreground">{r.lots} lots @ IDR {r.price.toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
          <Button onClick={() => onImport(preview)} className="w-full" size="sm">Import {preview.length} Transactions</Button>
        </div>
      )}
    </div>
  );
}
