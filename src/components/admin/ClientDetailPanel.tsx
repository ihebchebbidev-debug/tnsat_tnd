import { useState, useEffect } from "react";
import { ArrowLeft, Zap, ShoppingCart, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle, User, Mail, Calendar, Loader2 } from "lucide-react";
import { apiGetOrders, apiGetPointTransactions, type ApiOrder, type ApiPointTransaction, type ApiClient } from "@/utils/api";

interface ClientDetailPanelProps {
  client: ApiClient;
  onBack: () => void;
}

const ClientDetailPanel = ({ client, onBack }: ClientDetailPanelProps) => {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [transactions, setTransactions] = useState<ApiPointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "transactions">("orders");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [o, t] = await Promise.all([
          apiGetOrders(client.id),
          apiGetPointTransactions(client.id),
        ]);
        setOrders(o);
        setTransactions(t);
      } catch (e) {
        console.error("Failed to load client details:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [client.id]);

  const totalSpent = orders.reduce((sum, o) => sum + Number(o.credits_used), 0);
  const activeOrders = orders.filter(o => o.status === "fulfilled").length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-600", icon: Clock, label: "En attente" },
      fulfilled: { bg: "bg-success/10", text: "text-success", icon: CheckCircle, label: "Livrée" },
      disputed: { bg: "bg-destructive/10", text: "text-destructive", icon: AlertTriangle, label: "Contestée" },
      resolved: { bg: "bg-primary/10", text: "text-primary", icon: CheckCircle, label: "Résolue" },
      cancelled: { bg: "bg-muted", text: "text-muted-foreground", icon: XCircle, label: "Annulée" },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-xs font-medium`}><Icon className="h-3 w-3" />{s.label}</span>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Retour à la liste
      </button>

      {/* Client Header Card */}
      <div className="bg-card rounded-2xl border border-border shadow-premium p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl gradient-primary text-primary-foreground text-xl sm:text-2xl font-bold shadow-glow flex-shrink-0">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-display font-bold text-foreground truncate">{client.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{client.email}</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{client.created_at ? new Date(client.created_at).toLocaleDateString() : "—"}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {client.is_active ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium"><CheckCircle className="h-3 w-3" />Actif</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium"><XCircle className="h-3 w-3" />Inactif</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat icon={Zap} label="Solde actuel" value={`${client.credits.toLocaleString()} TND`} color="primary" />
        <MiniStat icon={ShoppingCart} label="Commandes" value={orders.length.toString()} color="accent" />
        <MiniStat icon={TrendingDown} label="TND dépensés" value={totalSpent.toLocaleString()} color="destructive" />
        <MiniStat icon={CheckCircle} label="Actives" value={activeOrders.toString()} color="success" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "orders" ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Abonnements ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "transactions" ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Transactions ({transactions.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              {orders.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Aucune commande pour ce client</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Service</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">TNDs</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Durée</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Date</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Statut</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Identifiants</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground">{o.service_name || "—"}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-semibold">
                                <Zap className="h-3 w-3" />{o.credits_used}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{o.duration_months || 12} mois</td>
                            <td className="py-3 px-4 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">{getStatusBadge(o.status)}</td>
                            <td className="py-3 px-4">
                              {o.credentials ? (
                                <div className="text-xs space-y-0.5 max-w-[200px]">
                                  {Object.entries(o.credentials).map(([k, v]) => (
                                    <div key={k} className="truncate"><span className="text-muted-foreground">{k}:</span> <span className="text-foreground font-mono">{v}</span></div>
                                  ))}
                                </div>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-border">
                    {orders.map(o => (
                      <div key={o.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-foreground text-sm">{o.service_name || "—"}</h4>
                          {getStatusBadge(o.status)}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 text-primary font-semibold">
                            <Zap className="h-3 w-3" />{o.credits_used} TND
                          </span>
                          <span className="text-muted-foreground">{o.duration_months || 12} mois</span>
                          <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                        </div>
                        {o.credentials && (
                          <div className="bg-secondary/50 rounded-lg p-2 text-xs space-y-0.5">
                            {Object.entries(o.credentials).map(([k, v]) => (
                              <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground font-mono">{v}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              {transactions.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Aucune transaction pour ce client</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Type</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Montant</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Solde après</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Description</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(tx => (
                          <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-4">
                              {tx.type === "credit" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                                  <TrendingUp className="h-3 w-3" />TND
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                                  <TrendingDown className="h-3 w-3" />Débit
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`font-semibold ${tx.type === "credit" ? "text-success" : "text-destructive"}`}>
                                {tx.type === "credit" ? "+" : "−"}{tx.amount} TND
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-foreground font-medium">
                                <Zap className="h-3 w-3 text-primary" />{tx.balance_after}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px] truncate">{tx.description || "—"}</td>
                            <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-border">
                    {transactions.map(tx => (
                      <div key={tx.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {tx.type === "credit" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                              <TrendingUp className="h-3 w-3" />TND
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                              <TrendingDown className="h-3 w-3" />Débit
                            </span>
                          )}
                          <span className={`font-bold text-sm ${tx.type === "credit" ? "text-success" : "text-destructive"}`}>
                            {tx.type === "credit" ? "+" : "−"}{tx.amount} TND
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{tx.description || "—"}</span>
                          <span className="inline-flex items-center gap-1 text-foreground font-medium">
                            Solde: <Zap className="h-3 w-3 text-primary" />{tx.balance_after}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MiniStat = ({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) => (
  <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
    <div className="flex items-center gap-2 mb-1.5">
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${
        color === "primary" ? "bg-primary/10" : color === "accent" ? "bg-accent/10" : color === "success" ? "bg-success/10" : "bg-destructive/10"
      }`}>
        <Icon className={`h-3.5 w-3.5 ${
          color === "primary" ? "text-primary" : color === "accent" ? "text-accent" : color === "success" ? "text-success" : "text-destructive"
        }`} />
      </span>
    </div>
    <p className="text-lg sm:text-xl font-display font-bold text-foreground">{value}</p>
    <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
  </div>
);

export default ClientDetailPanel;
