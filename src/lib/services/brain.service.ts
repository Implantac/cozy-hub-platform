import {
  runBrainRecommend,
  listRecommendations,
  listMemories,
  addMemory,
} from "@/lib/api/brain.functions";
import type { MemoryKind } from "@/lib/api/_types";

export const recommend = (workspaceId: string) =>
  runBrainRecommend({ data: { workspaceId } });

export const recommendations = (workspaceId: string) =>
  listRecommendations({ data: { workspaceId } });

export const memories = (workspaceId: string) =>
  listMemories({ data: { workspaceId } });

export const remember = (workspaceId: string, kind: MemoryKind, content: string) =>
  addMemory({ data: { workspaceId, kind, content } });

