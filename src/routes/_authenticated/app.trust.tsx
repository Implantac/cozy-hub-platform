import { createFileRoute } from "@tanstack/react-router";
import { History, Shield, ShieldAlert, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BeforeYouBuyTab } from "@/features/trust/components/BeforeYouBuyTab";
import { HistoryTab } from "@/features/trust/components/HistoryTab";
import { TrustAnalyzerTab } from "@/features/trust/components/TrustAnalyzerTab";

export const Route = createFileRoute("/_authenticated/app/trust")({
  component: TrustOSPage,
});

function TrustOSPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trust OS"
        subtitle="Analise perfis, cursos, fornecedores e produtos antes de investir tempo ou dinheiro."
        icon={Shield}
      />
      <Tabs defaultValue="analyzer" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="analyzer" className="gap-2">
            <ShieldAlert className="size-4" /> Trust Analyzer
          </TabsTrigger>
          <TabsTrigger value="buy" className="gap-2">
            <ShoppingCart className="size-4" /> Before You Buy
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="analyzer" className="space-y-4">
          <TrustAnalyzerTab />
        </TabsContent>
        <TabsContent value="buy" className="space-y-4">
          <BeforeYouBuyTab />
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
