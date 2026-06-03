import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

type Props = {
  workspace: { name: string; slug: string; plan: string };
};

export function WorkspaceTab({ workspace }: Props) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6">
      <h3 className="text-sm font-semibold">{workspace.name}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        /{workspace.slug} · {t("settings.plan", "plano")}:{" "}
        <Badge variant="secondary" className="ml-1">{workspace.plan}</Badge>
      </p>
    </div>
  );
}
