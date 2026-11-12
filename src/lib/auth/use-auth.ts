import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  loading: boolean;
};

import { workspaceStore } from "@/lib/workspace/workspace-store";

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let mounted = true;
    // onAuthStateChange fires INITIAL_SESSION on subscribe, so getSession() is redundant.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setState({ user: session?.user ?? null, loading: false });
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  workspaceStore.reset();
}
