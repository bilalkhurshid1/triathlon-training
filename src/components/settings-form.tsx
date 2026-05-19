"use client";

import { useState } from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaultProvider: "anthropic" | "openai";
  defaultModel: string;
  defaultOverride: string;
  models: Record<"anthropic" | "openai", string[]>;
};

const labelCls = "text-xs uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-zinc-500";

export function SettingsForm({
  action,
  defaultProvider,
  defaultModel,
  defaultOverride,
  models,
}: Props) {
  const [provider, setProvider] = useState<"anthropic" | "openai">(defaultProvider);
  const [model, setModel] = useState(defaultModel);
  const visibleModels = models[provider];
  const modelOk = visibleModels.includes(model);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelCls}>Provider</label>
        <div className="mt-1 flex gap-3 text-sm">
          {(Object.keys(models) as Array<"anthropic" | "openai">).map((p) => (
            <label key={p} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => {
                  setProvider(p);
                  if (!models[p].includes(model)) setModel(models[p][0]);
                }}
              />
              {p}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Model</label>
        <select
          name="model"
          value={modelOk ? model : visibleModels[0]}
          onChange={(e) => setModel(e.target.value)}
          className={inputCls}
        >
          {visibleModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>System prompt override (optional)</label>
        <textarea
          name="systemPromptOverride"
          rows={4}
          defaultValue={defaultOverride}
          className={`${inputCls} font-mono`}
        />
      </div>

      <button
        type="submit"
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Save
      </button>
    </form>
  );
}
