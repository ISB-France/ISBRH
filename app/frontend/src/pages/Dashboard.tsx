import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import AppLayout from "../components/AppLayout";
import LoadingScreen from "../components/LoadingScreen";
import ErrorScreen from "../components/ErrorScreen";
import api from "../api";
import type { InterviewStats } from "../types";

export default function Dashboard() {
  const { data: stats, isLoading, error, refetch } = useQuery<InterviewStats>({
    queryKey: ["interview-stats"],
    queryFn: () => api.get("/interviews/stats/").then((r) => r.data),
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message="Impossible de charger les statistiques" onRetry={refetch} />;

  const statusMap: Record<string, number> = {};
  stats?.by_status.forEach((s) => { statusMap[s.status] = s.count; });

  const cards = [
    { label: "Total entretiens", value: stats?.total ?? 0, icon: FileText, color: "" },
    { label: "Brouillons", value: statusMap["draft"] ?? 0, icon: Clock, color: "text-muted-foreground" },
    { label: "En cours", value: statusMap["in_progress"] ?? 0, icon: CalendarClock, color: "text-blue-500" },
    { label: "En retard", value: stats?.overdue ?? 0, icon: AlertTriangle, color: "text-isb-coral" },
    { label: "Terminés", value: statusMap["completed"] ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "À venir", value: stats?.upcoming ?? 0, icon: Clock, color: "text-isb-terracotta" },
  ];

  return (
    <AppLayout>
      <h1 className="mb-6 font-display text-2xl font-bold">Tableau de bord</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <card.icon className={`h-8 w-8 ${card.color || "text-primary"}`} />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="pb-3">Type</th>
                <th className="pb-3">Nombre</th>
              </tr>
            </thead>
            <tbody>
              {stats?.by_type.map((t) => (
                <tr key={t.type} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <Badge variant={t.type as "annual" | "professional" | "bilan" | "forfait" | "fin_carriere"}>
                      {{ annual: "Évaluation", professional: "Professionnel", bilan: "Bilan", forfait: "Forfait jours", fin_carriere: "Fin de carrière" }[t.type] || t.type}
                    </Badge>
                  </td>
                  <td className="py-3 font-medium">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
