import { Plus } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@/components/app/PlatformIcon";

type Props = {
  platform: PlatformId;
  setPlatform: (p: PlatformId) => void;
  handle: string;
  setHandle: (h: string) => void;
  onSubmit: () => void;
  isPending: boolean;
};

export function ManualRegisterForm({ platform, setPlatform, handle, setHandle, onSubmit, isPending }: Props) {
  return (
    <div className="section-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Or register a handle manually</h3>
      <form
        onSubmit={(e) => { e.preventDefault(); if (handle.length > 0) onSubmit(); }}
        className="grid gap-3 md:grid-cols-[auto_1fr_auto]"
      >
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as PlatformId)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" /> Register
        </button>
      </form>
    </div>
  );
}
