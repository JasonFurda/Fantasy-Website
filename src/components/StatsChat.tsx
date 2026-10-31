"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_QUESTION_CHARS = 500;

/** The API often delivers an answer that followed a stats lookup in one burst,
 *  so the text is revealed gradually here instead of landing as a block. */
const REVEAL_TICK_MS = 30;
const MIN_REVEAL_CHARS = 2;
/** Each tick shows this fraction of the backlog, so long replies catch up. */
const REVEAL_BACKLOG_DIVISOR = 40;

const SUGGESTIONS = [
  "Who's the biggest fraud this season?",
  "Summarize my team's season",
  "Who's going to win it all?",
];

/** Homepage stats bot. The conversation lives only in this component, so it's
 *  gone on refresh and nothing is saved. */
export default function StatsChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Scroll the log, not the page.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setBusy(true);

    const abort = new AbortController();
    abortRef.current = abort;
    let reply = "";
    let shown = 0;
    let received = false;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealed = new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (shown < reply.length && !abort.signal.aborted) {
          const step = Math.max(
            MIN_REVEAL_CHARS,
            Math.ceil((reply.length - shown) / REVEAL_BACKLOG_DIVISOR),
          );
          shown = instant ? reply.length : Math.min(reply.length, shown + step);
          setMessages([
            ...history,
            { role: "assistant", content: reply.slice(0, shown) },
          ]);
        } else if (received || abort.signal.aborted) {
          clearInterval(timer);
          resolve();
        }
      }, REVEAL_TICK_MS);
    });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
      }
      received = true;
      await revealed;
    } catch (err) {
      if (abort.signal.aborted) return;
      if (!reply) {
        // Put the question back so it can be retried without retyping.
        setMessages(messages);
        setInput(text);
      }
      setError(
        err instanceof Error && !(err instanceof TypeError)
          ? err.message
          : "Couldn't reach the bot. Try again.",
      );
    } finally {
      received = true;
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <section
      aria-label="Ask the stats bot"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-semibold">Ask the stats bot</h2>

      {messages.length > 0 && (
        <div
          ref={logRef}
          aria-live="polite"
          className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-accent text-background"
                  : "self-start bg-surface-2"
              }`}
            >
              {m.content ||
                (busy && i === messages.length - 1 ? (
                  <span className="text-muted">Checking the numbers…</span>
                ) : null)}
            </div>
          ))}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          aria-label="Your question"
          placeholder="Ask about any team or player"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
