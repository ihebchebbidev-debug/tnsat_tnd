import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/store/LangContext";
import { getAuth, setAuth } from "@/store/store";
import {
  apiGetClient, apiGetServices, apiGetOrders, apiCreateOrder,
  apiGetComplaints, apiCreateComplaint, apiGetNotifications,
  apiMarkNotificationRead, apiMarkAllNotificationsRead,
  apiGetDeliveryTypes, apiGetPointTransactions, apiGetCategories,
  type ApiService, type ApiOrder, type ApiComplaint, type ApiNotification, type ApiDeliveryType, type ApiPointTransaction, type ApiCategory,
} from "@/utils/api";
import { getCategoryImage } from "@/utils/categoryImages";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Zap, Package, FileText, LogOut,
  TrendingUp, Clock, CheckCircle, User, ArrowRight, Eye, ArrowLeft,
  AlertTriangle, Bell, XCircle, Send, Calendar, History, ArrowUpCircle, ArrowDownCircle, Filter
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface ClientData {
  id: string;
  name: string;
  email: string;
  credits: number;
}

const ClientDashboard = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [client, setClient] = useState<ClientData | null>(null);
  const [services, setServices] = useState<ApiService[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [deliveryTypes, setDeliveryTypes] = useState<ApiDeliveryType[]>([]);
  const [pointTransactions, setPointTransactions] = useState<ApiPointTransaction[]>([]);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"services" | "orders" | "history" | "account" | "notifications">("services");

  // History filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Complaint form
  const [showComplaint, setShowComplaint] = useState<ApiOrder | null>(null);
  const [complaintReason, setComplaintReason] = useState<"expired" | "not_working" | "wrong_credentials" | "other">("not_working");
  const [complaintMessage, setComplaintMessage] = useState("");

  // View credentials
  const [viewCredsOrder, setViewCredsOrder] = useState<ApiOrder | null>(null);



  // Purchase dialog
  const [purchaseService, setPurchaseService] = useState<ApiService | null>(null);
  const [purchaseMonths, setPurchaseMonths] = useState(12);
  const [purchasing, setPurchasing] = useState(false);
  const reload = useCallback(async (clientId: string) => {
    try {
      const [c, s, o, comp, notifs, dt, cats] = await Promise.all([
        apiGetClient(clientId),
        apiGetServices(),
        apiGetOrders(clientId),
        apiGetComplaints(clientId),
        apiGetNotifications(clientId),
        apiGetDeliveryTypes(),
        apiGetCategories().catch(() => [] as ApiCategory[]),
      ]);
      setClient({ id: c.id, name: c.name, email: c.email, credits: Number(c.credits) });
      setServices(s);
      setOrders(o);
      setComplaints(comp);
      setNotifications(notifs);
      setApiCategories(cats);
      setDeliveryTypes(dt);
      // Load point transactions separately (may not exist yet)
      try {
        const txs = await apiGetPointTransactions(clientId);
        setPointTransactions(txs);
      } catch { setPointTransactions([]); }
    } catch (e: any) {
      console.error("Failed to load data:", e);
      toast({ title: t("error"), description: e.message || t("loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  const categories = useMemo(() => {
    if (apiCategories.length > 0) return apiCategories.map(c => c.name);
    const cats = new Set<string>();
    services.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats);
  }, [services, apiCategories]);

  const filteredServices = useMemo(() => {
    if (selectedCategory === "all") return services;
    return services.filter(s => s.category === selectedCategory);
  }, [services, selectedCategory]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.type !== "client" || !auth.clientId) { navigate("/login"); return; }
    reload(auth.clientId);
    const interval = setInterval(async () => {
      try {
        const [notifs, o] = await Promise.all([
          apiGetNotifications(auth.clientId!),
          apiGetOrders(auth.clientId!),
        ]);
        setNotifications(notifs);
        setOrders(o);
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [reload, navigate]);

  const handleBuy = (serviceId: string) => {
    if (!client) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    if (client.credits < Number(service.price_credits)) {
      toast({ title: t("error"), description: t("notEnoughPoints"), variant: "destructive" });
      return;
    }
    setPurchaseService(service);
    setPurchaseMonths(12);
  };

  const confirmPurchase = async () => {
    if (!client || !purchaseService) return;
    setPurchasing(true);
    try {
      const res = await apiCreateOrder({ client_id: client.id, service_id: purchaseService.id, duration_months: purchaseMonths });
      toast({ title: t("success"), description: t("purchaseSuccess") });
      if (res.credits_remaining !== undefined) {
        setClient(prev => prev ? { ...prev, credits: res.credits_remaining } : prev);
      }
      setPurchaseService(null);
      reload(client.id);
    } catch (e: any) {
      if (e?.data?.no_stock) {
        toast({ title: "🚫 " + t("outOfStockTitle"), description: t("outOfStockMessage"), variant: "destructive" });
      } else {
        toast({ title: t("error"), description: e.message, variant: "destructive" });
      }
    } finally {
      setPurchasing(false);
    }
  };

  const submitComplaint = async () => {
    if (!showComplaint || !client) return;
    try {
      await apiCreateComplaint({
        order_id: showComplaint.id,
        client_id: client.id,
        reason: complaintReason,
        message: complaintMessage,
      });
      setShowComplaint(null);
      setComplaintMessage("");
      toast({ title: t("success"), description: t("complaintSubmitted") });
      reload(client.id);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    if (!client) return;
    try {
      await apiMarkAllNotificationsRead(client.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      toast({ title: t("success"), description: t("notificationsMarkedRead") });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };



  const getServiceName = (id: string) => services.find((s) => s.id === id)?.name || "—";

  const handleLogout = () => {
    setAuth(null);
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-600", icon: Clock, label: t("pending") },
      fulfilled: { bg: "bg-success/10", text: "text-success", icon: CheckCircle, label: t("fulfilled") },
      disputed: { bg: "bg-destructive/10", text: "text-destructive", icon: AlertTriangle, label: t("disputed") },
      resolved: { bg: "bg-primary/10", text: "text-primary", icon: CheckCircle, label: t("resolved") },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${s.bg} ${s.text} text-xs font-medium`}>
        <s.icon className="h-3 w-3" />{s.label}
      </span>
    );
  };

  const tabs = [
    { key: "services" as const, icon: Package, label: t("availableServices") },
    { key: "orders" as const, icon: FileText, label: t("myOrders") },
    { key: "history" as const, icon: History, label: t("pointsHistory") },
    { key: "notifications" as const, icon: Bell, label: t("notifications"), badge: unreadCount },
    { key: "account" as const, icon: User, label: t("accountInfo") },
  ];



  return (
    <div className="min-h-[calc(100vh-72px)] bg-secondary/20">
      {/* Profile header */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228, 35%, 7%) 0%, hsl(260, 40%, 12%) 50%, hsl(228, 35%, 10%) 100%)" }}>
        <div className="absolute top-0 end-0 w-80 h-80 bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 start-0 w-60 h-60 bg-accent/8 rounded-full blur-[100px]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="flex items-center justify-center w-[72px] h-[72px] rounded-2xl gradient-primary shadow-glow text-white text-2xl font-bold ring-4 ring-primary/20">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">{t("clientWelcome")}, {client.name}</h1>
                <p className="text-sm text-white/30 mt-0.5">{client.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold border border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    {t("active")}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/25 hover:bg-white/5 backdrop-blur-sm transition-all"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        {/* Stats cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6 hover:border-primary/20 transition-all relative overflow-hidden group">
            <div className="absolute top-0 end-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/5 border border-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t("pointsBalance")}</span>
            </div>
            <p className="text-4xl font-display font-bold text-foreground tracking-tight">{client.credits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("yourPoints")}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6 hover:border-accent/20 transition-all relative overflow-hidden group">
            <div className="absolute top-0 end-0 w-20 h-20 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 border border-accent/10">
                <ShoppingCart className="h-5 w-5 text-accent" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t("totalOrders")}</span>
            </div>
            <p className="text-4xl font-display font-bold text-foreground tracking-tight">{orders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("myOrders")}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6 hover:border-success/20 transition-all relative overflow-hidden group">
            <div className="absolute top-0 end-0 w-20 h-20 bg-success/5 rounded-full blur-2xl group-hover:bg-success/10 transition-colors" />
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/10 border border-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t("totalSpent")}</span>
            </div>
            <p className="text-4xl font-display font-bold text-foreground tracking-tight">{orders.reduce((s, o) => s + Number(o.credits_used), 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("points")}</p>
          </div>
        </div>

        {/* Tabs — mobile scrollable */}
        <div className="flex gap-1 mb-6 sm:mb-8 overflow-x-auto pb-1 bg-card/50 rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border border-border no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Services */}
        {activeTab === "services" && (
          <div className="pb-12">
            {services.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">{t("noServices")}</p>
              </div>
            ) : (
              <>
                {/* Category Grid */}
                {selectedCategory === "all" && categories.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-display font-bold text-foreground mb-4">{t("allCategories")}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categories.map((cat, i) => {
                        const catServices = services.filter(s => s.category === cat);
                        const apiCat = apiCategories.find(c => c.name === cat);
                        const catImage = getCategoryImage(cat, apiCat?.image_url);
                        const colors = [
                          "from-primary/20 to-primary/5 border-primary/20",
                          "from-accent/20 to-accent/5 border-accent/20",
                          "from-success/20 to-success/5 border-success/20",
                          "from-destructive/20 to-destructive/5 border-destructive/20",
                        ];
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors[i % colors.length]} p-1 transition-all hover:scale-[1.02] hover:shadow-lg`}
                          >
                            <div className="rounded-xl overflow-hidden bg-card">
                              {catImage ? (
                                <div className="aspect-square overflow-hidden flex items-center justify-center bg-secondary/30">
                                  <img src={catImage} alt={cat} className="w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                                </div>
                              ) : (
                                <div className="aspect-square bg-secondary/50 flex items-center justify-center">
                                  <Package className="h-10 w-10 text-muted-foreground/20" />
                                </div>
                              )}
                              <div className="p-3 text-start bg-secondary/30">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-card text-xs font-bold text-primary mb-1.5">
                                  {catServices.length} <span className="text-muted-foreground font-normal">Produits</span>
                                </span>
                                <h4 className="font-display font-bold text-foreground text-sm truncate">{cat}</h4>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Back to categories */}
                {selectedCategory !== "all" && (
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setSelectedCategory("all")} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border bg-card text-muted-foreground text-sm hover:bg-secondary transition-all">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("allCategories")}
                    </button>
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow">
                      {selectedCategory}
                      <span className="text-[10px] opacity-70">({filteredServices.length})</span>
                    </span>
                  </div>
                )}

                {/* Product Grid */}
                {selectedCategory !== "all" && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredServices.map((s) => {
                      const outOfStock = s.stock !== null && Number(s.stock) <= 0;
                      const cantAfford = client!.credits < Number(s.price_credits);
                      return (
                        <div key={s.id} className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden group hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300">
                          {s.image_url && (
                            <div className="aspect-video bg-secondary overflow-hidden relative">
                              <img src={s.image_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                              {s.stock !== null && (
                                <span className={`absolute top-3 end-3 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md ${Number(s.stock) > 0 ? "bg-success/20 text-success border border-success/20" : "bg-destructive/20 text-destructive border border-destructive/20"}`}>
                                  {t("stock")}: {s.stock}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="p-5">
                            <h3 className="font-display font-semibold text-foreground text-sm leading-snug mb-1">{s.name}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-5">{s.description}</p>

                            <div className="flex items-center justify-between mb-5 py-3 px-4 rounded-xl bg-secondary/50">
                             <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-display font-bold text-foreground">{s.price_credits}</span>
                                <span className="text-xs text-muted-foreground">Crédits</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleBuy(s.id)}
                              disabled={outOfStock || cantAfford}
                              className="w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed gradient-primary text-primary-foreground shadow-glow hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                            >
                              {outOfStock ? (
                                <>{t("outOfStock")}</>
                              ) : cantAfford ? (
                                <>{t("notEnoughPoints")}</>
                              ) : (
                                <>
                                  <ShoppingCart className="h-4 w-4" />
                                  {t("buy")}
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Orders */}
        {activeTab === "orders" && (
          <div className="pb-12">
            {orders.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">{t("noOrders")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((o, i) => {
                  const orderComplaint = complaints.find(c => c.order_id === o.id && (c.status === "open" || c.status === "in_review"));
                  const dt = deliveryTypes.find(d => d.id === o.delivery_type_id);

                  return (
                    <div key={o.id} className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/5 flex-shrink-0">
                            <Package className="h-5 w-5 text-primary" />
                          </span>
                          <div>
                            <p className="font-medium text-foreground text-sm">{o.service_name || getServiceName(o.service_id)}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(o.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {o.duration_months || 12} {t("months")}
                              </span>
                              <span className="text-xs text-muted-foreground/60">
                                #{String(orders.length - i).padStart(4, "0")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:flex-shrink-0 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-semibold">
                            <Zap className="h-3 w-3" />{o.credits_used}
                          </span>
                          {getStatusBadge(o.status)}
                        </div>
                      </div>

                      {/* Credentials section */}
                      {o.status === "fulfilled" && o.credentials && dt && (
                        <div className="px-6 py-4 border-t border-border bg-success/5">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-success uppercase tracking-wide flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {t("credentials")}
                            </h4>
                            <button
                              onClick={() => setViewCredsOrder(o)}
                              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              {t("viewCredentials")}
                            </button>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {dt.fields.map(f => (
                              <div key={f.key} className="bg-background rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">{f.label}</p>
                                <p className="text-sm font-medium text-foreground font-mono">{o.credentials?.[f.key] || "—"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Report issue */}
                      {o.status === "fulfilled" && !orderComplaint && (
                        <div className="px-6 py-3 border-t border-border">
                          <button
                            onClick={() => { setShowComplaint(o); setComplaintMessage(""); }}
                            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {t("reportIssue")}
                          </button>
                        </div>
                      )}

                      {/* Active complaint */}
                      {orderComplaint && (
                        <div className="px-6 py-3 border-t border-destructive/20 bg-destructive/5">
                          <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {t("activeComplaint")} — {t(orderComplaint.reason as any)}
                          </div>
                          {orderComplaint.admin_response && (
                            <div className="mt-2 bg-background rounded-lg p-3">
                              <p className="text-[10px] text-primary font-semibold uppercase mb-1">{t("adminResponse")}</p>
                              <p className="text-xs text-foreground">{orderComplaint.admin_response}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Points History */}
        {activeTab === "history" && (() => {
          const filtered = pointTransactions.filter(tx => {
            if (historyTypeFilter !== "all" && tx.type !== historyTypeFilter) return false;
            if (historyDateFrom && tx.created_at < historyDateFrom) return false;
            if (historyDateTo && tx.created_at > historyDateTo + "T23:59:59") return false;
            return true;
          });
          return (
          <div className="pb-12">
            {/* Filters */}
            <div className="bg-card rounded-2xl border border-border shadow-premium p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t("filters") || "Filtres"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("transactionType")}</label>
                  <select
                    value={historyTypeFilter}
                    onChange={e => setHistoryTypeFilter(e.target.value as any)}
                    className="w-full h-10 rounded-xl border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="all">{t("allTime")}</option>
                    <option value="credit">{t("creditPoints")}</option>
                    <option value="debit">{t("debitPoints")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("from") || "Du"}</label>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={e => setHistoryDateFrom(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("to") || "Au"}</label>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={e => setHistoryDateTo(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <History className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">{t("noPointTransactions")}</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                <div className="p-5 border-b border-border flex items-center gap-3">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-semibold text-foreground">{t("pointsHistory")}</h3>
                  <span className="text-xs text-muted-foreground ms-auto">{filtered.length} transactions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("transactionDate")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("transactionType")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("transactionAmount")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("transactionBalance")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("transactionDescription")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((tx) => (
                        <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(tx.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {tx.type === "credit" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/10 text-success text-xs font-medium">
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                                {t("creditPoints")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">
                                <ArrowDownCircle className="h-3.5 w-3.5" />
                                {t("debitPoints")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <span className={tx.type === "credit" ? "text-success" : "text-destructive"}>
                              {tx.type === "credit" ? "+" : "-"}{Number(tx.amount).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-medium">
                            {Number(tx.balance_after).toLocaleString()} {t("points").toLowerCase()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                            {tx.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <div className="pb-12">
            {notifications.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">{t("noNotifications")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unreadCount > 0 && (
                  <div className="flex justify-end">
                    <button onClick={handleMarkAllRead} className="text-xs text-primary font-medium hover:underline">
                      {t("markAllRead")}
                    </button>
                  </div>
                )}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`bg-card rounded-2xl border shadow-premium p-5 transition-all cursor-pointer ${!n.is_read ? "border-primary/30 bg-primary/5" : "border-border"}`}
                    onClick={() => { if (!n.is_read) handleMarkOneRead(n.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${
                        n.type === "credentials_ready" ? "bg-success/10" :
                        n.type === "complaint_resolved" ? "bg-primary/10" : "bg-accent/10"
                      }`}>
                        {n.type === "credentials_ready" ? <CheckCircle className="h-4 w-4 text-success" /> :
                         n.type === "complaint_resolved" ? <CheckCircle className="h-4 w-4 text-primary" /> :
                         <Bell className="h-4 w-4 text-accent" />}
                      </span>
                       <div className="flex-1">
                         <p className="text-sm text-foreground whitespace-pre-line">{(n.message || "").replace(/\s*\[CID:[^\]]+\]\s*/g, "").replace(/\s*\[REQ:[^\]]*\]\s*/g, "").replace(/\s*\[ACT:(approved|cancelled)\]\s*/g, "").trim()}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account */}
        {activeTab === "account" && (
          <div className="max-w-lg pb-12">
            <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="p-6 flex items-center gap-4 border-b border-border bg-secondary/20">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow text-primary-foreground text-xl font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-foreground">{client.name}</h2>
                  <p className="text-sm text-muted-foreground">{client.email}</p>
                </div>
              </div>
              <div className="p-6 space-y-1">
                <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/30 transition-colors">
                  <span className="text-sm text-muted-foreground">{t("pointsBalance")}</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/5 text-primary text-sm font-bold">
                    <Zap className="h-3.5 w-3.5" />{client.credits.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/30 transition-colors">
                  <span className="text-sm text-muted-foreground">{t("totalOrders")}</span>
                  <span className="text-sm font-bold text-foreground">{orders.length}</span>
                </div>
                <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/30 transition-colors">
                  <span className="text-sm text-muted-foreground">{t("totalSpent")}</span>
                  <span className="text-sm font-bold text-foreground">{orders.reduce((s, o) => s + Number(o.credits_used), 0).toLocaleString()} {t("points")}</span>
                </div>
                <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-secondary/30 transition-colors">
                  <span className="text-sm text-muted-foreground">{t("status")}</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-success/10 text-success text-xs font-semibold">
                    <CheckCircle className="h-3 w-3" />{t("active")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Issue Dialog */}
      <AlertDialog open={!!showComplaint} onOpenChange={() => setShowComplaint(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reportIssue")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("order")}: {showComplaint?.service_name || getServiceName(showComplaint?.service_id || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("complaintReason")}</label>
              <select
                value={complaintReason}
                onChange={(e) => setComplaintReason(e.target.value as any)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm"
              >
                <option value="expired">{t("expired")}</option>
                <option value="not_working">{t("not_working")}</option>
                <option value="wrong_credentials">{t("wrong_credentials")}</option>
                <option value="other">{t("other")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("complaintMessage")}</label>
              <textarea
                value={complaintMessage}
                onChange={(e) => setComplaintMessage(e.target.value)}
                className="w-full h-24 px-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm resize-none"
                placeholder={t("complaintMessage")}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={submitComplaint}>
              <Send className="h-3.5 w-3.5 me-1" />
              {t("save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Credentials Dialog */}
      <AlertDialog open={!!viewCredsOrder} onOpenChange={() => setViewCredsOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("credentials")}</AlertDialogTitle>
            <AlertDialogDescription>{viewCredsOrder?.service_name || getServiceName(viewCredsOrder?.service_id || "")}</AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            if (!viewCredsOrder) return null;
            const dt = deliveryTypes.find(d => d.id === viewCredsOrder.delivery_type_id);
            if (!dt || !viewCredsOrder.credentials) return <p className="text-sm text-muted-foreground">{t("noDeliveryTypeLinked")}</p>;
            return (
              <div className="space-y-3">
                {dt.fields.map(f => (
                  <div key={f.key} className="bg-secondary/50 rounded-lg px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{f.label}</p>
                    <p className="text-sm font-medium text-foreground font-mono break-all">{viewCredsOrder.credentials?.[f.key] || "—"}</p>
                  </div>
                ))}
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={!!purchaseService} onOpenChange={(open) => { if (!purchasing) setPurchaseService(open ? purchaseService : null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPurchase")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmPurchaseDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          {purchaseService && (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-xl p-4">
                <p className="font-medium text-foreground text-sm mb-1">{purchaseService.name}</p>
                <p className="text-xs text-muted-foreground">{purchaseService.description}</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-lg font-display font-bold text-foreground">{purchaseService.price_credits}</span>
                  <span className="text-xs text-muted-foreground">{t("points")}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t("chooseDuration")}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map(m => (
                    <button
                      key={m}
                      onClick={() => setPurchaseMonths(m)}
                      className={`h-11 rounded-xl text-sm font-semibold transition-all border ${
                        purchaseMonths === m
                          ? "gradient-primary text-primary-foreground shadow-glow border-transparent"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {m} {t("months")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purchasing}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={purchasing} onClick={confirmPurchase}>
              {purchasing ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full me-1" /> : <ShoppingCart className="h-3.5 w-3.5 me-1" />}
              {t("buy")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientDashboard;
