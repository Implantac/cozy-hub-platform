import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Check, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GbpService } from "@/lib/services";

interface Location {
  name: string;
  accountId: string;
  locationId: string;
  locationName: string;
  address?: string;
  verified: boolean;
}

/**
 * Location picker for Google Business Profile channels.
 *
 * Why this is not automatic: a company account can hold dozens of stores, and a
 * local post is publicly visible to real customers of that unit. Publishing to
 * the wrong location is not a cosmetic bug — it is a customer-facing mistake.
 * The user must pick explicitly; unverified locations are shown but disabled,
 * because hiding them would leave the user wondering why a store is "missing".
 */
export function BusinessLocationPicker({
  workspaceId,
  channelId,
  currentLocationName,
}: {
  workspaceId: string;
  channelId: string;
  currentLocationName?: string | null;
}) {
  const qc = useQueryClient();
  const list = useServerFn(GbpService.listBusinessLocationsForChannel);
  const select = useServerFn(GbpService.selectBusinessLocation);
  const [saving, setSaving] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["gbp-locations", workspaceId, channelId],
    queryFn: async () => {
      const r = await list({ data: { workspaceId, channelId } });
      return r as unknown as { locations: Location[]; verifiedCount: number };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const onSelect = async (loc: Location) => {
    setSaving(loc.name);
    try {
      await select({ data: { workspaceId, channelId, locationName: loc.name } });
      await qc.invalidateQueries({ queryKey: ["channels", workspaceId] });
      toast.success(`Loja vinculada: ${loc.locationName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível vincular a loja");
    } finally {
      setSaving(null);
    }
  };

  if (q.isLoading) {
    return <p className="px-4 py-2 text-xs text-muted-foreground">Buscando unidades no Google…</p>;
  }

  if (q.isError) {
    return (
      <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <div className="text-[11px] leading-relaxed text-foreground/85">
          <p className="font-medium">Não foi possível listar as unidades.</p>
          <p className="mt-0.5 text-muted-foreground">
            {q.error instanceof Error
              ? q.error.message
              : "Verifique se as Business Profile APIs estão habilitadas no projeto Google."}
          </p>
        </div>
      </div>
    );
  }

  const locations = q.data?.locations ?? [];
  if (locations.length === 0) {
    return (
      <p className="px-4 pb-3 text-[11px] text-muted-foreground">
        Nenhuma unidade encontrada nesta conta Google. Crie ou verifique uma unidade no Google
        Business Profile antes de publicar.
      </p>
    );
  }

  return (
    <div className="mx-4 mb-3 space-y-1.5 rounded-lg border border-border bg-background/60 p-2">
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <MapPin className="size-3 text-accent" />
        <span className="text-[11px] font-medium text-foreground">Unidade que recebe os posts</span>
      </div>
      {locations.map((loc) => {
        const active = currentLocationName === loc.locationName;
        return (
          <button
            key={loc.name}
            onClick={() => !active && onSelect(loc)}
            disabled={!loc.verified || saving === loc.name || active}
            className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition ${
              active
                ? "border-primary/60 bg-primary/10"
                : loc.verified
                  ? "border-border hover:border-primary/40 hover:bg-secondary/40"
                  : "cursor-not-allowed border-border opacity-50"
            }`}
          >
            <span className="mt-0.5">
              {active ? (
                <Check className="size-3.5 text-primary" />
              ) : loc.verified ? (
                <ShieldCheck className="size-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="size-3.5 text-amber-500" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">{loc.locationName}</span>
              {loc.address && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {loc.address}
                </span>
              )}
              {!loc.verified && (
                <span className="block text-[11px] text-amber-500">
                  Não verificada — o Google rejeita posts até a verificação.
                </span>
              )}
            </span>
            {saving === loc.name && (
              <span className="text-[10px] text-muted-foreground">salvando…</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
