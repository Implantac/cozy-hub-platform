/**
 * Platform publisher stubs (server-only).
 *
 * Each publisher takes a job + channel config and returns the external post id.
 * Real OAuth-backed implementations will replace these stubs in Phase 3.2.
 *
 * IMPORTANT: file uses the `.server.ts` extension so the bundler refuses to
 * include it in client code (it reads OAUTH_TOKEN_ENC_KEY and admin tables).
 */

export type Platform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x"
  | "threads"
  | "pinterest";

export interface PublishInput {
  jobId: string;
  workspaceId: string;
  channelId: string;
  contentId: string;
  platform: Platform;
  payload: {
    title?: string | null;
    body?: string | null;
    media_urls?: string[];
    [k: string]: unknown;
  };
  channelConfig: Record<string, unknown>;
}

export interface PublishResult {
  externalPostId: string;
  raw?: Record<string, unknown>;
}

export class PublisherError extends Error {
  readonly retryable: boolean;
  constructor(message: string, opts: { retryable?: boolean } = {}) {
    super(message);
    this.name = "PublisherError";
    this.retryable = opts.retryable ?? true;
  }
}

/**
 * Stub publisher: simulates a successful publish and returns a synthetic
 * external id so the rest of the pipeline (DLQ, retries, analytics) can be
 * exercised end-to-end before OAuth integrations land.
 */
async function stubPublish(input: PublishInput): Promise<PublishResult> {
  const ts = Date.now();
  const externalPostId = `${input.platform}_stub_${ts}_${input.jobId.slice(0, 8)}`;
  // Surface trace in server logs so a tick is observable in production.
  console.log(
    `[publisher:${input.platform}] stub publish ok job=${input.jobId} ext=${externalPostId}`,
  );
  return { externalPostId, raw: { stub: true, ts } };
}

const REGISTRY: Record<Platform, (i: PublishInput) => Promise<PublishResult>> = {
  instagram: stubPublish,
  facebook: stubPublish,
  youtube: stubPublish,
  tiktok: stubPublish,
  linkedin: stubPublish,
  x: stubPublish,
  threads: stubPublish,
  pinterest: stubPublish,
};

export async function publishToPlatform(input: PublishInput): Promise<PublishResult> {
  const fn = REGISTRY[input.platform];
  if (!fn) {
    throw new PublisherError(`No publisher registered for platform: ${input.platform}`, {
      retryable: false,
    });
  }
  return fn(input);
}
