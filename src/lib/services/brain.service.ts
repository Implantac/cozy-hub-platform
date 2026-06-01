import {
  runBrainRecommend,
  listRecommendations,
  listMemories,
  addMemory,
} from "@/lib/api/brain.functions";

export const recommend = (workspaceId: string) =>
  runBrainRecommend({ data: { workspaceId } });

export const recommendations = (workspaceId: string) =>
  listRecommendations({ data: { workspaceId } });

export const memories = (workspaceId: string) =>
  listMemories({ data: { workspaceId } });

export const remember = (workspaceId: string, kind: string, content: string) =>
  addMemory({ data: { workspaceId, kind: kind as any, content } });
