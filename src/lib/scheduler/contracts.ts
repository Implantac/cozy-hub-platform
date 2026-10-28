/**
 * VELT — Publishing contracts.
 *
 * Extracted from `publishers.server.ts` so provider implementations can import
 * the types without creating a circular dependency with the registry that
 * imports them.
 */

import type { PlatformId } from "@/lib/growth/platform-rules";

/** Every platform the dispatcher knows how to route. */
export type Platform = PlatformId;

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

/**
 * Error type carried through the retry/DLQ pipeline.
 * `retryable: false` sends the job straight to the dead letter queue instead of
 * burning the remaining attempts on something that cannot succeed.
 */
export class PublisherError extends Error {
  readonly retryable: boolean;
  constructor(message: string, opts: { retryable?: boolean } = {}) {
    super(message);
    this.name = "PublisherError";
    this.retryable = opts.retryable ?? true;
  }
}
