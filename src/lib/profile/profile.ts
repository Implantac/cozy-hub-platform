import { z } from "zod";

export const DISPLAY_NAME_MAX_LENGTH = 80;

/** A single user-scoped key is shared by bootstrap, account settings and updates. */
export const profileQueryKey = (userId: string | undefined) => ["my-profile", userId] as const;

export const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);

export const profileUpdateSchema = z.object({
  display_name: displayNameSchema.optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  locale: z.string().min(2).max(8).optional(),
});
