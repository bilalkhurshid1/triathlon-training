import Link from "next/link";
import { prisma } from "@/lib/db";
import { Chat } from "@/components/chat/chat";

export default async function CoachPage() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <div className="text-xs text-zinc-500">
          using {settings?.provider} / {settings?.model} ·{" "}
          <Link href="/settings" className="underline">change</Link> ·{" "}
          <Link href="/coach/debug" className="underline">debug</Link>
        </div>
      </div>
      <Chat />
    </div>
  );
}
