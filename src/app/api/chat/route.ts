import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { prisma } from "@/lib/db";
import { getModel } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { buildCoachContext } from "@/lib/coach/context";
import { contextToMarkdown } from "@/lib/coach/format";

export const runtime = "nodejs";

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = m.parts ?? [];
    return parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
  }
  return "";
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const [profile, race, settings] = await Promise.all([
    prisma.profile.findUnique({ where: { id: "me" } }),
    prisma.race.findFirst({ where: { isPrimary: true } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  if (!settings) {
    return new Response("Settings row missing. Run `pnpm tsx prisma/seed.ts`.", { status: 500 });
  }

  const userMsg = lastUserText(messages);
  const ctx = await buildCoachContext({ now: new Date(), race, profile, userMsg });
  const system = (profile?.id ? buildSystemPrompt(profile, race) : buildSystemPrompt(null, race));
  const contextBlock = contextToMarkdown(ctx);

  await prisma.chatMessage.create({
    data: { role: "user", content: userMsg, contextJson: JSON.stringify(ctx) },
  });

  // Convert UI messages -> model messages, then prepend the structured context
  // to the last user message so the model sees it alongside the question.
  const modelMessages = await convertToModelMessages(messages);
  const last = modelMessages.at(-1);
  if (last && last.role === "user") {
    const original =
      typeof last.content === "string"
        ? last.content
        : last.content
            .map((p: { type: string; text?: string }) =>
              p.type === "text" ? p.text ?? "" : ""
            )
            .join("\n");
    last.content = `${contextBlock}\n\nUser question: ${original}`;
  }

  const result = streamText({
    model: getModel(settings),
    system,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      await prisma.chatMessage.create({
        data: {
          role: "assistant",
          content: text,
          provider: settings.provider,
          model: settings.model,
        },
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
