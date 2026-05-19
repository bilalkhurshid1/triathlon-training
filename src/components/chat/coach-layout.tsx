"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chat } from "./chat";
import type { UIMessage } from "ai";

type Session = { id: string; title: string; updatedAt: Date };

type Props = {
  sessionId: string;
  sessions: Session[];
  initialMessages: UIMessage[];
  settings: { provider: string | null; model: string | null } | null;
};

export function CoachLayout({ sessionId, sessions, initialMessages, settings }: Props) {
  const router = useRouter();

  async function handleNewSession() {
    const res = await fetch("/api/chat/sessions", { method: "POST" });
    const { id } = await res.json();
    router.push(`/coach?session=${id}`);
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 flex flex-col gap-1 min-h-0">
        <button
          onClick={handleNewSession}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 text-left"
        >
          + New session
        </button>
        <nav className="flex-1 overflow-y-auto space-y-0.5 mt-1">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/coach?session=${s.id}`}
              className={`block truncate rounded px-2 py-1.5 text-sm hover:bg-zinc-100 ${
                s.id === sessionId ? "bg-zinc-200 font-medium" : "text-zinc-700"
              }`}
              title={s.title}
            >
              {s.title}
            </Link>
          ))}
          {sessions.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-zinc-400">No sessions yet</p>
          )}
        </nav>
      </aside>

      {/* Chat area */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-xs text-zinc-500">
          <span>
            using {settings?.provider ?? "—"} / {settings?.model ?? "—"}
          </span>
          <span>
            <Link href="/settings" className="underline">change</Link>
            {" · "}
            <Link href="/coach/debug" className="underline">debug</Link>
          </span>
        </div>
        <Chat key={sessionId} sessionId={sessionId} initialMessages={initialMessages} />
      </div>
    </div>
  );
}
