import { z } from "zod";

const required = (max: number) => z.string().trim().min(1).max(max);
export const studioBriefSchema = z.object({
  workspaceId: z.string().uuid(),
  topic: required(300),
  audience: required(300),
  goal: required(300),
  sourceMaterial: z.string().trim().max(5000),
  platform: z.enum(["instagram", "youtube", "tiktok"]),
  duration: z.enum(["15", "30", "60"]),
  tone: z.enum(["educational", "friendly", "professional"]),
  language: z.enum(["pt-BR", "en-US"]),
});

export const studioScriptSchema = z.object({
  title: required(200),
  hook: required(500),
  narration: required(5000),
  scenes: required(3000),
  callToAction: required(500),
  caption: required(5000),
});
export const saveStudioDraftSchema = z
  .object({
    workspaceId: z.string().uuid(),
    draftId: z.string().uuid().optional(),
    brief: studioBriefSchema,
    script: studioScriptSchema,
  })
  .refine((data) => data.workspaceId === data.brief.workspaceId, {
    message: "Workspace mismatch",
  });

export type StudioBrief = z.infer<typeof studioBriefSchema>;
export type StudioScript = z.infer<typeof studioScriptSchema>;
export const studioMetadataSchema = z.object({
  studio: z.object({ version: z.literal(1), brief: studioBriefSchema, script: studioScriptSchema }),
});
