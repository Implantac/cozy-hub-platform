import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  user: User | null;
  loading: boolean;
};

const WORKSPACE_STORAGE_KEY = "digitalos.current_workspace_id";

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
  // Clear any per-user UI state held in localStorage to avoid leaking
  // workspace context to the next user that signs in on the same browser.
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      /* ignore quota / privacy mode errors */
    }
  }
  await supabase.auth.signOut();
}
