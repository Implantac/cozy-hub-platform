import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { requestLang, translateServer } from "@/lib/i18n/translate";
import { authErrorTranslationKey } from "@/lib/auth/auth-error-message";

export const Route = createFileRoute("/login")({
  head: async () => {
    const lang = await requestLang();
    return {
      meta: [{ title: translateServer(lang, "routes", "login", "Sign in · VELT") }],
    };
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState<"login" | "request" | "update">("login");
  const [resetNotice, setResetNotice] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const recoveryFlow = useRef(false);

  useEffect(() => {
    let active = true;
    const recoveryInUrl =
      window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).get("mode") === "reset";
    if (recoveryInUrl) {
      recoveryFlow.current = true;
      setResetMode("update");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active || recoveryFlow.current) return;
      if (data.session?.user) navigate({ to: "/app", replace: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryFlow.current = true;
        setResetMode("update");
        return;
      }
      if (event === "SIGNED_IN" && session?.user && !recoveryFlow.current) {
        navigate({ to: "/app", replace: true });
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(t(authErrorTranslationKey(error)));
    } catch (error) {
      toast.error(t(authErrorTranslationKey(error)));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResetNotice(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?mode=reset`,
      });
      if (error) {
        toast.error(t("auth.resetEmailFailed"));
      } else {
        setResetNotice(true);
      }
    } catch {
      toast.error(t("auth.resetEmailFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(t(authErrorTranslationKey(error)));
        return;
      }
      recoveryFlow.current = false;
      toast.success(t("auth.passwordUpdated"));
      navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(t(authErrorTranslationKey(error)));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error(t("auth.googleFailed"));
    } catch {
      toast.error(t("auth.googleFailed"));
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,oklch(0.72_0.2_285_/_0.15),transparent_50%)]" />

      <div className="w-full max-w-md card-premium p-8 sm:p-10 animate-rise-in">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand shadow-glow transition-transform group-hover:scale-110">
              <Brain className="size-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">VELT</span>
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {resetMode === "update"
              ? t("auth.resetPasswordTitle")
              : resetMode === "request"
                ? t("auth.forgotPassword")
                : t("auth.loginTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {resetMode === "update"
              ? t("auth.newPasswordInstructions")
              : resetMode === "request"
                ? t("auth.resetInstructions")
                : t("auth.loginSubtitle")}
          </p>
        </div>

        {resetMode === "login" && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm font-semibold transition-all hover:bg-card hover:border-primary/30 hover:shadow-soft active:scale-[0.98]"
            >
              <GoogleIcon />
              <span>{t("common.continueWithGoogle")}</span>
            </button>

            <div className="my-7 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              <div className="h-px flex-1 bg-border/50" />
              {t("common.or")}
              <div className="h-px flex-1 bg-border/50" />
            </div>
          </>
        )}

        <form
          onSubmit={
            resetMode === "request"
              ? handleReset
              : resetMode === "update"
                ? handleUpdatePassword
                : handleEmail
          }
          className="space-y-4"
        >
          {resetMode !== "update" && (
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="ml-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
              >
                {t("common.email")}
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          {resetMode === "request" && (
            <>
              {resetNotice && (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm"
                >
                  {t("auth.resetEmailSent")}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {loading ? t("auth.sendingReset") : t("auth.sendReset")}
              </button>
            </>
          )}

          {resetMode === "update" && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="ml-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  {t("auth.newPassword")}
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="ml-1 text-[11px] font-bold uppercase tracking-wider"
                >
                  {t("auth.confirmPassword")}
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {loading ? t("auth.creating") : t("auth.resetPasswordTitle")}
              </button>
            </>
          )}

          {resetMode === "login" && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="ml-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80"
                >
                  {t("common.password")}
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode("request");
                    setResetNotice(false);
                  }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5 hover:opacity-95 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50"
              >
                {loading ? t("auth.signingIn") : t("common.signIn")}
              </button>
            </>
          )}

          {resetMode === "request" && (
            <button
              type="button"
              onClick={() => {
                setResetMode("login");
                setResetNotice(false);
              }}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-secondary"
            >
              {t("auth.backToLogin")}
            </button>
          )}
        </form>

        {resetMode === "login" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              to="/signup"
              className="font-semibold text-primary hover:underline underline-offset-4"
            >
              {t("auth.createOne")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.2h5.5c-.2 1.5-1.7 4.3-5.5 4.3-3.3 0-6-2.7-6-6.1S8.7 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.9 14.6 3 12 3 6.9 3 2.8 7.1 2.8 12S6.9 21 12 21c6.9 0 9.2-4.8 9.2-7.3 0-.5-.1-.9-.1-1.3H12z"
      />
    </svg>
  );
}
