"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import type { UIMessage } from "ai";

type Props = {
  sessionId: string;
  initialMessages: UIMessage[];
};

export function Chat({ sessionId, initialMessages }: Props) {
  const router = useRouter();
  const hasRefreshedRef = useRef(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
    messages: initialMessages,
    onFinish: () => {
      if (!hasRefreshedRef.current) {
        hasRefreshedRef.current = true;
        router.refresh();
      }
    },
  });

  const [input, setInput] = useState("");
  const isStreaming = status === "submitted" || status === "streaming";

  function submitMessage() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="rounded border border-zinc-200 bg-white flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500">
            Ask the coach. They have your last 14 days of workouts, your profile, and your race date.
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
          return (
            <div key={m.id} className="text-sm">
              <span className="text-xs uppercase tracking-wide text-zinc-500 block mb-0.5">
                {m.role === "assistant" ? "Coach" : "You"}
              </span>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-zinc max-w-none">
                  <Markdown>{text}</Markdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{text}</span>
              )}
            </div>
          );
        })}
        {isStreaming && <div className="text-xs text-zinc-400">…</div>}
        {error && (
          <div className="text-xs text-red-600 whitespace-pre-wrap">
            error: {error.message}
          </div>
        )}
      </div>

      <form
        className="border-t border-zinc-200 p-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitMessage();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitMessage();
            }
          }}
          placeholder="ask the coach…"
          rows={2}
          className="max-h-32 min-h-10 flex-1 resize-none rounded border border-zinc-300 bg-white px-3 py-2 text-sm leading-5 focus:outline-none focus:border-zinc-500"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          send
        </button>
      </form>
    </div>
  );
}
