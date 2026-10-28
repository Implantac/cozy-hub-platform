import { Mail, MapPin, MessageCircle, Phone, ShoppingBag, Link2 } from "lucide-react";
import type { PublicBioPage } from "@/lib/bio/types";

interface ThemeStyle {
  bg: string;
  card: string;
  text: string;
  accent: string;
}

const ICONS = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  product: ShoppingBag,
  link: Link2,
} as const;

/**
 * The public page.
 *
 * Constraints that shaped it:
 *  - No external CSS or fonts. It renders inside sandboxed iframes and must work
 *    with zero network beyond the document itself, so everything is inline.
 *  - Every link goes through /bio/click/{id} so clicks are countable server-side.
 *  - Themes come from a server-side allowlist, never from user CSS.
 *  - Mobile-first: this page is opened from an app bio, ~100% on a phone.
 */
export function PublicBioView({ page, theme }: { page: PublicBioPage; theme: ThemeStyle }) {
  const initial = (page.headline ?? page.workspaceName ?? "V").trim().charAt(0).toUpperCase();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: theme.bg,
        color: theme.text,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px 56px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Identity */}
        <header style={{ textAlign: "center", marginBottom: 28 }}>
          {page.avatarUrl ? (
            <img
              src={page.avatarUrl}
              alt=""
              width={88}
              height={88}
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                objectFit: "cover",
                margin: "0 auto 14px",
                display: "block",
                border: `2px solid ${theme.accent}55`,
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                margin: "0 auto 14px",
                display: "grid",
                placeItems: "center",
                fontSize: 34,
                fontWeight: 700,
                background: `${theme.accent}30`,
                border: `2px solid ${theme.accent}55`,
              }}
            >
              {initial}
            </div>
          )}

          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
            {page.headline ?? page.workspaceName}
          </h1>

          {page.bio && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                lineHeight: 1.55,
                opacity: 0.78,
                whiteSpace: "pre-line",
              }}
            >
              {page.bio}
            </p>
          )}
        </header>

        {/* Links */}
        <nav style={{ display: "grid", gap: 10 }}>
          {page.links.map((link) => {
            const Icon = ICONS[(link.kind as keyof typeof ICONS) ?? "link"] ?? Link2;
            return (
              <a
                key={link.id}
                href={`/bio/click/${link.id}`}
                // noreferrer here too: the redirect strips it, and this covers
                // the case where the endpoint is bypassed by a preview crawler.
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "15px 18px",
                  borderRadius: 14,
                  background: theme.card,
                  color: theme.text,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 15,
                  fontWeight: 600,
                  backdropFilter: "blur(8px)",
                  transition: "transform .15s ease, filter .15s ease",
                }}
              >
                <Icon size={18} style={{ opacity: 0.85, flexShrink: 0 }} aria-hidden />
                <span style={{ flex: 1, textAlign: "center" }}>{link.label}</span>
                {/* Spacer keeps the label optically centred next to the icon. */}
                <span style={{ width: 18, flexShrink: 0 }} aria-hidden />
              </a>
            );
          })}

          {page.links.length === 0 && (
            <p style={{ textAlign: "center", fontSize: 13, opacity: 0.6 }}>
              Nenhum link publicado ainda.
            </p>
          )}
        </nav>

        <footer
          style={{
            marginTop: 36,
            textAlign: "center",
            fontSize: 11,
            opacity: 0.45,
            letterSpacing: "0.04em",
          }}
        >
          <MapPin
            size={11}
            style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }}
            aria-hidden
          />
          feito com VELT
        </footer>
      </div>
    </main>
  );
}
