import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

type Props = {
  workspace: { name: string; slug: string; plan: string };
};

export function WorkspaceTab({ workspace }: Props) {
  const { t } = useTranslation();
  return (
    <div className="section-card p-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {workspace.name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        /{workspace.slug} · {t("settings.plan", "plano")}:{" "}
        <Badge variant="secondary" className="ml-1">
          {workspace.plan}
        </Badge>
      </p>
    </div>
  );
}
