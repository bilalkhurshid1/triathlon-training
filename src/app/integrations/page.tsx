import {
  getGarminIntegrationStatus,
  DEFAULT_GARMIN_DB_DIR,
} from "@/lib/importers/garmin-db";
import {
  syncGarminIntegration,
  updateGarminIntegration,
} from "@/app/actions/integrations";

export default async function IntegrationsPage() {
  const status = await getGarminIntegrationStatus();
  const lastSyncLabel = status.config?.lastSyncAt
    ? status.config.lastSyncAt.toLocaleString()
    : "Never";

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-zinc-600">GarminDB local import</p>
      </header>

      <section className="rounded border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Garmin</h2>
              <p className="text-sm text-zinc-600">{status.expandedSourcePath}</p>
            </div>
            <StatusPill status={status.config?.lastSyncStatus ?? (status.ready ? "ready" : "missing")} />
          </div>

          <form action={updateGarminIntegration} className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="sourcePath">
              GarminDB directory
            </label>
            <input
              id="sourcePath"
              name="sourcePath"
              type="text"
              defaultValue={status.config?.sourcePath ?? DEFAULT_GARMIN_DB_DIR}
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Save
            </button>
          </form>

          <div className="overflow-x-auto rounded border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Path</th>
                </tr>
              </thead>
              <tbody>
                {status.files.map((file) => (
                  <tr key={file.name} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-mono">{file.name}</td>
                    <td className="px-3 py-2">{file.exists ? "found" : "missing"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{file.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
            <div className="text-sm text-zinc-600">
              <div>Last sync: {lastSyncLabel}</div>
              {status.config?.lastSyncMessage && <div>{status.config.lastSyncMessage}</div>}
            </div>
            <form action={syncGarminIntegration}>
              <button
                type="submit"
                disabled={!status.ready}
                className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Sync Garmin
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "success" || status === "ready"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "error" || status === "missing"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : "bg-zinc-100 text-zinc-700 ring-zinc-200";

  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ring-1 ${tone}`}>
      {status}
    </span>
  );
}
