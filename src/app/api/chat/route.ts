import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { chatContext, chatSystemPrompt } from "@/lib/chat/personality";
import { allowChatRequest } from "@/lib/chat/rate-limit";
import { CHAT_TOOLS, nicknameRosters, runChatTool } from "@/lib/chat/tools";
import { MY_TEAM_COOKIE } from "@/lib/my-team";
import { getCurrentFranchises, getSeasons } from "@/lib/queries";

const MODEL = "claude-sonnet-5-5";
const MAX_OUTPUT_TOKENS = 1500;
/** Lookups allowed per question; the last round has to answer with what it has. */
const MAX_ROUNDS = 6;
const MAX_HISTORY = 12;
const MAX_USER_CHARS = 500;
const MAX_ASSISTANT_CHARS = 4000;

const FALLBACK_REPLY = "I can't help with that one. Ask me about the league.";

/** The conversation lives in the browser, so everything here is untrusted. Size
 *  limits are what keep a forged history from running up the bill. */
function parseHistory(body: unknown): Anthropic.MessageParam[] | null {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages: Anthropic.MessageParam[] = [];
  for (const m of raw.slice(-MAX_HISTORY)) {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim()) return null;
    const limit = role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS;
    if (content.length > limit) return null;
    messages.push({ role, content });
  }
  // Trimming to MAX_HISTORY can leave an assistant reply first, which the API rejects.
  if (messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return null;
  }
  return messages;
}

async function streamReply(
  client: Anthropic,
  params: {
    system: Anthropic.TextBlockParam[];
    messages: Anthropic.MessageParam[];
  },
  send: (text: string) => void,
  signal: AbortSignal,
) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [...params.messages];
  let sentText = false;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let startedThisRound = false;
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        // A safety decline re-runs on another model instead of ending the reply.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: "low" },
        system: params.system,
        tools: CHAT_TOOLS,
        tool_choice: round === MAX_ROUNDS ? { type: "none" } : { type: "auto" },
        messages,
      },
      { signal },
    );
    stream.on("text", (delta) => {
      if (!startedThisRound && sentText) send("\n\n");
      startedThisRound = true;
      sentText = true;
      send(delta);
    });

    const message = await stream.finalMessage();
    if (message.stop_reason !== "tool_use") break;

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    const results = await Promise.all(
      toolUses.map(async (t): Promise<Anthropic.ToolResultBlockParam> => {
        const { content, isError } = await runChatTool(t.name, t.input);
        return {
          type: "tool_result",
          tool_use_id: t.id,
          content,
          is_error: isError,
        };
      }),
    );
    messages.push({ role: "assistant", content: message.content });
    messages.push({ role: "user", content: results });
  }

  if (!sentText) send(FALLBACK_REPLY);
}

function errorReply(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) {
    return "Too many people are asking me things. Try again in a minute.";
  }
  return "Something went wrong on my end. Try again in a bit.";
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "The stats bot isn't set up yet." },
      { status: 503 },
    );
  }

  const visitor =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allowChatRequest(visitor)) {
    return Response.json(
      { error: "That's enough questions for now. Try again later." },
      { status: 429 },
    );
  }

  const messages = parseHistory(await request.json().catch(() => null));
  if (!messages) {
    return Response.json(
      { error: `Keep questions under ${MAX_USER_CHARS} characters.` },
      { status: 400 },
    );
  }

  const [franchises, seasons] = await Promise.all([
    getCurrentFranchises(),
    getSeasons(),
  ]);
  const myTeamId = Number(request.cookies.get(MY_TEAM_COOKIE)?.value);
  const myTeam = franchises.find((t) => t.espn_id === myTeamId) ?? null;
  const season = seasons.find((s) => s.is_active) ?? seasons[0];
  const rosters = await nicknameRosters(franchises);

  // Render order is tools, then system, so this breakpoint caches both. The
  // per-visitor context goes after it to keep the cached prefix identical.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: chatSystemPrompt(franchises),
      cache_control: { type: "ephemeral" },
    },
    { type: "text", text: chatContext(season, myTeam, rosters) },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        await streamReply(client, { system, messages }, send, request.signal);
      } catch (err) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }
        console.error("chat request failed", err);
        send(errorReply(err));
      }
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // no-transform stops the CDN compressing, which would buffer the stream.
      "Cache-Control": "no-store, no-transform",
    },
  });
}
