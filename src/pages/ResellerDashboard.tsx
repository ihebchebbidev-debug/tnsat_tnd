import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLang } from "@/store/LangContext";
import { getAuth, setAuth } from "@/store/store";
import {
  apiGetReseller, apiGetServices, apiGetOrders, apiCreateOrder, apiDeleteOrder, apiResetOrderCredentials,
  apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead,
  apiGetPointTransactions,
  apiSelfUpdateReseller, apiUploadImage,
  apiGetCategories, apiGetAllProductKeyCounts,
  apiGetOrderResponses, apiCreateOrderResponse, apiGetOrder,
  apiCreateNotification,
  apiGetResetProducts, apiSubmitResetRequest, apiEditResetRequest,
  apiGetActiveGlobalMessages,
  apiGetAssignedKeysHistory,
  apiUpdateProductKeyNote, apiUpdateNotificationNote,
  type ApiService, type ApiOrder, type ApiNotification, type ApiPointTransaction, type ApiCategory, type ApiProductKeyCount, type ApiOrderResponse,
  type ApiResetProduct,
  type ApiGlobalMessage,
  type ApiAssignedKeyHistory,
} from "@/utils/api";
import { getCategoryImage } from "@/utils/categoryImages";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, Zap, Package, FileText, LogOut, TrendingUp,
  Clock, CheckCircle, User, ArrowRight, ArrowLeft, Eye, Bell, Trash2, Loader2,
  AlertTriangle, Send, XCircle, Search, CreditCard, Settings, Key, RotateCcw, Megaphone, Pencil, Upload, X, Download
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import PaginationControls from "@/components/admin/PaginationControls";

interface ResellerData { id: string; name: string; email: string; credits: number; can_add_resellers: number; level?: number; image_url?: string | null; }

const ResellerDashboard = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [reseller, setReseller] = useState<ResellerData | null>(null);
  const [services, setServices] = useState<ApiService[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [transactions, setTransactions] = useState<ApiPointTransaction[]>([]);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [keyCounts, setKeyCounts] = useState<Record<string, ApiProductKeyCount>>({});
  const [assignedKeys, setAssignedKeys] = useState<ApiAssignedKeyHistory[]>([]);
  const [keysServiceFilter, setKeysServiceFilter] = useState("");
  const [keysDateFrom, setKeysDateFrom] = useState("");
  const [keysDateTo, setKeysDateTo] = useState("");
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysPage, setKeysPage] = useState(1);
  const [keysPerPage, setKeysPerPage] = useState(25);
  const [keysTotal, setKeysTotal] = useState(0);
  const [keysTotalPages, setKeysTotalPages] = useState(1);
  const [keysSearchInput, setKeysSearchInput] = useState("");
  const [keysSearch, setKeysSearch] = useState("");
  // Transactions filters / pagination (client-side)
  const [txServiceFilter, setTxServiceFilter] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"services" | "myOrders" | "orders" | "resetCodes" | "transactions" | "profile">(() => {
    const s = (location.state as any)?.tab;
    return s || "services";
  });

  useEffect(() => {
    const s = (location.state as any)?.tab;
    if (s) {
      setActiveTab(s);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [viewCredsOrder, setViewCredsOrder] = useState<ApiOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Purchase confirmation with quantity/note
  const [purchaseService, setPurchaseService] = useState<ApiService | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseNote, setPurchaseNote] = useState("");
  const [purchasing, setPurchasing] = useState(false);


  // Reset products catalog (admin-managed)
  const [resetProducts, setResetProducts] = useState<ApiResetProduct[]>([]);
  // Selected reset product → dynamic form
  const [rpTarget, setRpTarget] = useState<ApiResetProduct | null>(null);
  const [rpValues, setRpValues] = useState<Record<string, string>>({});
  const [rpNote, setRpNote] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  // Editing a still-pending reset request (matched by CID)
  const [editResetTarget, setEditResetTarget] = useState<{ cid: string; productName: string; currentText: string; currentNote: string } | null>(null);
  const [editResetText, setEditResetText] = useState("");
  const [editResetNote, setEditResetNote] = useState("");
  const [editResetSubmitting, setEditResetSubmitting] = useState(false);

  // Note editing (reseller may edit notes on his Historique code & Reset Codes)
  const [noteTarget, setNoteTarget] = useState<{ kind: "key" | "notif"; id: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const openNoteEditor = (kind: "key" | "notif", id: string, current: string | null | undefined) => {
    setNoteTarget({ kind, id });
    setNoteText(current || "");
  };
  const saveNote = async () => {
    if (!noteTarget) return;
    setNoteSaving(true);
    try {
      if (noteTarget.kind === "key") {
        await apiUpdateProductKeyNote(noteTarget.id, noteText);
        setAssignedKeys(prev => prev.map(k => k.id === noteTarget.id ? { ...k, reseller_note: noteText } : k));
      } else {
        await apiUpdateNotificationNote(noteTarget.id, noteText);
        setNotifications(prev => prev.map(n => n.id === noteTarget.id ? { ...n, reseller_note: noteText } as any : n));
      }
      toast({ title: t("success") || "OK", description: "Note enregistrée" });
      setNoteTarget(null);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message || "Échec", variant: "destructive" });
    } finally {
      setNoteSaving(false);
    }
  };


  // Order response (notification interaction)
  const [respondingNotif, setRespondingNotif] = useState<ApiNotification | null>(null);
  const [respondingOrder, setRespondingOrder] = useState<ApiOrder | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sendingResponse, setSendingResponse] = useState(false);
  const [existingResponses, setExistingResponses] = useState<ApiOrderResponse[]>([]);
  const [loadingNotifOrder, setLoadingNotifOrder] = useState(false);

  // Global Messages from admin (broadcast) — shown as modal, dismissed locally for the session.
  // They reappear on next login until the admin removes/deactivates them.
  const [pendingGlobalMessages, setPendingGlobalMessages] = useState<ApiGlobalMessage[]>([]);

  const dismissCurrentGlobalMessage = () => {
    setPendingGlobalMessages((prev) => prev.slice(1));
  };

  const reload = useCallback(async (resellerId: string) => {
    try {
      const [r, s, o, notifs, txs, cats, kc, rps] = await Promise.all([
        apiGetReseller(resellerId), apiGetServices(resellerId), apiGetOrders(undefined, resellerId),
        apiGetNotifications(undefined, resellerId),
        apiGetPointTransactions(undefined, resellerId),
        apiGetCategories(resellerId).catch(() => [] as ApiCategory[]),
        apiGetAllProductKeyCounts().catch(() => ({} as Record<string, ApiProductKeyCount>)),
        apiGetResetProducts(true).catch(() => [] as ApiResetProduct[]),
      ]);
      setReseller({ id: r.id, name: r.name, email: r.email, credits: Number(r.credits), can_add_resellers: 0, level: r.level, image_url: r.image_url });
      setServices(s); setOrders(o); setNotifications(notifs);
      setTransactions(txs); setApiCategories(cats); setKeyCounts(kc);
      setResetProducts(rps);
      
    } catch (e: any) {
      console.error(e);
      toast({ title: t("error"), description: e.message || t("loadError"), variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast, t]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.type !== "reseller" || !auth.resellerId) { navigate("/login"); return; }
    reload(auth.resellerId);

    // Load active global messages on mount (admin broadcasts) — always shown until admin removes them
    apiGetActiveGlobalMessages()
      .then((msgs) => setPendingGlobalMessages(msgs))
      .catch(() => { /* silent */ });

    // Auto-refresh notifications & orders every 30s
    const interval = setInterval(async () => {
      try {
        const [notifs, o] = await Promise.all([
          apiGetNotifications(undefined, auth.resellerId!),
          apiGetOrders(undefined, auth.resellerId!),
        ]);
        setNotifications(notifs);
        setOrders(o);
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [reload, navigate]);

  // Load assigned keys history for this reseller
  const loadAssignedKeys = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.resellerId) return;
    setKeysLoading(true);
    try {
      const res = await apiGetAssignedKeysHistory({
        reseller_id: auth.resellerId,
        service_id: keysServiceFilter || undefined,
        from: keysDateFrom || undefined,
        to: keysDateTo || undefined,
        page: keysPage,
        per_page: keysPerPage,
      });
      setAssignedKeys(res.data);
      setKeysTotal(res.total);
      setKeysTotalPages(res.total_pages);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message || t("loadError"), variant: "destructive" });
    } finally { setKeysLoading(false); }
  }, [keysServiceFilter, keysDateFrom, keysDateTo, keysPage, keysPerPage, toast, t]);

  useEffect(() => { setKeysPage(1); }, [keysServiceFilter, keysDateFrom, keysDateTo, keysPerPage]);

  useEffect(() => {
    if (activeTab === "orders") loadAssignedKeys();
  }, [activeTab, loadAssignedKeys]);

  // Categories from API (with fallback to service-derived)
  const categories = useMemo(() => {
    if (apiCategories.length > 0) return apiCategories.map(c => c.name);
    const cats = new Set<string>();
    services.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats);
  }, [services, apiCategories]);

  // Filter services by category
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      if (selectedCategory !== "all" && s.category !== selectedCategory) return false;
      // Hide out-of-stock services from resellers
      if (s.sale_type === "stock") {
        const keyStock = keyCounts[s.id];
        const hasKeys = keyStock && keyStock.total > 0;
        const availableKeys = keyStock?.available ?? 0;
        const outOfStock = (s.stock !== null && Number(s.stock) <= 0) || (hasKeys && availableKeys <= 0);
        if (outOfStock) return false;
      }
      return true;
    });
  }, [services, selectedCategory, keyCounts]);

  // Filter orders: hide stock services (handled inside service page), then by search
  const filteredOrders = useMemo(() => {
    const commandOrders = orders.filter(o => {
      const svc = services.find(s => s.id === o.service_id);
      return svc?.sale_type !== "stock";
    });
    if (!searchQuery) return commandOrders;
    const q = searchQuery.toLowerCase();
    return commandOrders.filter(o => {
      const name = (o.service_name || services.find(s => s.id === o.service_id)?.name || "").toLowerCase();
      const note = (o.note || "").toLowerCase();
      const status = (o.status || "").toLowerCase();
      return name.includes(q) || note.includes(q) || status.includes(q);
    });
  }, [orders, searchQuery, services]);

  const handleBuy = (serviceId: string) => {
    if (!reseller) return;
    const service = services.find(s => s.id === serviceId);
    if (!service || reseller.credits < Number(service.price_credits)) {
      toast({ title: t("error"), description: t("notEnoughPoints"), variant: "destructive" }); return;
    }
    setPurchaseService(service);
    setPurchaseQuantity(1);
    setPurchaseNote("");
  };

  const confirmPurchase = async () => {
    if (!reseller || !purchaseService) return;
    const totalCost = Number(purchaseService.price_credits) * purchaseQuantity;
    if (reseller.credits < totalCost) {
      toast({ title: t("error"), description: t("notEnoughPoints"), variant: "destructive" }); return;
    }
    setPurchasing(true);
    try {
      const res = await apiCreateOrder({ reseller_id: reseller.id, service_id: purchaseService.id, quantity: purchaseQuantity, note: purchaseNote || undefined }) as any;
      if (res.credits_remaining !== undefined) setReseller(prev => prev ? { ...prev, credits: res.credits_remaining } : prev);
      setPurchaseService(null);
      await reload(reseller.id);
      if (res.auto_fulfilled && res.credentials) {
        // Show credentials immediately
        const fulfilledOrder = orders.find(o => o.id === res.id) || { id: res.id, credentials: res.credentials, service_name: purchaseService?.name || "", status: "fulfilled", created_at: new Date().toISOString(), credits_used: totalCost, service_id: purchaseService?.id || "" } as any;
        fulfilledOrder.credentials = res.credentials;
        setViewCredsOrder(fulfilledOrder);
        toast({ title: "✅ " + t("success"), description: t("purchaseSuccess") + " — " + (t("credentialsReady") || "Credentials ready!") });
      } else {
        toast({ title: t("success"), description: t("purchaseSuccess") });
      }
    } catch (e: any) {
      if (e?.data?.no_stock) {
        toast({
          title: "🚫 " + (t("outOfStockTitle") || "Out of stock"),
          description: t("outOfStockMessage") || "Ce produit est temporairement épuisé. L'admin a été notifié — réessayez plus tard.",
          variant: "destructive",
        });
      } else {
        toast({ title: t("error"), description: e.message, variant: "destructive" });
      }
    }
    finally { setPurchasing(false); }
  };

  const handleMarkAllRead = async () => {
    if (!reseller) return;
    try { await apiMarkAllNotificationsRead(undefined, reseller.id); setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 }))); toast({ title: t("success"), description: t("notificationsMarkedRead") }); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  


  const handleLogout = () => { setAuth(null); navigate("/"); };
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || "—";

  // Open notification → load order details + existing responses
  const openNotificationOrder = async (notif: ApiNotification) => {
    if (!notif.order_id) return;
    setRespondingNotif(notif);
    setLoadingNotifOrder(true);
    setResponseText("");
    try {
      // Mark as read
      if (!notif.is_read) {
        await apiMarkNotificationRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      }
      const [order, responses] = await Promise.all([
        apiGetOrder(notif.order_id),
        apiGetOrderResponses(notif.order_id),
      ]);
      setRespondingOrder(order);
      setExistingResponses(responses);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
      setRespondingNotif(null);
    } finally { setLoadingNotifOrder(false); }
  };

  const submitOrderResponse = async () => {
    if (!reseller || !respondingOrder || !responseText.trim()) return;
    setSendingResponse(true);
    try {
      await apiCreateOrderResponse({ order_id: respondingOrder.id, reseller_id: reseller.id, response_text: responseText.trim() });
      toast({ title: t("success"), description: t("responseSent") || "Response sent!" });
      // Refresh responses
      const responses = await apiGetOrderResponses(respondingOrder.id);
      setExistingResponses(responses);
      setResponseText("");
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
    finally { setSendingResponse(false); }
  };

  // Open response dialog directly from an order (not just notification)
  const openOrderForResponse = async (order: ApiOrder) => {
    setRespondingNotif({ id: '', order_id: order.id } as ApiNotification);
    setLoadingNotifOrder(true);
    setResponseText("");
    try {
      const responses = await apiGetOrderResponses(order.id);
      setRespondingOrder(order);
      setExistingResponses(responses);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
      setRespondingNotif(null);
    } finally { setLoadingNotifOrder(false); }
  };

  // Open reset product simple form
  const openResetProduct = (rp: ApiResetProduct) => {
    setRpTarget(rp);
    setRpValues({ request: "" });
    setRpNote("");
  };

  const submitResetRequest = async () => {
    if (!reseller || !rpTarget) return;
    const text = (rpValues.request || "").trim();
    if (!text) {
      toast({
        title: "Erreur",
        description: "Veuillez décrire ce dont vous avez besoin",
        variant: "destructive",
      });
      return;
    }
    setResetSubmitting(true);
    try {
      await apiSubmitResetRequest({
        reset_product_id: rpTarget.id,
        reseller_id: reseller.id,
        values: { Request: text },
        note: rpNote.trim() || undefined,
      });
      toast({ title: "Succès", description: "Demande de reset envoyée avec succès" });
      setRpTarget(null);
      // refresh so the new row shows up with its note
      const notifs = await apiGetNotifications(undefined, reseller.id);
      setNotifications(notifs);
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer la demande de reset",
        variant: "destructive",
      });
    } finally { setResetSubmitting(false); }
  };

  // Open the edit dialog for a still-pending reset request
  const openEditResetRequest = (cid: string, productName: string, currentText: string, currentNote: string) => {
    setEditResetTarget({ cid, productName, currentText, currentNote });
    setEditResetText(currentText);
    setEditResetNote(currentNote || "");
  };

  const submitEditResetRequest = async () => {
    if (!reseller || !editResetTarget) return;
    const text = (editResetText || "").trim();
    if (!text) {
      toast({ title: "Erreur", description: "Veuillez décrire ce dont vous avez besoin", variant: "destructive" });
      return;
    }
    setEditResetSubmitting(true);
    try {
      await apiEditResetRequest({
        cid: editResetTarget.cid,
        reseller_id: reseller.id,
        values: { Request: text },
        note: editResetNote.trim(),
      });
      toast({ title: "Succès", description: "Demande mise à jour" });
      setEditResetTarget(null);
      // Refresh notifications so the table shows the updated text
      const notifs = await apiGetNotifications(undefined, reseller.id);
      setNotifications(notifs);
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible de modifier la demande",
        variant: "destructive",
      });
    } finally { setEditResetSubmitting(false); }
  };

  if (!reseller) return null;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-600", icon: Clock, label: t("pending") },
      fulfilled: { bg: "bg-success/10", text: "text-success", icon: CheckCircle, label: t("fulfilled") },
      disputed: { bg: "bg-destructive/10", text: "text-destructive", icon: AlertTriangle, label: t("disputed") || "Disputed" },
      resolved: { bg: "bg-primary/10", text: "text-primary", icon: CheckCircle, label: t("resolved") || "Resolved" },
      cancelled: { bg: "bg-muted", text: "text-muted-foreground", icon: XCircle, label: "Cancelled" },
    };
    const s = map[status] || map.pending;
    return <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${s.bg} ${s.text} text-xs font-medium`}><s.icon className="h-3 w-3" />{s.label}</span>;
  };

  const tabs = [
    { key: "services" as const, icon: Package, label: t("availableServices") },
    { key: "myOrders" as const, icon: FileText, label: t("myOrders") || "Mes Commandes" },
    { key: "resetCodes" as const, icon: RotateCcw, label: t("resetCodes") || "Reset Codes" },
    { key: "orders" as const, icon: CreditCard, label: "Historique code" },
    { key: "profile" as const, icon: Settings, label: t("accountInfo") },
  ];

  const inputClass = "w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all";

  return (
    <div className="min-h-[calc(100vh-72px)] bg-secondary/20">
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228, 35%, 7%) 0%, hsl(260, 40%, 12%) 50%, hsl(228, 35%, 10%) 100%)" }}>
        <div className="absolute top-0 end-0 w-80 h-80 bg-accent/10 rounded-full blur-[140px]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              {reseller.image_url ? (
                <img src={reseller.image_url} alt={reseller.name} className="w-[72px] h-[72px] rounded-2xl object-cover ring-4 ring-accent/20 bg-accent/20" />
              ) : (
                <div className="flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-accent/20 text-accent text-2xl font-bold ring-4 ring-accent/20">{reseller.name.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <h1 className="text-2xl font-display font-bold text-white">{t("resellerWelcome")}, {reseller.name}</h1>
                <p className="text-sm text-white/30 mt-0.5">{reseller.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold border border-accent/20"><User className="h-3 w-3" />{t("reseller")}</span>
                  {reseller.level && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold border border-primary/20">Level {reseller.level}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Order badge */}
              <button onClick={() => setActiveTab("myOrders")} className="relative flex items-center gap-2 h-10 px-4 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/25 hover:bg-white/5 transition-all">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{t("myOrders")}</span>
                {orders.length > 0 && (
                  <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">{orders.length}</span>
                )}
              </button>
              <button onClick={handleLogout} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/25 hover:bg-white/5 transition-all"><LogOut className="h-4 w-4" />{t("logout")}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6"><div className="flex items-center justify-between mb-3"><span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/5 border border-primary/10"><Zap className="h-5 w-5 text-primary" /></span></div><p className="text-4xl font-display font-bold text-foreground">{reseller.credits.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">{t("yourPoints")}</p></div>
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6"><div className="flex items-center justify-between mb-3"><span className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 border border-accent/10"><ShoppingCart className="h-5 w-5 text-accent" /></span></div><p className="text-4xl font-display font-bold text-foreground">{orders.length}</p><p className="text-xs text-muted-foreground mt-1">{t("myOrders")}</p></div>
          <div className="bg-card rounded-2xl border border-border shadow-premium p-6"><div className="flex items-center justify-between mb-3"><span className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/10 border border-success/10"><TrendingUp className="h-5 w-5 text-success" /></span></div><p className="text-4xl font-display font-bold text-foreground">{orders.reduce((s, o) => s + Number(o.credits_used), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">{t("totalSpent")}</p></div>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto pb-1 bg-card/50 rounded-xl p-1 border border-border no-scrollbar">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
              <tab.icon className="h-4 w-4" />{tab.label}
              {"badge" in tab && tab.badge ? <span className="flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">{String(tab.badge)}</span> : null}
            </button>
          ))}
        </div>

        {activeTab === "services" && (
          <div className="pb-12">
            {/* Category Grid — show when no category selected */}
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

            {/* Back to categories + active filter */}
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
            {(selectedCategory !== "all" || categories.length === 0) && (
              <>
                {filteredServices.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border p-16 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center mx-auto mb-4"><Package className="h-10 w-10 text-muted-foreground/30" /></div>
                    <p className="text-muted-foreground font-medium">{t("noServices")}</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredServices.map(s => {
                      const keyStock = keyCounts[s.id];
                      const availableKeys = keyStock?.available ?? 0;
                      const hasKeys = keyStock && keyStock.total > 0;
                      const outOfStock = (s.stock !== null && Number(s.stock) <= 0) || (hasKeys && availableKeys <= 0);
                      const cantAfford = reseller.credits < Number(s.price_credits);
                      return (
                        <div key={s.id} className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden group hover:border-primary/20 hover:shadow-lg transition-all relative">
                          {/* Price badge */}
                          <div className="absolute top-3 end-3 z-10 px-3 py-1.5 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-foreground text-xs font-bold shadow-lg">
                            <span className="text-primary">{Number(s.price_credits)} TND</span>
                          </div>
                          {/* Stock badges hidden for resellers */}
                          {s.image_url ? (
                            <div className="aspect-[4/3] bg-secondary overflow-hidden">
                              <img src={s.image_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                            </div>
                          ) : (
                            <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                              <Package className="h-12 w-12 text-muted-foreground/15" />
                            </div>
                          )}
                          <div className="p-4">
                            {s.category && <span className="inline-block text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5">{s.category}</span>}
                            <h3 className="font-display font-semibold text-foreground text-sm mb-1 line-clamp-2">{s.name}</h3>
                            {s.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{s.description}</p>}
                            <button onClick={() => navigate(`/reseller/service/${s.id}`)} disabled={outOfStock || cantAfford} className="w-full h-10 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 gradient-primary text-primary-foreground shadow-glow hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]">
                              {outOfStock ? t("outOfStock") : cantAfford ? t("notEnoughPoints") : <><ShoppingCart className="h-4 w-4" />{t("buy")}</>}
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


        {activeTab === "myOrders" && (
          <div className="pb-12 space-y-4">
            <div className="bg-card rounded-2xl border border-border shadow-premium p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className={`${inputClass} ps-10`}
                />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">{t("noOrders") || "Aucune commande"}</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-secondary/30">
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("name") || "Nom"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("owner") || "Propriétaire"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("quantity") || "Quantité"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("price") || "Prix"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("note") || "Note"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("date") || "Date"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("status") || "Statut"}</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("actions") || "Actions"}</th>
                    </tr></thead>
                    <tbody>
                      {filteredOrders.map(o => {
                        const svc = services.find(s => s.id === o.service_id);
                        const name = o.service_name || svc?.name || "—";
                        return (
                          <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-4 text-foreground">{name}</td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">{reseller.name}</td>
                            <td className="py-3 px-4 text-foreground">1</td>
                            <td className="py-3 px-4 text-foreground font-medium">{Number(o.credits_used)} TND</td>
                            <td className="py-3 px-4 text-muted-foreground text-xs max-w-[180px] truncate">{o.note || "—"}</td>
                            <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">{getStatusBadge(o.status)}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setViewCredsOrder(o)}
                                  disabled={!o.credentials}
                                  title={t("viewCredentials") || "Voir les accès"}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm("Demander une réinitialisation des identifiants ?")) return;
                                    try {
                                      await apiResetOrderCredentials(o.id);
                                      await reload(reseller.id);
                                      toast({ title: t("success"), description: "Demande envoyée" });
                                    } catch (e: any) {
                                      toast({ title: t("error"), description: e?.message || "Error", variant: "destructive" });
                                    }
                                  }}
                                  title={t("resetCredentials") || "Réinitialiser"}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (() => {
          const q = keysSearch.trim().toLowerCase();
          const filtered = q
            ? assignedKeys.filter(k =>
                (k.fields || []).some(f =>
                  String(f.value || "").toLowerCase().includes(q) ||
                  String(f.title || "").toLowerCase().includes(q)
                ) || (k.service_name || "").toLowerCase().includes(q)
              )
            : assignedKeys;
          return (
          <div className="pb-12 space-y-4">
            {/* Header + CSV */}
            <div className="bg-card rounded-2xl border border-border shadow-premium p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/10"><CreditCard className="h-5 w-5 text-primary" /></span>
                <div>
                  <h2 className="font-display font-bold text-foreground">Historique code</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} {filtered.length > 1 ? "codes" : "code"}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const rows = filtered.map(k => [
                    k.service_name || "",
                    (k.fields || []).map(f => `${f.title}: ${f.value}`).join(" | "),
                    k.assigned_at || k.created_at,
                  ]);
                  const headers = ["Service", "Champs du code", t("date")];
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `historique-codes-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>

            {/* Search bar */}
            <div className="bg-card rounded-2xl border border-border shadow-premium p-4 flex flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={keysSearchInput}
                  onChange={(e) => setKeysSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setKeysSearch(keysSearchInput); }}
                  placeholder="Rechercher..."
                  className={`${inputClass} ps-10`}
                />
              </div>
              <button
                onClick={() => setKeysSearch(keysSearchInput)}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
              >
                <span className="hidden sm:inline">Rechercher</span>
                <Search className="h-4 w-4 sm:hidden" />
              </button>
            </div>

            {keysLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Aucun code</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-secondary/30">
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">Service</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">Champs du code</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">Note</th>
                      <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("date")}</th>
                    </tr></thead>
                    <tbody>
                      {filtered.map(k => (
                        <tr key={k.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors align-top">
                          <td className="py-3 px-4 text-foreground text-sm font-medium">{k.service_name}</td>
                          <td className="py-3 px-4 text-foreground text-xs">
                            <div className="space-y-1">
                              {(k.fields || []).map((f, i) => (
                                <div key={i}><span className="text-muted-foreground">{f.title}:</span> <span className="font-mono">{f.value}</span></div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs max-w-[220px] whitespace-pre-wrap break-words">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">{k.reseller_note || <span className="text-muted-foreground/50 italic">—</span>}</div>
                              <button
                                type="button"
                                onClick={() => openNoteEditor("key", k.id, k.reseller_note)}
                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                                title={t("edit") || "Modifier"}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                            {k.assigned_at ? new Date(k.assigned_at).toLocaleDateString() : new Date(k.created_at).toLocaleDateString()}
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

        {activeTab === "resetCodes" && (
          <div className="pb-12 space-y-4">
            {(() => {
              const stripMarkers = (m: string) =>
                (m || "").replace(/\s*\[CID:[^\]]+\]\s*/g, "").replace(/\s*\[REQ:[^\]]*\]\s*/g, "").replace(/\s*\[ACT:(approved|cancelled)\]\s*/g, "").trim();
              const cidOf = (m: string) => {
                const x = (m || "").match(/\[CID:([a-zA-Z0-9_-]+)\]/);
                return x ? x[1] : null;
              };
              const sent = notifications.filter(n => n.type === "reset_request_sent");
              const replies = notifications.filter(n => n.type === "reset_approved" || n.type === "reset_cancelled");
              const replyByCid = new Map<string, ApiNotification>();
              replies.forEach(r => { const c = cidOf(r.message || ""); if (c) replyByCid.set(c, r); });
              const rows = sent
                .map(s => {
                  const cid = cidOf(s.message || "");
                  const reply = cid ? replyByCid.get(cid) : undefined;
                  const status: "pending" | "approved" | "cancelled" = reply
                    ? (reply.type === "reset_approved" ? "approved" : "cancelled")
                    : "pending";
                  return { sent: s, reply, status };
                })
                .sort((a, b) => new Date(b.sent.created_at).getTime() - new Date(a.sent.created_at).getTime());

              return (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-foreground">Mes demandes de reset</h3>
                      <p className="text-xs text-muted-foreground mt-1">Historique de vos demandes et leur statut</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{rows.length}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="p-10 text-center">
                      <RotateCcw className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">{t("noResetRequests") || "Aucune demande de reset"}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-secondary/30">
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Détails</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("date")}</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("status")}</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">Note</th>
                          <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("adminResponse") || "Réponse admin"}</th>
                        </tr></thead>
                        <tbody>
                          {rows.map(({ sent: s, reply, status }) => {
                            const badge = status === "pending"
                              ? { bg: "bg-yellow-500/10", text: "text-yellow-600", icon: Clock, label: t("pending") }
                              : status === "approved"
                                ? { bg: "bg-success/10", text: "text-success", icon: CheckCircle, label: "Approuvé" }
                                : { bg: "bg-destructive/10", text: "text-destructive", icon: XCircle, label: "Annulé" };
                            return (
                              <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors align-top">
                                <td className="py-3 px-4 text-foreground text-xs max-w-[360px]">
                                  <div className="whitespace-pre-line">{stripMarkers(s.message || "")}</div>
                                  {status === "pending" && (() => {
                                    const cid = cidOf(s.message || "");
                                    if (!cid) return null;
                                    const cleaned = stripMarkers(s.message || "");
                                    const lines = cleaned.split("\n");
                                    const productName = (lines[0] || "").replace(/^🔄\s*/, "").replace(/\s*\(modifiée\)\s*$/, "").trim();
                                    const reqLine = lines.find(l => /^Request\s*:/i.test(l));
                                    const currentText = reqLine
                                      ? reqLine.replace(/^Request\s*:\s*/i, "")
                                      : lines.slice(1).join("\n").trim();
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => openEditResetRequest(cid, productName, currentText, (s as any).reseller_note || "")}
                                        className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[11px]"
                                      >
                                        <Pencil className="h-3 w-3" /> {t("edit") || "Modifier"}
                                      </button>
                                    );
                                  })()}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${badge.bg} ${badge.text} text-xs font-medium`}>
                                    <badge.icon className="h-3 w-3" />{badge.label}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-xs max-w-[220px] whitespace-pre-wrap break-words">
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">{s.reseller_note || <span className="text-muted-foreground/50 italic">—</span>}</div>
                                    <button
                                      type="button"
                                      onClick={() => openNoteEditor("notif", s.id, s.reseller_note as any)}
                                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                                      title={t("edit") || "Modifier"}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground text-xs whitespace-pre-line max-w-[300px]">
                                  {reply ? stripMarkers(reply.message || "") : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-display font-bold text-foreground">{t("resetCodes") || "Reset Codes"}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t("selectResetProduct") || "Pick a product to request a reset"}</p>
              </div>
              {resetProducts.length === 0 ? (
                <div className="p-12 text-center">
                  <RotateCcw className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">{t("noResetProducts") || "No reset products available."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {resetProducts.map(rp => (
                    <button
                      key={rp.id}
                      onClick={() => openResetProduct(rp)}
                      className="group text-start border border-border rounded-xl p-3 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/40 transition-all flex gap-3"
                    >
                      {rp.image_url ? (
                        <img src={rp.image_url} alt={rp.name} className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <RotateCcw className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{rp.name}</h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{rp.description || "—"}</p>
                        <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-primary">
                          <RotateCcw className="h-3 w-3" />{t("requestReset") || "Request reset"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="pb-12">
            <div className="max-w-lg mx-auto space-y-6">
              {/* Account Info Card */}
              <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
                <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2"><User className="h-5 w-5 text-primary" />{t("accountInfo")}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">{t("name")}</span>
                    <span className="text-sm font-medium text-foreground">{reseller.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">{t("email")}</span>
                    <span className="text-sm font-medium text-foreground">{reseller.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">{t("pointsBalance")}</span>
                    <span className="text-sm font-bold text-primary">{reseller.credits.toLocaleString()} TND</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Level</span>
                    <span className="text-sm font-medium text-foreground">{reseller.level || 1}</span>
                  </div>
                </div>
              </div>

              {/* Edit Profile Form */}
              <div className="bg-card rounded-2xl border border-border shadow-premium p-6">
                <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />{t("editProfile")}</h3>
                <div className="space-y-4">
                  {/* Profile picture */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Photo de profil</label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {reseller.image_url ? (
                          <img src={reseller.image_url} alt={reseller.name} className="w-20 h-20 rounded-full object-cover ring-2 ring-border bg-secondary" />
                        ) : (
                          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-accent/20 text-accent text-2xl font-bold ring-2 ring-border">{reseller.name.charAt(0).toUpperCase()}</div>
                        )}
                        {reseller.image_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!profileForm.currentPassword) { toast({ title: t("error"), description: t("currentPassword") + " required", variant: "destructive" }); return; }
                              try {
                                await apiSelfUpdateReseller(reseller.id, { name: reseller.name, email: reseller.email, current_password: profileForm.currentPassword, image_url: "" });
                                toast({ title: t("success"), description: t("profileUpdated") });
                                reload(reseller.id);
                              } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
                            }}
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                            title="Supprimer la photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm cursor-pointer hover:bg-secondary transition-all ${uploadingProfileImage ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingProfileImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploadingProfileImage ? "Envoi..." : "Changer la photo"}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (!profileForm.currentPassword) { toast({ title: t("error"), description: "Saisissez votre mot de passe actuel d'abord", variant: "destructive" }); e.target.value = ""; return; }
                            setUploadingProfileImage(true);
                            try {
                              const url = await apiUploadImage(file);
                              await apiSelfUpdateReseller(reseller.id, { name: reseller.name, email: reseller.email, current_password: profileForm.currentPassword, image_url: url });
                              toast({ title: t("success"), description: t("profileUpdated") });
                              reload(reseller.id);
                            } catch (err: any) {
                              toast({ title: t("error"), description: err.message, variant: "destructive" });
                            } finally {
                              setUploadingProfileImage(false);
                              e.target.value = "";
                            }
                          }} />
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-2">Mot de passe actuel requis pour changer la photo.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("name")}</label>
                    <input value={profileForm.name || reseller.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("email")}</label>
                    <input type="email" value={profileForm.email || reseller.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} className={inputClass} />
                  </div>
                  <div className="border-t border-border pt-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("currentPassword")} *</label>
                    <input type="password" value={profileForm.currentPassword} onChange={e => setProfileForm({ ...profileForm, currentPassword: e.target.value })} placeholder={t("currentPassword")} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("newPassword")} ({t("optional")})</label>
                    <input type="password" value={profileForm.newPassword} onChange={e => setProfileForm({ ...profileForm, newPassword: e.target.value })} placeholder={t("newPassword")} className={inputClass} />
                  </div>
                  {profileForm.newPassword && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("confirmPassword")}</label>
                      <input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({ ...profileForm, confirmPassword: e.target.value })} placeholder={t("confirmPassword")} className={inputClass} />
                    </div>
                  )}
                  <button
                    disabled={savingProfile || !profileForm.currentPassword}
                    onClick={async () => {
                      if (!profileForm.currentPassword) { toast({ title: t("error"), description: t("currentPassword") + " required", variant: "destructive" }); return; }
                      if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) { toast({ title: t("error"), description: t("passwordMismatch"), variant: "destructive" }); return; }
                      if (profileForm.newPassword && profileForm.newPassword.length < 4) { toast({ title: t("error"), description: t("passwordTooShort"), variant: "destructive" }); return; }
                      setSavingProfile(true);
                      try {
                        await apiSelfUpdateReseller(reseller.id, {
                          name: profileForm.name || reseller.name,
                          email: profileForm.email || reseller.email,
                          current_password: profileForm.currentPassword,
                          password: profileForm.newPassword || undefined,
                        });
                        toast({ title: t("success"), description: t("profileUpdated") });
                        setProfileForm({ name: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" });
                        reload(reseller.id);
                      } catch (e: any) {
                        toast({ title: t("error"), description: e.message, variant: "destructive" });
                      } finally { setSavingProfile(false); }
                    }}
                    className="w-full h-11 rounded-xl gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t("save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Credentials */}
      <AlertDialog open={!!viewCredsOrder} onOpenChange={() => setViewCredsOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("viewCredentials")}</AlertDialogTitle><AlertDialogDescription>{viewCredsOrder?.service_name}</AlertDialogDescription></AlertDialogHeader>
          {viewCredsOrder?.credentials && (
            <div className="space-y-2">
              {(viewCredsOrder.delivery_type_fields && viewCredsOrder.delivery_type_fields.length > 0)
                ? viewCredsOrder.delivery_type_fields.map(f => (
                    <div key={f.key} className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-0.5">{f.label}</p>
                      <p className="text-sm text-foreground font-mono select-all">{viewCredsOrder.credentials?.[f.key] || "—"}</p>
                    </div>
                  ))
                : Object.entries(viewCredsOrder.credentials).map(([k, v]) => (
                    <div key={k} className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-0.5">{k}</p>
                      <p className="text-sm text-foreground font-mono select-all">{v}</p>
                    </div>
                  ))
              }
            </div>
          )}
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Confirmation Dialog — with Quantity & Note */}
      <AlertDialog open={!!purchaseService} onOpenChange={(open) => { if (!purchasing) setPurchaseService(open ? purchaseService : null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPurchase")}</AlertDialogTitle>
            <AlertDialogDescription>{purchaseService?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          {purchaseService && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("quantity")} (Min: 1 // Max: 20)</label>
                <input type="number" min={1} max={20} value={purchaseQuantity} onChange={(e) => setPurchaseQuantity(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("note")}</label>
                <input placeholder={t("note")} value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} className={inputClass} />
              </div>
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("price")} × {purchaseQuantity}</span>
                  <span className="font-bold text-foreground">{Number(purchaseService.price_credits) * purchaseQuantity} TND</span>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purchasing}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={purchasing} onClick={confirmPurchase} className="gradient-primary text-primary-foreground">
              {purchasing ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full me-1" /> : <ShoppingCart className="h-3.5 w-3.5 me-1" />}
              {t("buy")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Response Dialog */}
      <AlertDialog open={!!respondingNotif} onOpenChange={(open) => { if (!sendingResponse && !open) { setRespondingNotif(null); setRespondingOrder(null); setExistingResponses([]); setResponseText(""); } }}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("viewCredentials")}</AlertDialogTitle>
            <AlertDialogDescription>{respondingOrder?.service_name || ""}</AlertDialogDescription>
          </AlertDialogHeader>

          {loadingNotifOrder ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : respondingOrder ? (
            <div className="space-y-4">
              {/* Order info */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("orderDetails")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t("service")}:</span> <span className="font-medium text-foreground">{respondingOrder.service_name}</span></div>
                  <div><span className="text-muted-foreground">{t("status")}:</span> {getStatusBadge(respondingOrder.status)}</div>
                  <div><span className="text-muted-foreground">{t("pointsUsed")}:</span> <span className="font-medium text-foreground">{respondingOrder.credits_used} TND</span></div>
                  <div><span className="text-muted-foreground">{t("date")}:</span> <span className="text-foreground">{new Date(respondingOrder.created_at).toLocaleDateString()}</span></div>
                </div>
                {respondingOrder.note && <div className="text-xs text-muted-foreground mt-1">{t("note")}: {respondingOrder.note}</div>}
              </div>

              {/* Credentials from admin */}
              {respondingOrder.credentials && Object.keys(respondingOrder.credentials).length > 0 && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-5 space-y-3">
                  <h4 className="text-sm font-semibold text-success uppercase tracking-wider flex items-center gap-1.5"><CheckCircle className="h-4 w-4" />{t("credentials")}</h4>
                  {(respondingOrder.delivery_type_fields && respondingOrder.delivery_type_fields.length > 0)
                    ? respondingOrder.delivery_type_fields.map((f: any) => (
                        <div key={f.key} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-base">
                          <span className="text-muted-foreground text-sm">{f.label}</span>
                          <span className="font-mono text-foreground select-all text-base sm:text-lg font-semibold break-all">{respondingOrder.credentials?.[f.key] || "—"}</span>
                        </div>
                      ))
                    : Object.entries(respondingOrder.credentials).map(([k, v]) => (
                        <div key={k} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-base">
                          <span className="text-muted-foreground text-sm">{k}</span>
                          <span className="font-mono text-foreground select-all text-base sm:text-lg font-semibold break-all">{String(v)}</span>
                        </div>
                      ))
                  }
                </div>
              )}

            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingResponse}>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Product dynamic-form Dialog */}
      <AlertDialog open={!!rpTarget} onOpenChange={(open) => { if (!resetSubmitting && !open) setRpTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              {rpTarget?.image_url ? (
                <img src={rpTarget.image_url} alt={rpTarget.name} className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <RotateCcw className="h-5 w-5 text-muted-foreground/60" />
                </div>
              )}
              <div className="min-w-0">
                <AlertDialogTitle>{rpTarget?.name || (t("requestReset") || "Request reset")}</AlertDialogTitle>
                <AlertDialogDescription className="text-xs">
                  {rpTarget?.description || (t("fillResetForm") || "Fill the information and submit")}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1 block">
                Détails de la demande de reset <span className="text-destructive">*</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                Indiquez les informations nécessaires pour que l'admin puisse traiter votre demande, par exemple :
                <br />• <span className="text-foreground/80">Active Code</span> et <span className="text-foreground/80">MAC Address</span>
                <br />• <span className="text-foreground/80">Nom d'utilisateur</span> et <span className="text-foreground/80">mot de passe</span> (Xtream)
              </p>
              <textarea
                value={rpValues.request || ""}
                onChange={(e) => setRpValues({ request: e.target.value })}
                rows={7}
                className={`${inputClass} h-auto py-2 resize-y text-xs font-mono leading-relaxed`}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1 block">
                {t("note") || "Note"} <span className="text-muted-foreground normal-case">(optionnel)</span>
              </label>
              <input
                value={rpNote}
                onChange={(e) => setRpNote(e.target.value)}
                maxLength={2000}
                placeholder={t("note") || "Note"}
                className={inputClass}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSubmitting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={resetSubmitting} onClick={submitResetRequest} className="gradient-primary text-primary-foreground">
              {resetSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Send className="h-3.5 w-3.5 me-1" />}
              {t("sendResetRequest") || "Send request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit pending Reset Request Dialog (resellers can amend until admin replies) */}
      <AlertDialog open={!!editResetTarget} onOpenChange={(open) => { if (!editResetSubmitting && !open) setEditResetTarget(null); }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(t("edit") || "Modifier")} — {editResetTarget?.productName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous pouvez modifier votre demande tant que l'admin n'a pas encore répondu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Détails de la demande de reset <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={editResetText}
              onChange={(e) => setEditResetText(e.target.value)}
              disabled={editResetSubmitting}
            />
            <label className="text-sm font-medium text-foreground pt-2 block">
              {t("note") || "Note"} <span className="text-muted-foreground text-xs">(optionnel)</span>
            </label>
            <input
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={editResetNote}
              onChange={(e) => setEditResetNote(e.target.value)}
              maxLength={2000}
              disabled={editResetSubmitting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editResetSubmitting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={editResetSubmitting} onClick={submitEditResetRequest} className="gradient-primary text-primary-foreground">
              {editResetSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Send className="h-3.5 w-3.5 me-1" />}
              {t("save") || "Enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingGlobalMessages.length > 0}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <Megaphone className="h-5 w-5" />
              {pendingGlobalMessages[0]?.title || "Annonce"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-3 space-y-3 max-h-[55vh] overflow-y-auto">
                {pendingGlobalMessages[0]?.image_url && (
                  <img
                    src={pendingGlobalMessages[0].image_url || undefined}
                    alt=""
                    className="w-full max-h-64 object-contain rounded-xl border border-border bg-muted"
                  />
                )}
                <div className="p-4 rounded-xl bg-secondary/40 border border-border whitespace-pre-wrap text-foreground/90 text-sm leading-relaxed">
                  {pendingGlobalMessages[0]?.message}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingGlobalMessages.length > 1 && (
            <p className="text-[11px] text-muted-foreground text-center">
              {pendingGlobalMessages.length - 1} autre(s) message(s) à lire
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); dismissCurrentGlobalMessage(); }}
              className="gradient-primary text-primary-foreground"
            >
              <XCircle className="h-4 w-4 me-2" />
              Fermer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Note editor (reseller) */}
      <AlertDialog open={!!noteTarget} onOpenChange={(o) => { if (!o) setNoteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Modifier la note
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ajoutez ou modifiez votre note. L'admin pourra la voir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value.slice(0, 2000))}
            rows={6}
            maxLength={2000}
            placeholder="Votre note…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="text-[11px] text-muted-foreground text-end">{noteText.length}/2000</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={noteSaving}>{t("cancel") || "Annuler"}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); saveNote(); }} disabled={noteSaving} className="gradient-primary text-primary-foreground">
              {noteSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <CheckCircle className="h-4 w-4 me-2" />}
              {t("save") || "Enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default ResellerDashboard;
