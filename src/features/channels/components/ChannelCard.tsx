import { Link2, Trash2, Unlink } from "lucide-react";
import { PLATFORMS, getPlatformIcon } from "@/components/app/PlatformIcon";
import type { Channel } from "@/lib/api/_types";
import { BusinessLocationPicker } from "./BusinessLocationPicker";

type Props = {
  channel: Channel;
  disabled: boolean;
  workspaceId: string | null | undefined;
  onDelete: () => void;
  onDisconnect: () => void;
  onConnect: (oauth: string) => void;
};

export function ChannelCard({
  channel: c,
  disabled,
  workspaceId,
  onDelete,
  onDisconnect,
  onConnect,
}: Props) {
  const isGbp = c.platform === "google_business";
  const locationName =
    (c as { metadata?: { location_name?: string } }).metadata?.location_name ?? null;
  const meta = PLATFORMS.find((p) => p.id === c.platform);
  const Icon = getPlatformIcon(c.platform);
  const isConnected = c.status === "connected";

  return (
    <div className="section-card hover-lift p-5 sm:p-6 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-secondary/50 group-hover:bg-primary/10 transition-colors">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="font-bold capitalize text-foreground group-hover:text-primary transition-colors">
              {c.platform}
            </div>
            <div className="text-sm text-muted-foreground">{c.handle ?? c.external_id ?? "—"}</div>
          </div>
        </div>
        <button
          type="button"
          aria-label={`Delete ${c.platform} channel`}
          onClick={onDelete}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
          title="Delete channel"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span
          className={`rounded-full px-2 py-0.5 ${isConnected ? "bg-success/20 text-success" : "bg-secondary text-secondary-foreground"}`}
        >
          {c.status}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{c.brand?.name ?? "no brand"}</span>
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary"
            >
              <Unlink className="size-3" /> Disconnect
            </button>
          ) : (
            meta && (
              <button
                onClick={() => onConnect(meta.oauth)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-primary/5"
              >
                <Link2 className="size-3" /> Connect
              </button>
            )
          )}
        </div>
      </div>

      {/* Google Business: an account can hold many stores. The channel is only
          usable once a location is bound — never guess on the user's behalf. */}
      {isGbp && isConnected && workspaceId && (
        <div className="mt-4">
          <BusinessLocationPicker
            workspaceId={workspaceId}
            channelId={c.id}
            currentLocationName={locationName}
          />
        </div>
      )}
    </div>
  );
}
