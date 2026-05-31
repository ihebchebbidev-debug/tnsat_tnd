import { useMemo, useState } from "react";
import { useLang } from "@/store/LangContext";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import type { ApiOrder, ApiClient, ApiService } from "@/utils/api";

interface Props {
  orders: ApiOrder[];
  clients: ApiClient[];
  services: ApiService[];
}

type Period = "7d" | "30d" | "all";

const COLORS = [
  "hsl(228, 76%, 52%)",
  "hsl(196, 80%, 50%)",
  "hsl(160, 72%, 38%)",
  "hsl(260, 70%, 58%)",
  "hsl(0, 72%, 51%)",
  "hsl(40, 90%, 50%)",
];

const AnalyticsCharts = ({ orders, clients, services }: Props) => {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("30d");

  const filteredOrders = useMemo(() => {
    if (period === "all") return orders;
    const now = new Date();
    const days = period === "7d" ? 7 : 30;
    const cutoff = new Date(now.getTime() - days * 86400000);
    return orders.filter(o => new Date(o.created_at) >= cutoff);
  }, [orders, period]);

  // Orders per day
  const ordersPerDay = useMemo(() => {
    const map = new Map<string, { orders: number; revenue: number }>();
    filteredOrders.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      const rev = Number(o.credits_used);
      const prev = map.get(day) || { orders: 0, revenue: 0 };
      map.set(day, { orders: prev.orders + 1, revenue: prev.revenue + rev });
    });
    return Array.from(map.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => {
        const [dA, mA] = a.date.split("/").map(Number);
        const [dB, mB] = b.date.split("/").map(Number);
        return mA !== mB ? mA - mB : dA - dB;
      });
  }, [filteredOrders, services]);

  // Revenue by service (pie)
  const revenueByService = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => {
      const svc = services.find(s => s.id === o.service_id);
      if (!svc) return;
      const name = svc.name;
      map.set(name, (map.get(name) || 0) + Number(o.credits_used));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders, services]);

  // Active clients (those with orders)
  const activeClientsCount = useMemo(() => {
    const ids = new Set(filteredOrders.filter(o => o.client_id).map(o => o.client_id));
    return ids.size;
  }, [filteredOrders]);

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach(o => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      name: t(status as any) || status,
      value: count,
    }));
  }, [filteredOrders, t]);

  const totalRevenue = filteredOrders.reduce((sum, o) => {
    return sum + Number(o.credits_used);
  }, 0);

  const periodButtons: { key: Period; label: string }[] = [
    { key: "7d", label: t("last7Days") },
    { key: "30d", label: t("last30Days") },
    { key: "all", label: t("allTime") },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t("analyticsPeriod")}</span>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
          {periodButtons.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.key
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label={t("periodRevenue")} value={`${totalRevenue.toFixed(0)} TND`} />
        <MiniStat label={t("periodOrders")} value={filteredOrders.length.toString()} />
        <MiniStat label={t("activeClients")} value={activeClientsCount.toString()} />
        <MiniStat label={t("avgOrderValue")} value={filteredOrders.length > 0 ? `${(totalRevenue / filteredOrders.length).toFixed(1)} TND` : "0"} />
      </div>

      {/* Charts grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display font-bold text-foreground text-sm">{t("revenueChart")}</h3>
          </div>
          {ordersPerDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ordersPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="revenue" name="TNDs" fill="hsl(228, 76%, 52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">{t("noDataForPeriod")}</div>
          )}
        </div>

        {/* Orders trend */}
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="font-display font-bold text-foreground text-sm">{t("ordersChart")}</h3>
          </div>
          {ordersPerDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ordersPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="orders" name={t("orders")} stroke="hsl(196, 80%, 50%)" strokeWidth={2} dot={{ fill: "hsl(196, 80%, 50%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">{t("noDataForPeriod")}</div>
          )}
        </div>

        {/* Revenue by service */}
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
          <h3 className="font-display font-bold text-foreground text-sm mb-6">{t("revenueByService")}</h3>
          {revenueByService.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={revenueByService} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {revenueByService.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => `${value.toFixed(0)} TND`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">{t("noDataForPeriod")}</div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
          <h3 className="font-display font-bold text-foreground text-sm mb-6">{t("orderStatusBreakdown")}</h3>
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">{t("noDataForPeriod")}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-all">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">{label}</p>
    <p className="text-xl font-display font-bold text-foreground tracking-tight">{value}</p>
  </div>
);

export default AnalyticsCharts;
