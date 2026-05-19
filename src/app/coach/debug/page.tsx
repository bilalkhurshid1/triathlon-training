import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function CoachDebugPage() {
  const lastUser = await prisma.chatMessage.findFirst({
    where: { role: "user", contextJson: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  const pretty = lastUser?.contextJson
    ? safeJson(lastUser.contextJson)
    : "(no chat messages yet — send one from /coach first)";

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Coach context (debug)</h1>
        <Link href="/coach" className="text-sm underline">
          back to coach
        </Link>
      </div>
      <p className="text-sm text-zinc-600">
        The structured context block from your most recent user message. This is what the model sees
        alongside your question — useful for sanity-checking what the coach actually knows.
      </p>
      <pre className="rounded border border-zinc-200 bg-white p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
        {pretty}
      </pre>
    </div>
  );
}

function safeJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
