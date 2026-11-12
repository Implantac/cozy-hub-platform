/**
 * VELT — Google Business Profile: location discovery and selection.
 *
 * The OAuth callback stores credentials but never selects a location. A company can have 2, 20 or 200 stores. Guessing is wrong: a
 * post published to the wrong unit is visible to real customers. This module
 * lets the user see the discovered locations and explicitly bind a channel to
 * one of them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import { requireWorkspaceRole } from "./_workspace";
import { WORKSPACE_MANAGE_ROLES } from "@/lib/workspace/permissions";
import { getFreshToken } from "@/lib/oauth/refresh.server";
import { listBusinessLocations, type BusinessLocation } from "@/lib/oauth/providers.server";

/**
 * Lists every location the connected Google account can manage. Requires an
 * existing `google_business` channel to read the token from.
 */
export const listBusinessLocationsForChannel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ workspaceId: z.string().uuid(), channelId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);

    const { data: channel, error } = await supabase
      .from("channels")
      .select("id, platform, metadata")
      .eq("id", data.channelId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(error);
    if (!channel || channel.platform !== "google_business") {
      throw new Error("canal não é do Google Business Profile");
    }

    const { accessToken } = await getFreshToken(data.channelId, "google_business");
    const locations = await listBusinessLocations(accessToken);

    return {
      locations: locations as BusinessLocation[],
      /** Locations that cannot receive posts yet (unverified) are flagged, not hidden. */
      verifiedCount: locations.filter((l) => l.verified).length,
    };
  });

/**
 * Binds a channel to a specific location. Validated server-side: the location id
 * must be one the token can actually manage, so a user cannot point a channel at
 * someone else's business by guessing an id.
 */
export const selectBusinessLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        channelId: z.string().uuid(),
        locationName: z.string().regex(/^accounts\/[^/]+\/locations\/[^/]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);

    const { data: channel, error } = await supabase
      .from("channels")
      .select("id, platform, metadata, external_id")
      .eq("id", data.channelId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(error);
    if (!channel || channel.platform !== "google_business") {
      throw new Error("canal não é do Google Business Profile");
    }

    const { accessToken } = await getFreshToken(data.channelId, "google_business");
    const available = await listBusinessLocations(accessToken);
    const chosen = available.find((l) => l.name === data.locationName);

    if (!chosen) {
      throw new Error(
        "A localização informada não está entre as que este token pode gerenciar. Reautorize a conexão.",
      );
    }
    if (!chosen.verified) {
      throw new Error(
        `A unidade "${chosen.locationName}" ainda não está verificada no Google. Publique depois da verificação.`,
      );
    }

    const metadata = {
      ...((channel.metadata as Record<string, unknown> | null) ?? {}),
      requires_location_selection: false,
      location_confirmed: true,
      account_id: chosen.accountId,
      location_id: chosen.locationId,
      location_name: chosen.locationName,
      address: chosen.address ?? null,
    };

    const { data: updated, error: upErr } = await supabase
      .from("channels")
      .update({ external_id: chosen.name, handle: chosen.locationName, metadata })
      .eq("id", data.channelId)
      .eq("workspace_id", data.workspaceId)
      .select("id, external_id")
      .maybeSingle();
    throwIfError(upErr);
    if (!updated || updated.external_id !== chosen.name)
      throw new Error("Alteração da unidade não confirmada.");

    return { ok: true, location: chosen };
  });
