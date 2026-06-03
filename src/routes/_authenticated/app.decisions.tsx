import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Lightbulb, Target } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessValidatorTab } from "@/features/decisions/tabs/BusinessValidatorTab";
import { RealityCheckTab } from "@/features/decisions/tabs/RealityCheckTab";

export const Route = createFileRoute("/_authenticated/app/decisions")({
  component: DecisionOSPage,
});

function DecisionOSPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Decision OS"
          subtitle="Valide ideias, faça reality checks e decida com clareza antes de executar."
          icon={Target}
        />
        <Tabs defaultValue="validator" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="validator" className="gap-2">
              <Lightbulb className="size-4" /> Validador
            </TabsTrigger>
            <TabsTrigger value="reality" className="gap-2">
              <AlertTriangle className="size-4" /> Reality Check
            </TabsTrigger>
          </TabsList>
          <TabsContent value="validator" className="space-y-4">
            <BusinessValidatorTab />
          </TabsContent>
          <TabsContent value="reality" className="space-y-4">
            <RealityCheckTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
