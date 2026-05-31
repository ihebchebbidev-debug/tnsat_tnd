import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useLang } from "@/store/LangContext";
import { getAuth } from "@/store/store";
import { useToast } from "@/hooks/use-toast";
import {
  apiGetReseller, apiGetServices, apiGetOrders, apiCreateOrder,
  apiGetNotifications, apiGetResetProducts, apiSubmitResetRequest, apiEditResetRequest,
  apiGetAllProductKeyCounts,
  type ApiService, type ApiOrder, type ApiNotification, type ApiResetProduct, type ApiProductKeyCount,
} from "@/utils/api";
import {
  ArrowLeft, ShoppingCart, History, RotateCcw, Loader2, Eye, Clock,
  CheckCircle, XCircle, AlertTriangle, Package, Send, Pencil, Zap,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TabKey = "buy" | "history" | "resets";

interface ResellerLite { id: string; name: string; credits: number; }

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isRelated = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
};

const ResellerServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [reseller, setReseller] = useState<ResellerLite | null>(null);
  const [service, setService] = useState<ApiService | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [resetProducts, setResetProducts] = useState<ApiResetProduct[]>([]);
  const [keyCount, setKeyCount] = useState<ApiProductKeyCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("buy");

  // Purchase
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseNote, setPurchaseNote] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewCredsOrder, setViewCredsOrder] = useState<ApiOrder | null>(null);

  // Reset
  const [rpTarget, setRpTarget] = useState<ApiResetProduct | null>(null);
  const [rpText, setRpText] = useState("");
  const [rpNote, setRpNote] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [editResetTarget, setEditResetTarget] = useState<{ cid: string; productName: string; currentText: string; currentNote?: string } | null>(null);
  const [editResetText, setEditResetText] = useState("");
  const [editResetNote, setEditResetNote] = useState("");
  const [editResetSubmitting, setEditResetSubmitting] = useState(false);

  const reload = useCallback(async (resellerId: string, serviceId: string) => {
    try {
      const [r, services, o, notifs, rps, kcAll] = await Promise.all([
        apiGetReseller(resellerId),
        apiGetServices(resellerId),
        apiGetOrders(undefined, resellerId),
        apiGetNotifications(undefined, resellerId),
        apiGetResetProducts(true).catch(() => [] as ApiResetProduct[]),
        apiGetAllProductKeyCounts().catch(() => ({} as Record<string, ApiProductKeyCount>)),
      ]);
      setReseller({ id: r.id, name: r.name, credits: Number(r.credits) });
      setService(services.find(s => s.id === serviceId) || null);
      setOrders(o);
      setNotifications(notifs);
      setResetProducts(rps);
      setKeyCount(kcAll[serviceId] || null);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message || t("loadError"), variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast, t]);

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.type !== "reseller" || !auth.resellerId) { navigate("/login"); return; }
    if (!id) { navigate("/reseller"); return; }
    reload(auth.resellerId, id);
  }, [id, reload, navigate]);

  const serviceOrders = useMemo(
    () => orders.filter(o => o.service_id === id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders, id]
  );

  // Reset products related to this service (heuristic: name match). Fallback: show all.
  const relatedResetProducts = useMemo(() => {
    if (!service) return [] as ApiResetProduct[];
    const matches = resetProducts.filter(rp => isRelated(rp.name, service.name));
    return matches.length > 0 ? matches : resetProducts;
  }, [resetProducts, service]);

  // Build reset history (sent + admin reply matched by CID), filtered to related products.
  const resetHistory = useMemo(() => {
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
    const relatedNames = relatedResetProducts.map(rp => norm(rp.name));
    return sent
      .map(s => {
        const cid = cidOf(s.message || "");
        const reply = cid ? replyByCid.get(cid) : undefined;
        const cleaned = stripMarkers(s.message || "");
        const productName = (cleaned.split("\n")[0] || "").replace(/^🔄\s*/, "").replace(/\s*\(modifiée\)\s*$/, "").trim();
        const status: "pending" | "approved" | "cancelled" = reply
          ? (reply.type === "reset_approved" ? "approved" : "cancelled")
          : "pending";
        return { sent: s, reply, status, productName, cleanedMessage: cleaned, cid };
      })
      .filter(row => {
        if (!relatedNames.length) return true;
        const np = norm(row.productName);
        return relatedNames.some(rn => rn.includes(np) || np.includes(rn));
      })
      .sort((a, b) => new Date(b.sent.created_at).getTime() - new Date(a.sent.created_at).getTime());
  }, [notifications, relatedResetProducts]);

  const handleConfirmPurchase = async () => {
    if (!reseller || !service) return;
    const totalCost = Number(service.price_credits) * purchaseQuantity;
    if (reseller.credits < totalCost) {
      toast({ title: t("error"), description: t("notEnoughPoints"), variant: "destructive" }); return;
    }
    setPurchasing(true);
    try {
      const res: any = await apiCreateOrder({
        reseller_id: reseller.id,
        service_id: service.id,
        quantity: purchaseQuantity,
        note: purchaseNote || undefined,
      });
      if (res.credits_remaining !== undefined) setReseller(prev => prev ? { ...prev, credits: res.credits_remaining } : prev);
      setConfirmOpen(false);
      setPurchaseQuantity(1); setPurchaseNote("");
      await reload(reseller.id, service.id);
      if (res.auto_fulfilled && res.credentials) {
        toast({ title: "✅ " + t("success"), description: t("purchaseSuccess") });
      } else {
        toast({ title: t("success"), description: t("purchaseSuccess") });
      }
      navigate("/reseller", { state: { tab: "orders" } });
    } catch (e: any) {
      if (e?.data?.no_stock) {
        toast({ title: "🚫 " + (t("outOfStockTitle") || "Out of stock"), description: t("outOfStockMessage") || "Produit épuisé. L'admin a été notifié.", variant: "destructive" });
      } else {
        toast({ title: t("error"), description: e.message, variant: "destructive" });
      }
    } finally { setPurchasing(false); }
  };

  const submitReset = async () => {
    if (!reseller || !rpTarget) return;
    const text = (rpText || "").trim();
    if (!text) { toast({ title: t("error"), description: "Veuillez décrire ce dont vous avez besoin", variant: "destructive" }); return; }
    setResetSubmitting(true);
    try {
      await apiSubmitResetRequest({ reset_product_id: rpTarget.id, reseller_id: reseller.id, values: { Request: text }, note: rpNote.trim() || undefined });
      toast({ title: t("success"), description: "Demande de reset envoyée" });
      setRpTarget(null); setRpText(""); setRpNote("");
      const notifs = await apiGetNotifications(undefined, reseller.id);
      setNotifications(notifs);
    } catch (e: any) {
      toast({ title: t("error"), description: e?.message || "Impossible d'envoyer", variant: "destructive" });
    } finally { setResetSubmitting(false); }
  };

  const submitEditReset = async () => {
    if (!reseller || !editResetTarget) return;
    const text = (editResetText || "").trim();
    if (!text) { toast({ title: t("error"), description: "Veuillez décrire ce dont vous avez besoin", variant: "destructive" }); return; }
    setEditResetSubmitting(true);
    try {
      await apiEditResetRequest({ cid: editResetTarget.cid, reseller_id: reseller.id, values: { Request: text }, note: editResetNote.trim() });
      toast({ title: t("success"), description: "Demande mise à jour" });
      setEditResetTarget(null);
      const notifs = await apiGetNotifications(undefined, reseller.id);
      setNotifications(notifs);
    } catch (e: any) {
      toast({ title: t("error"), description: e?.message || "Impossible de modifier", variant: "destructive" });
    } finally { setEditResetSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!service || !reseller) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">{"Service introuvable"}</h2>
          <Link to="/reseller" className="text-primary text-sm hover:underline">{"Retour au dashboard"}</Link>
        </div>
      </div>
    );
  }

  const availableKeys = keyCount?.available ?? 0;
  const hasKeys = !!keyCount && keyCount.total > 0;
  const outOfStock = (service.stock !== null && Number(service.stock) <= 0) || (hasKeys && availableKeys <= 0);
  const cantAfford = reseller.credits < Number(service.price_credits);
  const totalCost = Number(service.price_credits) * purchaseQuantity;
  const isStock = service.sale_type === "stock";

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-600", icon: Clock, label: t("pending") },
      fulfilled: { bg: "bg-success/10", text: "text-success", icon: CheckCircle, label: t("fulfilled") },
      disputed: { bg: "bg-destructive/10", text: "text-destructive", icon: AlertTriangle, label: t("disputed") || "Disputed" },
      resolved: { bg: "bg-primary/10", text: "text-primary", icon: CheckCircle, label: t("resolved") || "Resolved" },
      cancelled: { bg: "bg-muted", text: "text-muted-foreground", icon: XCircle, label: "Cancelled" },
    };
    const s = map[status] || map.pending;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${s.bg} ${s.text} text-xs font-medium`}><s.icon className="h-3 w-3" />{s.label}</span>;
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-secondary/20">
      {/* Header */}
      <div className="bg-secondary/50 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <Link to="/reseller" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {"Retour au dashboard"}
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="font-bold text-foreground">{reseller.credits.toLocaleString()}</span>
            <span className="text-muted-foreground">TND</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service header */}
        <div className="grid md:grid-cols-[280px_1fr] gap-6 mb-8 bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
          <div className="aspect-[4/3] md:aspect-auto bg-secondary">
            {service.image_url ? (
              <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Package className="h-12 w-12 text-muted-foreground/20" /></div>
            )}
          </div>
          <div className="p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              {service.category && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{service.category}</span>}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${isStock ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                {isStock ? ("Livraison instantanée") : ("Livraison manuelle")}
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-1">{service.name}</h1>
            {service.description && <p className="text-sm text-muted-foreground mb-3">{service.description}</p>}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-bold text-primary">{Number(service.price_credits)}</span>
              <span className="text-sm text-muted-foreground">TND</span>
            </div>
          </div>
        </div>

        {/* BUY */}
        <div className="bg-card rounded-2xl border border-border shadow-premium p-6 max-w-xl mx-auto">
            <h3 className="font-display font-bold text-foreground mb-4">{t("confirmPurchase") || "Confirmer l'achat"}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("quantity") || "Quantité"} (1–20)</label>
                <input type="number" min={1} max={20} value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("note") || "Note"}</label>
                <input value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} placeholder={t("note") || "Note (optionnel)"}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 flex justify-between text-sm">
                <span className="text-muted-foreground">{t("price") || "Prix"} × {purchaseQuantity}</span>
                <span className="font-bold text-foreground">{totalCost} TND</span>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={outOfStock || cantAfford || purchasing}
                className="w-full h-12 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {outOfStock ? (t("outOfStock") || "Stock épuisé") : cantAfford ? (t("notEnoughPoints") || "Solde TND insuffisant") : <><ShoppingCart className="h-4 w-4" />{t("buy") || "Acheter"}</>}
              </button>
            </div>
        </div>
      </div>

      {/* Purchase confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!purchasing) setConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPurchase") || "Confirmer l'achat"}</AlertDialogTitle>
            <AlertDialogDescription>
              {service.name} × {purchaseQuantity} = <strong>{totalCost} TND</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purchasing}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={purchasing} onClick={handleConfirmPurchase} className="gradient-primary text-primary-foreground">
              {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : ("Confirmer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View credentials */}
      <AlertDialog open={!!viewCredsOrder} onOpenChange={() => setViewCredsOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("viewCredentials")}</AlertDialogTitle>
            <AlertDialogDescription>{viewCredsOrder?.service_name}</AlertDialogDescription>
          </AlertDialogHeader>
          {viewCredsOrder?.credentials && (
            <div className="space-y-2">
              {viewCredsOrder.delivery_type_fields && viewCredsOrder.delivery_type_fields.length > 0
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

      {/* Reset request dialog */}
      <AlertDialog open={!!rpTarget} onOpenChange={(open) => { if (!resetSubmitting && !open) setRpTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rpTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>{rpTarget?.description || "Décrivez votre demande de reset"}</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea value={rpText} onChange={(e) => setRpText(e.target.value)} rows={4}
            placeholder="Décrivez ce dont vous avez besoin (numéro de compte, problème rencontré...)"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <input value={rpNote} onChange={(e) => setRpNote(e.target.value)} maxLength={2000}
            placeholder={(t("note") || "Note") + " (optionnel)"}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSubmitting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={resetSubmitting || !rpText.trim()} onClick={submitReset} className="gradient-primary text-primary-foreground">
              {resetSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 me-1" />Envoyer</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit pending reset */}
      <AlertDialog open={!!editResetTarget} onOpenChange={(open) => { if (!editResetSubmitting && !open) setEditResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier la demande</AlertDialogTitle>
            <AlertDialogDescription>{editResetTarget?.productName}</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea value={editResetText} onChange={(e) => setEditResetText(e.target.value)} rows={4}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <input value={editResetNote} onChange={(e) => setEditResetNote(e.target.value)} maxLength={2000}
            placeholder={(t("note") || "Note") + " (optionnel)"}
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editResetSubmitting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={editResetSubmitting || !editResetText.trim()} onClick={submitEditReset} className="gradient-primary text-primary-foreground">
              {editResetSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (t("save") || "Enregistrer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResellerServiceDetail;