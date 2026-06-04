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
    <div className="section-card p-6">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Or register a handle manually</h3>
      <form
        onSubmit={(e) => { e.preventDefault(); if (handle.length > 0) onSubmit(); }}
        className="grid gap-3 md:grid-cols-[auto_1fr_auto]"
      >
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as PlatformId)}
          className="h-10 rounded-xl border border-input bg-background/50 px-3 py-2 text-sm transition-all focus:border-primary/50"
        >
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          className="h-10 rounded-xl border border-input bg-background/50 px-3 py-2 text-sm transition-all focus:border-primary/50"
        />
        <button
          disabled={isPending}
          className="h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Plus className="size-4" /> Register
        </button>
      </form>
    </div>
  );
}
