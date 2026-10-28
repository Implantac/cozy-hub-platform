/**
 * VELT — Google Business Profile publisher (Business Profile API v4).
 *
 * Why this platform matters more than it looks: for the VELT audience —
 * `business_path = 'local_business'` — "being found" starts in Google Search and
 * Maps, not in a feed. In the 2026 benchmark only Metricool ships this, which
 * makes it the clearest differentiator available for the local segment.
 *
 * API shape (v4):
 *   POST https://mybusiness.googleapis.com/v4/{accountName}/{locationName}/localPosts
 *
 * Three things make this publisher different from the social ones:
 *
 *  1. **Everything is required.** A local post needs `languageCode`, `summary`
 *     AND a `callToAction` with a typed action and a URL. Omitting any of them
 *     returns a 400 that names no field — hence the explicit validation below.
 *  2. **Media is referenced by URL** (`sourceUrl`), Google downloads it, and the
 *     image must be ≥ 720×540. A wrong aspect fails asynchronously.
 *  3. **Posts expire.** Offers and updates disappear after ~7 days; that is a
 *     product consequence, not a bug, and the scheduler surfaces it.
 */

import { composeCaption, detectMediaKind, isFetchableUrl } from "../media";
import { PublisherError } from "../contracts";
import type { PublishInput, PublishResult } from "../contracts";

const GBP_API = "https://mybusiness.googleapis.com/v4";

/** CTA types accepted by the v4 localPosts endpoint. */
const CTA_TYPES = ["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"] as const;
type CtaType = (typeof CTA_TYPES)[number];

/** Topic types: what kind of local post this is. */
const TOPIC_TYPES = ["STANDARD", "EVENT", "OFFER", "ALERT"] as const;
type TopicType = (typeof TOPIC_TYPES)[number];

interface ResolvedTarget {
  accountName: string; // accounts/{id}
  locationName: string; // locations/{id}
}

function resolveTarget(input: PublishInput): ResolvedTarget {
  const cfg = input.channelConfig;
  const accountId =
    (cfg.account_id as string | undefined) ??
    // external_id is stored as "accounts/{a}/locations/{l}" on connect.
    (typeof cfg.external_id === "string" ? cfg.external_id.split("/")[1] : undefined);
  const locationId =
    (cfg.location_id as string | undefined) ??
    (typeof cfg.external_id === "string" ? cfg.external_id.split("/").pop() : undefined);

  if (!accountId || !locationId) {
    throw new PublisherError(
      "Canal do Google Business sem account_id/location_id. Reconecte o canal e escolha a loja.",
      { retryable: false },
    );
  }
  return { accountName: `accounts/${accountId}`, locationName: `locations/${locationId}` };
}

function accessTokenFor(input: PublishInput): string {
  const t =
    (input.channelConfig.access_token as string | undefined) ??
    (input.channelConfig.accessToken as string | undefined);
  if (!t) {
    throw new PublisherError("Canal do Google Business sem access_token — reconecte o canal.", {
      retryable: false,
    });
  }
  return t;
}

/** Picks a CTA from the channel config, defaulting to LEARN_MORE (always valid). */
function resolveCta(input: PublishInput, summary: string): { actionType: CtaType; url: string } {
  const configured = (input.channelConfig.cta_type as string | undefined)?.toUpperCase();
  const actionType: CtaType = CTA_TYPES.includes(configured as CtaType)
    ? (configured as CtaType)
    : "LEARN_MORE";

  // CALL takes a phone number instead of a URL.
  if (actionType === "CALL") {
    const phone = (input.channelConfig.phone as string | undefined) ?? extractPhone(summary);
    if (!phone) {
      // Fall back rather than fail: a post without CTA is rejected by the API.
      return { actionType: "LEARN_MORE", url: resolveUrl(input) };
    }
    return { actionType: "CALL", url: phone };
  }

  return { actionType, url: resolveUrl(input) };
}

function resolveUrl(input: PublishInput): string {
  const cfg = input.channelConfig;
  const payloadMeta = (input.payload.metadata ?? {}) as Record<string, unknown>;
  const explicit =
    (cfg.cta_url as string | undefined) ??
    (cfg.website as string | undefined) ??
    (payloadMeta.cta_url as string | undefined);
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit;

  // Derive from the body: the first URL the user wrote.
  const fromBody = `${input.payload.body ?? ""}`.match(/\bhttps?:\/\/[^\s]+/i)?.[0];
  if (fromBody) return fromBody;

  // Last resort: the Maps listing. Always a valid destination for a local post.
  const locId = cfg.location_id as string | undefined;
  if (locId) return `https://www.google.com/maps/place/?q=place_id:${locId}`;

  throw new PublisherError(
    "Google Business exige um link de destino no botão. Configure o site do canal ou inclua um link no texto.",
    { retryable: false },
  );
}

function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
  return m ? m[0] : null;
}

function resolveTopic(input: PublishInput): TopicType {
  const configured = (input.channelConfig.topic_type as string | undefined)?.toUpperCase();
  if (TOPIC_TYPES.includes(configured as TopicType)) return configured as TopicType;
  // Heuristic: an explicit price/promo in the copy reads as an offer.
  return /(r\$\s?\d|off|desconto|\d+%\s*(de|off)|promoç)/i.test(input.payload.body ?? "")
    ? "OFFER"
    : "STANDARD";
}

export async function publishGoogleBusiness(input: PublishInput): Promise<PublishResult> {
  const token = accessTokenFor(input);
  const { accountName, locationName } = resolveTarget(input);

  const summary = composeCaption(input.payload.title, input.payload.body).slice(0, 1500);
  if (summary.trim().length < 10) {
    throw new PublisherError("Google Business exige um texto com pelo menos 10 caracteres.", {
      retryable: false,
    });
  }

  const cta = resolveCta(input, summary);
  const topicType = resolveTopic(input);

  const mediaUrls = (input.payload.media_urls ?? []).filter(isFetchableUrl);
  const image = mediaUrls.find((u) => detectMediaKind(u) === "image");

  const body: Record<string, unknown> = {
    languageCode: (input.channelConfig.language_code as string | undefined) ?? "pt-BR",
    summary,
    callToAction: {
      actionType: cta.actionType,
      ...(cta.actionType === "CALL" ? { url: cta.url } : { url: cta.url }),
    },
    topicType,
  };

  if (image) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: image }];
  }

  if (topicType === "EVENT") {
    const start = input.channelConfig.event_start as string | undefined;
    const end = input.channelConfig.event_end as string | undefined;
    if (!start || !end) {
      throw new PublisherError(
        "Post do tipo EVENT exige as datas de início e fim do evento no canal.",
        { retryable: false },
      );
    }
    body.event = {
      title: input.payload.title ?? "Evento",
      schedule: { startDate: start, endDate: end },
    };
  }

  if (topicType === "OFFER") {
    const coupon = input.channelConfig.coupon_code as string | undefined;
    body.offer = {
      ...(coupon ? { couponCode: coupon } : {}),
      redeemOnlineUrl: cta.url,
      terms: input.channelConfig.offer_terms ?? "Consulte condições na loja.",
    };
  }

  const res = await fetch(`${GBP_API}/${accountName}/${locationName}/localPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: { name?: string; error?: { message?: string; status?: string } } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* keep raw text */
  }

  if (!res.ok || !json.name) {
    const detail = json.error?.message ?? text.slice(0, 400);
    const retryable = res.status >= 500 || res.status === 429;
    // 403 here almost always means the location is unverified or the project
    // lacks Business Profile API approval — retrying will never fix that.
    throw new PublisherError(
      `Google Business recusou a publicação (${res.status}): ${detail}` +
        (res.status === 403
          ? " Verifique se a unidade está verificada e se o projeto tem acesso às Business Profile APIs."
          : ""),
      { retryable },
    );
  }

  return {
    externalPostId: json.name,
    raw: { topicType, actionType: cta.actionType, expiresInDays: 7 },
  };
}
