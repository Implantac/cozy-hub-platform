/**
 * Google Business Profile local posts (v4).
 * A resource name/HTTP 200 alone is not evidence that a post is LIVE.
 * https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
 */
import { composeCaption, detectMediaKind, isFetchableUrl } from "../media";
import { PublisherError, type PublishInput, type PublishResult } from "../contracts";

const GBP_API = "https://mybusiness.googleapis.com/v4";
const CTA_TYPES = ["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"] as const;
const TOPIC_TYPES = ["STANDARD", "EVENT", "OFFER"] as const;
const STATUS_ATTEMPTS = 12;
const STATUS_INTERVAL_MS = 5_000;

type LocalPostResponse = { name?: string; state?: string };

function targetFor(input: PublishInput): string {
  const cfg = input.channelConfig;
  const canonical =
    typeof cfg.external_id === "string"
      ? cfg.external_id.match(/^accounts\/(\d+)\/locations\/(\d+)$/)
      : null;
  const account = cfg.account_id ?? canonical?.[1];
  const location = cfg.location_id ?? canonical?.[2];
  if (
    typeof account !== "string" ||
    typeof location !== "string" ||
    !/^\d+$/.test(account) ||
    !/^\d+$/.test(location)
  ) {
    throw new PublisherError(
      "Canal do Google Business sem account_id/location_id válidos. Reconecte e selecione a unidade.",
      { retryable: false },
    );
  }
  return `accounts/${account}/locations/${location}`;
}

function destination(input: PublishInput): string | undefined {
  const cfg = input.channelConfig;
  const explicit = cfg.cta_url ?? cfg.website;
  const fromBody = input.payload.body?.match(/\bhttps?:\/\/[^\s]+/i)?.[0]?.replace(/[.,;!)]+$/, "");
  const value = explicit ?? fromBody;
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !isFetchableUrl(value)) {
    throw new PublisherError("O botão do Google Business exige uma URL HTTPS pública válida.", {
      retryable: false,
    });
  }
  return value;
}

function eventTime(value: unknown): {
  date: { year: number; month: number; day: number };
  time: { hours: number; minutes: number; seconds: number; nanos: number };
  order: number;
} {
  const match =
    typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/) : null;
  if (!match)
    throw new PublisherError("EVENT/OFFER exige datas locais completas em AAAA-MM-DDTHH:mm.", {
      retryable: false,
    });
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  const order = Date.UTC(year, month - 1, day, hours, minutes);
  const date = new Date(order);
  if (
    year < 100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hours ||
    date.getUTCMinutes() !== minutes
  ) {
    throw new PublisherError("Data de evento/oferta inválida.", { retryable: false });
  }
  return { date: { year, month, day }, time: { hours, minutes, seconds: 0, nanos: 0 }, order };
}

/** Pure preflight; no token read, external request or guessed Maps place ID. */
export function googleBusinessPostBody(input: PublishInput): Record<string, unknown> {
  targetFor(input);
  const cfg = input.channelConfig;
  const summary = composeCaption(input.payload.title, input.payload.body);
  if (summary.length < 10 || summary.length > 1500) {
    throw new PublisherError("Google Business exige um texto de 10 a 1500 caracteres.", {
      retryable: false,
    });
  }
  const topic = typeof cfg.topic_type === "string" ? cfg.topic_type.toUpperCase() : "STANDARD";
  if (!TOPIC_TYPES.includes(topic as (typeof TOPIC_TYPES)[number])) {
    throw new PublisherError("Tipo de post do Google Business não suportado neste fluxo.", {
      retryable: false,
    });
  }
  const body: Record<string, unknown> = {
    languageCode: typeof cfg.language_code === "string" ? cfg.language_code : "pt-BR",
    summary,
    topicType: topic,
  };
  const cta = typeof cfg.cta_type === "string" ? cfg.cta_type.toUpperCase() : undefined;
  if (cta && !CTA_TYPES.includes(cta as (typeof CTA_TYPES)[number])) {
    throw new PublisherError("Tipo de botão do Google Business inválido.", { retryable: false });
  }
  // CALL uses the listing's phone and MUST NOT carry a URL. CTA is optional.
  if (cta === "CALL") body.callToAction = { actionType: "CALL" };
  else {
    const url = destination(input);
    if (cta && !url)
      throw new PublisherError("Informe uma URL HTTPS para o botão selecionado.", {
        retryable: false,
      });
    if (url) body.callToAction = { actionType: cta ?? "LEARN_MORE", url };
  }

  const urls = input.payload.media_urls ?? [];
  if (
    urls.length > 1 ||
    urls.some((url) => !isFetchableUrl(url) || detectMediaKind(url) !== "image")
  ) {
    throw new PublisherError(
      "Este fluxo do Google Business aceita uma imagem HTTPS pública por post.",
      { retryable: false },
    );
  }
  if (urls[0]) body.media = [{ mediaFormat: "PHOTO", sourceUrl: urls[0] }];

  if (topic === "EVENT" || topic === "OFFER") {
    const start = eventTime(cfg.event_start);
    const end = eventTime(cfg.event_end);
    if (end.order <= start.order)
      throw new PublisherError("O término do evento/oferta deve ser posterior ao início.", {
        retryable: false,
      });
    const title =
      typeof cfg.event_title === "string" ? cfg.event_title.trim() : input.payload.title?.trim();
    if (!title)
      throw new PublisherError("Informe o título do evento/oferta.", { retryable: false });
    body.event = {
      title,
      schedule: {
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
      },
    };
  }
  if (topic === "OFFER") {
    const url = destination(input);
    body.offer = {
      ...(typeof cfg.coupon_code === "string" ? { couponCode: cfg.coupon_code } : {}),
      ...(url ? { redeemOnlineUrl: url } : {}),
      ...(typeof cfg.offer_terms === "string" ? { termsConditions: cfg.offer_terms } : {}),
    };
    delete body.callToAction; // Ignored by Google for offers; do not invent contradictory CTA data.
  }
  return body;
}

export async function publishGoogleBusiness(input: PublishInput): Promise<PublishResult> {
  const token = input.channelConfig.access_token;
  if (typeof token !== "string" || !token.trim()) {
    throw new PublisherError("Canal do Google Business sem access_token — reconecte o canal.", {
      retryable: false,
    });
  }
  const target = targetFor(input);
  const body = googleBusinessPostBody(input);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const res = await fetch(`${GBP_API}/${target}/localPosts`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let post: LocalPostResponse;
  try {
    post = (await res.json()) as LocalPostResponse;
  } catch {
    throw new PublisherError(
      "Google Business não retornou uma confirmação válida. Verifique o provedor.",
      { retryable: false },
    );
  }
  if (!res.ok) {
    throw new PublisherError(
      `Google Business recusou a publicação (${res.status}).` +
        (res.status === 403
          ? " Verifique a autorização e a verificação da unidade."
          : " Verifique o resultado antes de tentar novamente."),
      { retryable: res.status === 429 },
    );
  }
  const reference = post?.name;
  if (
    typeof reference !== "string" ||
    !reference.startsWith(`${target}/localPosts/`) ||
    !/^accounts\/\d+\/locations\/\d+\/localPosts\/[A-Za-z0-9_-]+$/.test(reference)
  ) {
    throw new PublisherError(
      "Google Business não retornou um identificador válido para a unidade selecionada.",
      { retryable: false },
    );
  }
  try {
    for (let attempt = 0; attempt < STATUS_ATTEMPTS; attempt++) {
      if (post.state === "LIVE" || post.state === "RECURRING")
        return { externalPostId: reference, raw: { state: post.state, topicType: body.topicType } };
      if (post.state === "REJECTED") break;
      if (attempt + 1 >= STATUS_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, STATUS_INTERVAL_MS));
      const status = await fetch(`${GBP_API}/${reference}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (!status.ok) break;
      post = (await status.json()) as LocalPostResponse;
      if (post.name !== reference) break;
    }
  } catch {
    /* Preserve the accepted upstream reference; do not issue another create. */
  }
  throw new PublisherError(
    "O post foi registrado no Google Business, mas o estado público LIVE não foi confirmado. Confira o provedor antes de republicar.",
    { retryable: false, externalPostId: reference },
  );
}
