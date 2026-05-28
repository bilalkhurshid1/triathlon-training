"use client";

import { useFormStatus } from "react-dom";

type GarminSyncSubmitProps = {
  disabled?: boolean;
  idleLabel?: string;
  pendingLabel?: string;
  className?: string;
};

export function GarminSyncSubmit({
  disabled = false,
  idleLabel = "Sync Garmin",
  pendingLabel = "Syncing...",
  className = "",
}: GarminSyncSubmitProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="submit"
        disabled={isDisabled}
        aria-busy={pending}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {pending ? pendingLabel : idleLabel}
      </button>
      {pending && (
        <div role="status" aria-live="polite" className="w-full">
          <span className="sr-only">Syncing Garmin data</span>
          <div
            role="progressbar"
            aria-label="Garmin sync progress"
            aria-valuetext="Sync in progress"
            className="h-1.5 overflow-hidden rounded bg-zinc-200"
          >
            <div className="h-full w-full animate-pulse rounded bg-zinc-900" />
          </div>
        </div>
      )}
    </div>
  );
}
