import { useMemo, useRef, useState } from "react";
import { Bot, Loader2, Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_PROMPTS = [
  "Cari saham IDX yang potensial untuk swing trade minggu ini.",
  "Bantu analisis saham dengan revenue naik, laba bersih positif, dan free float sehat.",
  "Apa checklist cepat sebelum beli saham IPO / newly listed?",
];

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Chatbot gagal merespons. Coba ulang sebentar lagi.";
}

export function StockChatbot() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Halo, saya analis AI untuk Market Pulse. Saya bisa bantu screening saham potensial, membaca sinyal fundamental/teknikal, dan menyusun checklist risiko. Ini bukan nasihat finansial; pakai sebagai second opinion.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const panelSize = useMemo(
    () =>
      expanded
        ? "bottom-4 right-4 left-4 top-4 h-auto w-auto md:left-auto md:w-[720px]"
        : "bottom-20 right-4 h-[620px] w-[calc(100vw-2rem)] max-w-[430px]",
    [expanded],
  );

  async function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-12) }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `HTTP ${response.status}`);
      }

      const data = (await response.json()) as { reply?: string };
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply || "Tidak ada respons dari model." },
      ]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: formatError(error) }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full border border-emerald-400/30 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-2xl shadow-emerald-950/40 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-slate-900"
        aria-label="Open stock analyst chatbot"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400 text-slate-950">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="hidden sm:block">AI Stock Analyst</span>
      </button>
    );
  }

  return (
    <section
      className={`fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-emerald-400/20 bg-slate-950/95 text-slate-50 shadow-2xl shadow-black/50 backdrop-blur-xl ${panelSize}`}
      aria-label="AI Stock Analyst chatbot"
    >
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">AI Stock Analyst</h2>
              <p className="text-xs text-emerald-100/70">Screening IDX, risk checklist, dan tesis saham potensial</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label={expanded ? "Minimize chatbot" : "Expand chatbot"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close chatbot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-emerald-400 text-slate-950"
                  : "border border-white/10 bg-white/[0.06] text-slate-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
              Menganalisis market context...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-950/90 p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Tanya: saham apa yang menarik, alasan, risiko, entry checklist..."
            className="max-h-32 min-h-12 resize-none border-white/10 bg-white/[0.06] text-slate-50 placeholder:text-slate-500"
          />
          <Button type="submit" disabled={loading || !input.trim()} className="h-12 rounded-2xl bg-emerald-400 text-slate-950 hover:bg-emerald-300">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </section>
  );
}
