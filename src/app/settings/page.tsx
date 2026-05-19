import { prisma } from "@/lib/db";
import { updateSettings } from "@/app/actions/settings";
import { PROVIDER_MODELS } from "@/lib/ai/provider";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } });
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-600">Provider and model used by the coach.</p>
      </div>
      <SettingsForm
        action={updateSettings}
        defaultProvider={(settings?.provider as "anthropic" | "openai") ?? "anthropic"}
        defaultModel={settings?.model ?? "claude-opus-4-7"}
        defaultOverride={settings?.systemPromptOverride ?? ""}
        models={PROVIDER_MODELS}
      />
      <div className="text-xs text-zinc-500 space-y-1">
        <p>Provider keys come from environment variables:</p>
        <ul className="list-disc list-inside">
          <li><code>ANTHROPIC_API_KEY</code></li>
          <li><code>OPENAI_API_KEY</code></li>
        </ul>
      </div>
    </div>
  );
}
