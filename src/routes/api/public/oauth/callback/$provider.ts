import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallback } from "@/lib/oauth/callback.server";

export const Route = createFileRoute("/api/public/oauth/callback/$provider")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleOAuthCallback(request, params.provider),
    },
  },
});
