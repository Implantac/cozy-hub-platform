import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { safeAppReturnTo } from "@/lib/auth/return-to";

export const Route = createFileRoute("/_authenticated")({
  // Sessions live in browser storage. Do not run a session-less SSR guard and
  // discard the user's deep link. Public pages retain SSR; private RPCs still
  // validate the bearer token on the server and RLS remains the security boundary.
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: safeAppReturnTo(location.href) },
        replace: true,
      });
    }
  },
  component: () => <Outlet />,
});
