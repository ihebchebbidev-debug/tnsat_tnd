import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLang } from "@/store/LangContext";
import { getAuth, setAuth } from "@/store/store";
import type { DeliveryTypeField } from "@/store/store";
import {
  apiGetClients, apiGetClientsPaginated, apiCreateClient, apiUpdateClient, apiDeleteClient, apiAddCredits,
  apiRemoveCredits, apiEmptyCredits,
  apiToggleClientActive, apiBatchDeleteClients, apiBatchToggleClients,
  apiGetServices, apiCreateService, apiUpdateService, apiDeleteService,
  apiGetOrders, apiGetOrdersPaginated, apiFulfillOrder, apiResetOrderCredentials, apiCancelOrder, apiDeleteOrder,
  apiGetDeliveryTypes, apiCreateDeliveryType, apiUpdateDeliveryType, apiDeleteDeliveryType,
  apiGetComplaints, apiGetComplaintsPaginated, apiUpdateComplaint,
  apiGetResellers, apiGetResellersPaginated, apiCreateReseller, apiUpdateReseller, apiDeleteReseller, apiAddResellerCredits, apiRemoveResellerCredits, apiEmptyResellerCredits, apiToggleResellerActive,
  apiBatchDeleteResellers, apiBatchToggleResellers,
  apiGetSettings, apiUpdateSetting, apiUploadImage,
  apiGetCategories, apiCreateCategory, apiUpdateCategory, apiDeleteCategory,
  apiGetProductKeys, apiGetProductKeyCount, apiAddSingleProductKey, apiAddProductKeys, apiDeleteProductKey, apiAssignProductKey,
  apiGetAssignedKeysHistory, apiGetStockOutAttempts,
  apiGetOrderResponses, apiGetAllOrderResponses, apiCreateOrderResponse, apiUpdateOrderResponse, apiDeleteOrderResponse,
  apiGetAdminNotifications, apiCreateNotification, apiMarkNotificationRead, apiUpdateNotificationNote, apiUpdateProductKeyNote,
  apiGetResetProducts, apiCreateResetProduct, apiUpdateResetProduct, apiDeleteResetProduct,
  apiGetGlobalMessages, apiGetGlobalMessage, apiCreateGlobalMessage, apiUpdateGlobalMessage, apiDeleteGlobalMessage,
  apiGetResellerPricesForService, apiSetResellerPrice, apiDeleteResellerPrice, apiResetAllResellerPrices,
  apiGetServiceVisibility, apiSetServiceVisibility, type ServiceVisibilityMode,
  apiGetCategoryVisibility, apiSetCategoryVisibility,
  apiGetPointTransactions, apiUpdateTransactionPaid, type ApiPointTransaction,
  type ApiClient, type ApiService, type ApiOrder, type ApiDeliveryType, type ApiComplaint, type ApiReseller, type ApiCategory,
  type ApiProductKey, type ApiProductKeyField, type ApiProductKeyCount, type ApiAssignedKeyHistory, type ApiStockOutAttempt, type ApiOrderResponse, type ApiNotification,
  type ApiResetProduct, type ApiResetProductField,
  type ApiGlobalMessage,
} from "@/utils/api";
import { getCategoryImage } from "@/utils/categoryImages";
import { maskUrl, unmaskUrl } from "@/utils/urlMask";
import PaginationControls from "@/components/admin/PaginationControls";
import ClientDetailPanel from "@/components/admin/ClientDetailPanel";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Users, ShoppingCart, Zap, LayoutDashboard, Package, FileText,
  Plus, Pencil, Trash2, Coins, LogOut, TrendingUp, Search, DollarSign,
  Settings, AlertTriangle, Send, Eye, EyeOff, CheckCircle, Clock, XCircle,
  Store, History, CreditCard, RotateCcw, Power, UserPlus, MessageSquare, Mail, Download, Loader2, BookOpen, Upload, Key, X, Megaphone
} from "lucide-react";


type Tab = "stats" | "services" | "orders" | "resellers" | "historique" | "transactions" | "resetCodes" | "deliveryTypes" | "complaints" | "docs" | "settings" | "categories" | "keyHistory" | "globalMessages" | "stockOutLog";
type OrderStatus = "pending" | "fulfilled" | "disputed" | "resolved" | "cancelled";
type ComplaintStatus = "open" | "in_review" | "resolved" | "rejected";

const AdminDashboard = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("stats");
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [services, setServicesState] = useState<ApiService[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [deliveryTypes, setDeliveryTypesState] = useState<ApiDeliveryType[]>([]);
  const [complaints, setComplaintsState] = useState<ApiComplaint[]>([]);
  const [resellers, setResellers] = useState<ApiReseller[]>([]);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Categories
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<ApiCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: "", imageUrl: "", sortOrder: 0 });

  // Pagination state
  const PAGE_SIZE = 15;
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [resellersPage, setResellersPage] = useState(1);
  const [resellersTotal, setResellersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [resetFilter, setResetFilter] = useState<"all" | "pending" | "done">("pending");
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [complaintsTotal, setComplaintsTotal] = useState(0);


  const [searchDebounce, setSearchDebounce] = useState("");

  const [editingClient, setEditingClient] = useState<ApiClient | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", email: "", password: "", credits: 0 });

  const [editingService, setEditingService] = useState<ApiService | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "", description: "", imageUrl: "", priceTND: 0, priceCredits: "" as string, stock: "", deliveryTypeId: "", category: "",
    specifications: [] as { key: string; value: string }[],
    features: [] as string[],
    saleType: "command" as "stock" | "command",
  });
  const [creditsPerTnd, setCreditsPerTnd] = useState(10);
  const [settingsForm, setSettingsForm] = useState({ creditsPerTnd: "10" });
  const [savingSettings, setSavingSettings] = useState(false);
  const CREDITS_PER_TND = creditsPerTnd;
  const [uploadingImage, setUploadingImage] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: "client" | "service" | "deliveryType" | "reseller" | "category"; id: string } | null>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<"clients" | "resellers" | null>(null);
  const [bulkToggleTarget, setBulkToggleTarget] = useState<"clients" | "resellers" | null>(null);
  
  const [deleting, setDeleting] = useState(false);
  const [pointsTarget, setPointsTarget] = useState<ApiClient | null>(null);
  const [pointsAction, setPointsAction] = useState<"add" | "remove" | "empty">("add");
  const [resellerPointsTarget, setResellerPointsTarget] = useState<ApiReseller | null>(null);
  const [resellerPointsAction, setResellerPointsAction] = useState<"add" | "remove" | "empty">("add");
  const [pointsAmount, setPointsAmount] = useState("");

  // Delivery Type form
  const [showDTForm, setShowDTForm] = useState(false);
  const [editingDT, setEditingDT] = useState<ApiDeliveryType | null>(null);
  const [dtForm, setDtForm] = useState<{ name: string; description: string; fields: DeliveryTypeField[] }>({
    name: "", description: "", fields: [{ key: "", label: "", type: "text", required: true }]
  });

  // Credentials filling
  const [fillCredOrder, setFillCredOrder] = useState<ApiOrder | null>(null);
  const [credForm, setCredForm] = useState<Record<string, string>>({});



  // Reseller form
  const [showResellerForm, setShowResellerForm] = useState(false);
  const [editingReseller, setEditingReseller] = useState<ApiReseller | null>(null);
  const [resellerForm, setResellerForm] = useState({ name: "", email: "", password: "", credits: 0, canAddResellers: false, note: "", level: 1, country: "TN", imageUrl: "" });
  const [uploadingResellerImage, setUploadingResellerImage] = useState(false);
  const [resellerPointsNote, setResellerPointsNote] = useState("");
  const [resellerPointsPaid, setResellerPointsPaid] = useState(false);

  // Reseller transaction history dialog
  const [txHistoryReseller, setTxHistoryReseller] = useState<ApiReseller | null>(null);
  const [txHistoryRows, setTxHistoryRows] = useState<ApiPointTransaction[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);
  const [txPaidUpdating, setTxPaidUpdating] = useState<string | null>(null);

  // Reset codes dialog
  const [resetTarget, setResetTarget] = useState<ApiOrder | null>(null);
  const [viewingClient, setViewingClient] = useState<ApiClient | null>(null);

  // Product Keys management
  const [keysServiceId, setKeysServiceId] = useState<string | null>(null);
  const [keysServiceName, setKeysServiceName] = useState("");
  const [productKeys, setProductKeys] = useState<ApiProductKey[]>([]);
  const [keyCounts, setKeyCounts] = useState<Record<string, ApiProductKeyCount>>({});
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyFields, setNewKeyFields] = useState<ApiProductKeyField[]>([{ title: "", value: "" }]);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkTitles, setBulkTitles] = useState("Code");
  const [bulkSeparator, setBulkSeparator] = useState(";");
  const [importingBulk, setImportingBulk] = useState(false);

  // Per-reseller price overrides
  const [pricingService, setPricingService] = useState<ApiService | null>(null);
  const [pricingOverrides, setPricingOverrides] = useState<import("@/utils/api").ApiResellerServicePrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, string>>({});
  const [pricingSavingId, setPricingSavingId] = useState<string | null>(null);
  const [pricingResetting, setPricingResetting] = useState(false);

  // Per-service visibility
  const [visibilityService, setVisibilityService] = useState<ApiService | null>(null);
  const [visibilityMode, setVisibilityMode] = useState<ServiceVisibilityMode>("all");
  const [visibilitySelected, setVisibilitySelected] = useState<Set<string>>(new Set());
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  // Per-category visibility
  const [visibilityCategory, setVisibilityCategory] = useState<ApiCategory | null>(null);
  const [catVisibilityMode, setCatVisibilityMode] = useState<ServiceVisibilityMode>("all");
  const [catVisibilitySelected, setCatVisibilitySelected] = useState<Set<string>>(new Set());
  const [catVisibilityLoading, setCatVisibilityLoading] = useState(false);
  const [catVisibilitySaving, setCatVisibilitySaving] = useState(false);

  // Assigned keys history
  const [assignedKeysHistory, setAssignedKeysHistory] = useState<ApiAssignedKeyHistory[]>([]);
  const [keyHistoryLoading, setKeyHistoryLoading] = useState(false);
  const [keyHistoryServiceFilter, setKeyHistoryServiceFilter] = useState("");
  const [keyHistoryDateFrom, setKeyHistoryDateFrom] = useState("");
  const [keyHistoryDateTo, setKeyHistoryDateTo] = useState("");
  const [keyHistoryPage, setKeyHistoryPage] = useState(1);
  const [keyHistoryPerPage, setKeyHistoryPerPage] = useState(25);
  const [keyHistoryTotal, setKeyHistoryTotal] = useState(0);
  const [keyHistoryTotalPages, setKeyHistoryTotalPages] = useState(1);

  // Stock-Out Attempts log
  const [stockOutAttempts, setStockOutAttempts] = useState<ApiStockOutAttempt[]>([]);
  const [stockOutLoading, setStockOutLoading] = useState(false);
  const [stockOutTotal, setStockOutTotal] = useState(0);
  const [stockOutPage, setStockOutPage] = useState(1);
  const [stockOutServiceFilter, setStockOutServiceFilter] = useState("");
  const [stockOutResellerFilter, setStockOutResellerFilter] = useState("");
  const [stockOutBuyerType, setStockOutBuyerType] = useState<"" | "reseller" | "client">("");
  const [stockOutDateFrom, setStockOutDateFrom] = useState("");
  const [stockOutDateTo, setStockOutDateTo] = useState("");

  // Order responses
  const [viewingOrderResponses, setViewingOrderResponses] = useState<ApiOrderResponse[]>([]);
  const [viewingResponseOrder, setViewingResponseOrder] = useState<ApiOrder | null>(null);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingResponseText, setEditingResponseText] = useState("");
  const [savingResponseEdit, setSavingResponseEdit] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [orderResponseCounts, setOrderResponseCounts] = useState<Record<string, number>>({});
  const [orderAdminResponseCounts, setOrderAdminResponseCounts] = useState<Record<string, number>>({});

  // Admin approve order
  const [approvingOrder, setApprovingOrder] = useState<ApiOrder | null>(null);
  const [approveText, setApproveText] = useState("");
  const [sendingApproval, setSendingApproval] = useState(false);
  const [approveExistingResponses, setApproveExistingResponses] = useState<ApiOrderResponse[]>([]);

  // Reset request approve dialog (admin types a response, like a normal order)
  const [resetApproveTarget, setResetApproveTarget] = useState<{ notif: ApiNotification; buyerName: string; serviceName: string; displayMsg: string } | null>(null);
  const [resetApproveText, setResetApproveText] = useState("");
  const [resetApproveAction, setResetApproveAction] = useState<"approve" | "cancel">("approve");

  // Password visibility
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [showResellerPassword, setShowResellerPassword] = useState(false);

  // Bulk selection
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedResellers, setSelectedResellers] = useState<Set<string>>(new Set());

  // Admin notifications (incl. reset requests from resellers)
  const [adminNotifications, setAdminNotifications] = useState<ApiNotification[]>([]);
  const [processingResetId, setProcessingResetId] = useState<string | null>(null);

  // Note editor (admin fills the note for assigned keys or reset request notifications)
  const [noteTarget, setNoteTarget] = useState<
    | { kind: "key"; id: string; label: string }
    | { kind: "notif"; id: string; label: string }
    | null
  >(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const openNoteEditor = (target: NonNullable<typeof noteTarget>, current?: string | null) => {
    setNoteTarget(target);
    setNoteText(current || "");
  };
  const saveNote = async () => {
    if (!noteTarget) return;
    setNoteSaving(true);
    try {
      if (noteTarget.kind === "key") {
        await apiUpdateProductKeyNote(noteTarget.id, noteText);
        setAssignedKeysHistory(prev => prev.map(k => k.id === noteTarget.id ? { ...k, reseller_note: noteText || null } : k));
      } else {
        await apiUpdateNotificationNote(noteTarget.id, noteText);
        setAdminNotifications(prev => prev.map(n => n.id === noteTarget.id ? { ...n, reseller_note: noteText || null } : n));
      }
      toast({ title: t("success") || "OK", description: "Note enregistrée" });
      setNoteTarget(null);
    } catch (e: any) {
      toast({ title: t("error") || "Error", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setNoteSaving(false);
    }
  };

  // Reset Products (admin-managed catalog of resettable items)
  const [resetProducts, setResetProducts] = useState<ApiResetProduct[]>([]);
  const [showRPForm, setShowRPForm] = useState(false);
  const [editingRP, setEditingRP] = useState<ApiResetProduct | null>(null);
  const [rpForm, setRpForm] = useState<{ name: string; description: string; imageUrl: string; sortOrder: number; isActive: number; fields: ApiResetProductField[] }>({
    name: "", description: "", imageUrl: "", sortOrder: 0, isActive: 1,
    fields: [{ key: "", label: "", type: "text", required: true }],
  });
  const [uploadingRPImage, setUploadingRPImage] = useState(false);
  const [deleteRPId, setDeleteRPId] = useState<string | null>(null);

  // Global Messages (admin broadcasts to all resellers)
  const [globalMessages, setGlobalMessages] = useState<ApiGlobalMessage[]>([]);
  const [showGMForm, setShowGMForm] = useState(false);
  const [editingGM, setEditingGM] = useState<ApiGlobalMessage | null>(null);
  const [gmForm, setGmForm] = useState<{ title: string; message: string; imageUrl: string; isActive: number }>({ title: "", message: "", imageUrl: "", isActive: 1 });
  const [uploadingGMImage, setUploadingGMImage] = useState(false);
  const [savingGM, setSavingGM] = useState(false);
  const [deleteGMId, setDeleteGMId] = useState<string | null>(null);
  const [viewingGM, setViewingGM] = useState<ApiGlobalMessage | null>(null);
  const [loadingGMDetails, setLoadingGMDetails] = useState(false);

  const loadGlobalMessages = useCallback(async () => {
    try {
      const list = await apiGetGlobalMessages();
      setGlobalMessages(list);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  }, [toast, t]);

  const openCreateGM = () => {
    setEditingGM(null);
    setGmForm({ title: "", message: "", imageUrl: "", isActive: 1 });
    setShowGMForm(true);
  };

  const openEditGM = (m: ApiGlobalMessage) => {
    setEditingGM(m);
    setGmForm({ title: m.title, message: m.message, imageUrl: m.image_url || "", isActive: Number(m.is_active) });
    setShowGMForm(true);
  };

  const saveGM = async () => {
    if (!gmForm.title.trim() || !gmForm.message.trim()) {
      toast({ title: t("error"), description: "Titre et message requis", variant: "destructive" });
      return;
    }
    setSavingGM(true);
    try {
      const imgPayload = gmForm.imageUrl.trim() ? gmForm.imageUrl.trim() : null;
      if (editingGM) {
        await apiUpdateGlobalMessage(editingGM.id, { title: gmForm.title, message: gmForm.message, image_url: imgPayload, is_active: gmForm.isActive });
        toast({ title: "✅ Succès", description: "Message global mis à jour" });
      } else {
        await apiCreateGlobalMessage({ title: gmForm.title, message: gmForm.message, image_url: imgPayload, is_active: gmForm.isActive });
        toast({ title: "✅ Succès", description: "Message global créé — visible par tous les revendeurs" });
      }
      setShowGMForm(false);
      setEditingGM(null);
      await loadGlobalMessages();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setSavingGM(false);
    }
  };

  const confirmDeleteGM = async () => {
    if (!deleteGMId) return;
    try {
      await apiDeleteGlobalMessage(deleteGMId);
      toast({ title: "✅ Supprimé", description: "Message global supprimé" });
      setDeleteGMId(null);
      await loadGlobalMessages();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const openGMDetails = async (m: ApiGlobalMessage) => {
    setLoadingGMDetails(true);
    setViewingGM(m);
    try {
      const full = await apiGetGlobalMessage(m.id);
      setViewingGM(full);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoadingGMDetails(false);
    }
  };

  const toggleGMActive = async (m: ApiGlobalMessage) => {
    try {
      await apiUpdateGlobalMessage(m.id, { is_active: m.is_active ? 0 : 1 });
      await loadGlobalMessages();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setClientsPage(1);
    setResellersPage(1);
    setOrdersPage(1);
  }, [searchDebounce]);

  // Load paginated data for the active tab
  const loadTabData = useCallback(async () => {
    try {
      // Always load services, delivery types, settings, categories & reset products (small datasets, needed everywhere)
      const [s, dt, settings, cats, rps] = await Promise.all([
        apiGetServices(),
        apiGetDeliveryTypes(),
        apiGetSettings().catch(() => ({} as Record<string, string>)),
        apiGetCategories().catch(() => [] as ApiCategory[]),
        apiGetResetProducts().catch(() => [] as ApiResetProduct[]),
      ]);
      setServicesState(s);
      setDeliveryTypesState(dt);
      setApiCategories(cats);
      setResetProducts(rps);
      if (settings.credits_per_tnd) {
        const rate = parseFloat(settings.credits_per_tnd) || 10;
        setCreditsPerTnd(rate);
        setSettingsForm({ creditsPerTnd: String(rate) });
      }

      // Load paginated data based on current tab
      const [cRes, rRes, oRes, compRes, adminNotifs] = await Promise.all([
        apiGetClientsPaginated({ page: clientsPage, limit: PAGE_SIZE, search: searchDebounce || undefined }),
        apiGetResellersPaginated({ page: resellersPage, limit: PAGE_SIZE, search: searchDebounce || undefined }),
        apiGetOrdersPaginated({ page: ordersPage, limit: PAGE_SIZE, search: searchDebounce || undefined }),
        apiGetComplaintsPaginated({ page: complaintsPage, limit: PAGE_SIZE }),
        apiGetAdminNotifications().catch(() => [] as ApiNotification[]),
      ]);

      setClients(cRes.data); setClientsTotal(cRes.total);
      setResellers(rRes.data); setResellersTotal(rRes.total);
      setOrders(oRes.data); setOrdersTotal(oRes.total);
      setComplaintsState(compRes.data); setComplaintsTotal(compRes.total);
      setAdminNotifications(adminNotifs);
    } catch (e: any) {
      console.error("Failed to load data:", e);
      toast({ title: t("error"), description: e.message || t("loadError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t, clientsPage, resellersPage, ordersPage, complaintsPage, searchDebounce]);

  const reload = loadTabData;

  useEffect(() => {
    const auth = getAuth();
    if (!auth || auth.type !== "admin") { navigate("/login"); return; }
    loadTabData();
  }, [loadTabData, navigate]);

  // Auto-refresh badge counts every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [oRes, compRes, adminNotifs] = await Promise.all([
          apiGetOrdersPaginated({ page: 1, limit: PAGE_SIZE }),
          apiGetComplaintsPaginated({ page: 1, limit: PAGE_SIZE }),
          apiGetAdminNotifications().catch(() => [] as ApiNotification[]),
        ]);
        setOrders(oRes.data); setOrdersTotal(oRes.total);
        setComplaintsState(compRes.data); setComplaintsTotal(compRes.total);
        setAdminNotifications(adminNotifs);
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load response counts for current orders (stabilize dep on order IDs string)
  const orderIdsKey = orders.map(o => o.id).sort().join(",");
  useEffect(() => {
    if (orders.length === 0) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      const adminCounts: Record<string, number> = {};
      await Promise.all(orders.map(async (o) => {
        try {
          const r = await apiGetOrderResponses(o.id);
          counts[o.id] = r.length;
          // Admin responses have no reseller_id and no client_id
          adminCounts[o.id] = r.filter((x: any) => !x.reseller_id && !x.client_id).length;
        } catch { counts[o.id] = 0; adminCounts[o.id] = 0; }
      }));
      setOrderResponseCounts(counts);
      setOrderAdminResponseCounts(adminCounts);
    };
    loadCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdsKey]);

  // --- Client CRUD ---
  const openCreateClient = () => { setEditingClient(null); setClientForm({ name: "", email: "", password: "", credits: 0 }); setShowClientPassword(false); setShowClientForm(true); };
  const openEditClient = (c: ApiClient) => { setEditingClient(c); setClientForm({ name: c.name, email: c.email, password: c.password, credits: c.credits }); setShowClientPassword(false); setShowClientForm(true); };
  const saveClient = async () => {
    const trimmedName = clientForm.name.trim();
    const trimmedEmail = clientForm.email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail || !clientForm.password.trim()) return;
    // Duplicate email check
    const dupClient = clients.find(c => c.email.toLowerCase() === trimmedEmail && c.id !== editingClient?.id);
    const dupReseller = resellers.find(r => r.email.toLowerCase() === trimmedEmail);
    if (dupClient) { toast({ title: "⚠️ Email déjà utilisé", description: `Ce mail appartient déjà au client "${dupClient.name}".`, variant: "destructive" }); return; }
    if (dupReseller) { toast({ title: "⚠️ Email déjà utilisé", description: `Ce mail appartient déjà au revendeur "${dupReseller.name}".`, variant: "destructive" }); return; }
    try {
      if (editingClient) {
        await apiUpdateClient(editingClient.id, { name: trimmedName, email: trimmedEmail, password: clientForm.password.trim(), credits: clientForm.credits });
        toast({ title: t("success"), description: t("clientUpdated") });
      } else {
        await apiCreateClient({ name: trimmedName, email: trimmedEmail, password: clientForm.password.trim(), credits: clientForm.credits });
        toast({ title: t("success"), description: t("clientCreated") });
      }
      setShowClientForm(false); reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };
  const confirmDeleteClient = async (id: string) => { setDeleting(true); try { await apiDeleteClient(id); setDeleteTarget(null); toast({ title: t("success"), description: t("clientDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };
  const handleToggleClientActive = async (id: string) => { try { await apiToggleClientActive(id); reload(); toast({ title: t("success"), description: t("statusUpdated") }); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } };

  // Bulk client actions
  const toggleSelectClient = (id: string) => { setSelectedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAllClients = () => { setSelectedClients(prev => prev.size === filteredClients.length ? new Set() : new Set(filteredClients.map(c => c.id))); };
  const bulkDeleteClients = async () => { setDeleting(true); try { await apiBatchDeleteClients([...selectedClients]); setSelectedClients(new Set()); toast({ title: t("success"), description: t("bulkClientsDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };
  const bulkToggleClients = async () => { try { await apiBatchToggleClients([...selectedClients]); setSelectedClients(new Set()); toast({ title: t("success"), description: t("statusUpdated") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } };
  const handlePointsAction = async () => {
    if (!pointsTarget) return;
    try {
      if (pointsAction === "empty") {
        await apiEmptyCredits(pointsTarget.id);
      } else {
        const pts = parseFloat(pointsAmount);
        if (isNaN(pts) || pts <= 0) return;
        if (pointsAction === "add") {
          await apiAddCredits(pointsTarget.id, pts, resellerPointsNote);
        } else {
          await apiRemoveCredits(pointsTarget.id, pts);
        }
      }
      setPointsTarget(null); setPointsAmount(""); setPointsAction("add"); setResellerPointsNote("");
      toast({ title: t("success"), description: t("pointsUpdated") });
      reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  // --- Service CRUD ---
  const specsToObj = (specs: { key: string; value: string }[]): Record<string, string> | null => {
    const valid = specs.filter(s => s.key.trim() && s.value.trim());
    return valid.length > 0 ? Object.fromEntries(valid.map(s => [s.key.trim(), s.value.trim()])) : null;
  };
  const objToSpecs = (obj: Record<string, string> | null | undefined): { key: string; value: string }[] => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  };
  const openCreateService = () => { setEditingService(null); setServiceForm({ name: "", description: "", imageUrl: "", priceTND: 0, priceCredits: "", stock: "", deliveryTypeId: "", category: "", specifications: [], features: [], saleType: "command" }); setShowServiceForm(true); };
  const openEditService = (s: ApiService) => { setEditingService(s); setServiceForm({ name: s.name, description: s.description || "", imageUrl: s.image_url || "", priceTND: Number(s.price_tnd), priceCredits: String(s.price_credits ?? ""), stock: s.stock?.toString() || "", deliveryTypeId: s.delivery_type_id || "", category: s.category || "", specifications: objToSpecs(s.specifications), features: s.features || [], saleType: (s.sale_type === "stock" ? "stock" : "command") }); setShowServiceForm(true); };
  const saveService = async () => {
    const trimmedName = serviceForm.name.trim();
    const trimmedCategory = serviceForm.category.trim();
    if (!trimmedName) { toast({ title: t("error"), description: "Le nom du service est obligatoire", variant: "destructive" }); return; }
    if (!trimmedCategory) { toast({ title: t("error"), description: "La catégorie est obligatoire", variant: "destructive" }); return; }
    const data: any = {
      name: trimmedName, description: serviceForm.description.trim(), image_url: serviceForm.imageUrl.trim(),
      price_tnd: serviceForm.priceTND, price_credits: parseFloat(serviceForm.priceCredits) || 0,
      stock: serviceForm.stock ? parseInt(serviceForm.stock) : null,
      delivery_type_id: serviceForm.deliveryTypeId || undefined,
      category: serviceForm.category.trim() || null,
      specifications: specsToObj(serviceForm.specifications),
      features: serviceForm.features.filter(f => f.trim()).length > 0 ? serviceForm.features.filter(f => f.trim()) : null,
      sale_type: serviceForm.saleType,
    };
    try {
      if (editingService) { await apiUpdateService(editingService.id, data); toast({ title: t("success"), description: t("serviceUpdated") }); }
      else { await apiCreateService(data); toast({ title: t("success"), description: t("serviceCreated") }); }
      setShowServiceForm(false); reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };
  const confirmDeleteService = async (id: string) => { setDeleting(true); try { await apiDeleteService(id); setDeleteTarget(null); toast({ title: t("success"), description: t("serviceDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };

  // --- Delivery Types CRUD ---
  const openCreateDT = () => { setEditingDT(null); setDtForm({ name: "", description: "", fields: [{ key: "", label: "", type: "text", required: true }] }); setShowDTForm(true); };
  const openEditDT = (dt: ApiDeliveryType) => { setEditingDT(dt); setDtForm({ name: dt.name, description: dt.description || "", fields: [...dt.fields] as DeliveryTypeField[] }); setShowDTForm(true); };
  const addDTField = () => { setDtForm({ ...dtForm, fields: [...dtForm.fields, { key: "", label: "", type: "text", required: true }] }); };
  const removeDTField = (idx: number) => { setDtForm({ ...dtForm, fields: dtForm.fields.filter((_, i) => i !== idx) }); };
  const updateDTField = (idx: number, field: Partial<DeliveryTypeField>) => { setDtForm({ ...dtForm, fields: dtForm.fields.map((f, i) => i === idx ? { ...f, ...field } : f) }); };
  const saveDT = async () => {
    if (!dtForm.name.trim() || dtForm.fields.length === 0) return;
    const validFields = dtForm.fields.filter(f => f.key.trim() && f.label.trim());
    if (validFields.length === 0) return;
    const data = { name: dtForm.name.trim(), description: dtForm.description.trim(), fields: validFields };
    try {
      if (editingDT) { await apiUpdateDeliveryType(editingDT.id, data); toast({ title: t("success"), description: t("deliveryTypeUpdated") }); }
      else { await apiCreateDeliveryType(data); toast({ title: t("success"), description: t("deliveryTypeCreated") }); }
      setShowDTForm(false); reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };
  const confirmDeleteDT = async (id: string) => { setDeleting(true); try { await apiDeleteDeliveryType(id); setDeleteTarget(null); toast({ title: t("success"), description: t("deliveryTypeDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };

  // --- Product Keys ---
  const loadKeyCounts = useCallback(async () => {
    const counts: Record<string, ApiProductKeyCount> = {};
    for (const s of services) {
      try { counts[s.id] = await apiGetProductKeyCount(s.id); } catch { counts[s.id] = { total: 0, available: 0, assigned: 0 }; }
    }
    setKeyCounts(counts);
  }, [services]);

  useEffect(() => { if (services.length > 0) loadKeyCounts(); }, [services, loadKeyCounts]);

  const openKeyManager = async (s: ApiService) => {
    setKeysServiceId(s.id);
    setKeysServiceName(s.name);
    setNewKeyFields([{ title: "", value: "" }]);
    setLoadingKeys(true);
    try { setProductKeys(await apiGetProductKeys(s.id)); } catch { setProductKeys([]); }
    setLoadingKeys(false);
  };

  // ---- Per-reseller price overrides ----
  const openPricingManager = async (s: ApiService) => {
    setPricingService(s);
    setPricingOverrides([]);
    setPricingDrafts({});
    setPricingLoading(true);
    try {
      const list = await apiGetResellerPricesForService(s.id);
      setPricingOverrides(list);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setPricingLoading(false);
  };

  const savePricingForReseller = async (resellerId: string) => {
    if (!pricingService) return;
    const raw = (pricingDrafts[resellerId] ?? "").trim();
    setPricingSavingId(resellerId);
    try {
      if (raw === "") {
        await apiDeleteResellerPrice(pricingService.id, resellerId);
        setPricingOverrides(prev => prev.filter(p => p.reseller_id !== resellerId));
        toast({ title: t("success"), description: t("priceResetForReseller") });
      } else {
        const price = parseFloat(raw);
        if (isNaN(price) || price < 0) {
          toast({ title: t("error"), description: t("invalidPrice"), variant: "destructive" });
          setPricingSavingId(null);
          return;
        }
        await apiSetResellerPrice({ service_id: pricingService.id, reseller_id: resellerId, price_credits: price });
        const exists = pricingOverrides.find(p => p.reseller_id === resellerId);
        const r = resellers.find(x => x.id === resellerId);
        if (exists) {
          setPricingOverrides(prev => prev.map(p => p.reseller_id === resellerId ? { ...p, price_credits: price } : p));
        } else {
          setPricingOverrides(prev => [...prev, {
            service_id: pricingService.id, reseller_id: resellerId,
            price_credits: price, reseller_name: r?.name, reseller_email: r?.email,
          }]);
        }
        setPricingDrafts(prev => ({ ...prev, [resellerId]: "" }));
        toast({ title: t("success"), description: t("customPriceSaved") });
      }
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setPricingSavingId(null);
  };

  const resetAllPricesForService = async () => {
    if (!pricingService) return;
    setPricingResetting(true);
    try {
      await apiResetAllResellerPrices(pricingService.id);
      setPricingOverrides([]);
      toast({ title: t("success"), description: t("allPricesResetToDefault") });
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setPricingResetting(false);
  };

  // ---- Per-service visibility ----
  const openVisibilityManager = async (s: ApiService) => {
    setVisibilityService(s);
    setVisibilityMode("all");
    setVisibilitySelected(new Set());
    setVisibilityLoading(true);
    try {
      const data = await apiGetServiceVisibility(s.id);
      setVisibilityMode(data.mode);
      setVisibilitySelected(new Set(data.resellers.map(r => r.reseller_id)));
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setVisibilityLoading(false);
  };

  const toggleVisibilityReseller = (id: string) => {
    setVisibilitySelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const saveVisibility = async () => {
    if (!visibilityService) return;
    setVisibilitySaving(true);
    try {
      await apiSetServiceVisibility({
        service_id: visibilityService.id,
        mode: visibilityMode,
        reseller_ids: visibilityMode === "all" ? [] : Array.from(visibilitySelected),
      });
      // Update local services state so the badge reflects new mode
      setServicesState(prev => prev.map(x => x.id === visibilityService.id ? { ...x, visibility_mode: visibilityMode } : x));
      toast({ title: t("success"), description: t("visibilitySaved") });
      setVisibilityService(null);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setVisibilitySaving(false);
  };

  // ---- Per-category visibility ----
  const openCategoryVisibility = async (c: ApiCategory) => {
    setVisibilityCategory(c);
    setCatVisibilityMode("all");
    setCatVisibilitySelected(new Set());
    setCatVisibilityLoading(true);
    try {
      const data = await apiGetCategoryVisibility(c.id);
      setCatVisibilityMode(data.mode);
      setCatVisibilitySelected(new Set(data.resellers.map(r => r.reseller_id)));
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setCatVisibilityLoading(false);
  };

  const toggleCatVisibilityReseller = (id: string) => {
    setCatVisibilitySelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const saveCategoryVisibility = async () => {
    if (!visibilityCategory) return;
    setCatVisibilitySaving(true);
    try {
      await apiSetCategoryVisibility({
        category_id: visibilityCategory.id,
        mode: catVisibilityMode,
        reseller_ids: catVisibilityMode === "all" ? [] : Array.from(catVisibilitySelected),
      });
      setApiCategories(prev => prev.map(x => x.id === visibilityCategory.id ? { ...x, visibility_mode: catVisibilityMode } : x));
      toast({ title: t("success"), description: t("visibilitySaved") });
      setVisibilityCategory(null);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setCatVisibilitySaving(false);
  };

  const addProductKey = async () => {
    if (!keysServiceId) return;
    const validFields = newKeyFields.filter(f => f.title.trim() && f.value.trim());
    if (validFields.length === 0) { toast({ title: t("error"), description: "Ajoutez au moins un champ titre/valeur", variant: "destructive" }); return; }
    try {
      await apiAddSingleProductKey(keysServiceId, validFields);
      toast({ title: t("success"), description: "Clé ajoutée avec succès" });
      setNewKeyFields([{ title: "", value: "" }]);
      setProductKeys(await apiGetProductKeys(keysServiceId));
      loadKeyCounts();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const bulkImportKeys = async () => {
    if (!keysServiceId) return;
    const titles = bulkTitles.split(bulkSeparator).map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) { toast({ title: t("error"), description: "Définissez au moins un titre de champ", variant: "destructive" }); return; }

    const lines = bulkImportText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast({ title: t("error"), description: "Aucune ligne à importer", variant: "destructive" }); return; }

    const keys: { fields: ApiProductKeyField[] }[] = [];
    for (const line of lines) {
      const values = line.split(bulkSeparator).map(v => v.trim());
      const fields: ApiProductKeyField[] = titles.map((title, i) => ({
        title,
        value: values[i] || "",
      })).filter(f => f.value);
      if (fields.length > 0) keys.push({ fields });
    }

    if (keys.length === 0) { toast({ title: t("error"), description: "Aucune clé valide trouvée", variant: "destructive" }); return; }

    setImportingBulk(true);
    try {
      const result = await apiAddProductKeys(keysServiceId, keys);
      toast({ title: t("success"), description: `${result.count} clé(s) importée(s) avec succès` });
      setBulkImportText("");
      setProductKeys(await apiGetProductKeys(keysServiceId));
      loadKeyCounts();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
    setImportingBulk(false);
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBulkImportText(text.trim());
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const removeProductKey = async (keyId: string) => {
    if (!keysServiceId) return;
    try {
      await apiDeleteProductKey(keyId);
      setProductKeys(await apiGetProductKeys(keysServiceId));
      loadKeyCounts();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };

  const autoAssignKey = async (order: ApiOrder) => {
    try {
      const result = await apiAssignProductKey(order.service_id, order.id);
      // Convert fields to credentials format for the order
      const creds: Record<string, string> = {};
      result.fields.forEach(f => { creds[f.title] = f.value; });
      await apiFulfillOrder(order.id, creds);
      setFillCredOrder(null);
      toast({ title: t("success"), description: "Clé assignée et commande complétée !" });
      reload();
      loadKeyCounts();
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };

  // --- Assigned Keys History ---
  const loadKeyHistory = useCallback(async () => {
    setKeyHistoryLoading(true);
    try {
      const filters: Parameters<typeof apiGetAssignedKeysHistory>[0] = {
        page: keyHistoryPage,
        per_page: keyHistoryPerPage,
      };
      if (keyHistoryServiceFilter) filters.service_id = keyHistoryServiceFilter;
      if (keyHistoryDateFrom) filters.from = keyHistoryDateFrom;
      if (keyHistoryDateTo) filters.to = keyHistoryDateTo;
      const res = await apiGetAssignedKeysHistory(filters);
      setAssignedKeysHistory(res.data);
      setKeyHistoryTotal(res.total);
      setKeyHistoryTotalPages(res.total_pages);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setKeyHistoryLoading(false);
  }, [keyHistoryServiceFilter, keyHistoryDateFrom, keyHistoryDateTo, keyHistoryPage, keyHistoryPerPage, toast, t]);

  // Reset page when filters change
  useEffect(() => { setKeyHistoryPage(1); }, [keyHistoryServiceFilter, keyHistoryDateFrom, keyHistoryDateTo, keyHistoryPerPage]);

  useEffect(() => { if (tab === "keyHistory") loadKeyHistory(); }, [tab, loadKeyHistory]);
  useEffect(() => { if (tab === "globalMessages") loadGlobalMessages(); }, [tab, loadGlobalMessages]);

  const loadStockOut = useCallback(async () => {
    setStockOutLoading(true);
    try {
      const res = await apiGetStockOutAttempts({
        service_id: stockOutServiceFilter || undefined,
        reseller_id: stockOutResellerFilter || undefined,
        buyer_type: stockOutBuyerType || undefined,
        from: stockOutDateFrom || undefined,
        to: stockOutDateTo || undefined,
        page: stockOutPage,
        limit: 50,
      });
      setStockOutAttempts(res.data);
      setStockOutTotal(res.total);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
    setStockOutLoading(false);
  }, [stockOutServiceFilter, stockOutResellerFilter, stockOutBuyerType, stockOutDateFrom, stockOutDateTo, stockOutPage, toast, t]);

  useEffect(() => { if (tab === "stockOutLog") loadStockOut(); }, [tab, loadStockOut]);
  useEffect(() => { setStockOutPage(1); }, [stockOutServiceFilter, stockOutResellerFilter, stockOutBuyerType, stockOutDateFrom, stockOutDateTo]);


  const openFillCredentials = (order: ApiOrder) => { setFillCredOrder(order); setCredForm(order.credentials || {}); };
  const saveFillCredentials = async () => {
    if (!fillCredOrder) return;
    try { await apiFulfillOrder(fillCredOrder.id, credForm); setFillCredOrder(null); toast({ title: t("success"), description: t("credentialsFilled") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };


  // --- Reseller CRUD ---
  const openCreateReseller = () => { setEditingReseller(null); setResellerForm({ name: "", email: "", password: "", credits: 0, canAddResellers: false, note: "", level: 1, country: "TN", imageUrl: "" }); setShowResellerPassword(false); setShowResellerForm(true); };
  const openEditReseller = (r: ApiReseller) => { setEditingReseller(r); setResellerForm({ name: r.name, email: r.email, password: r.password, credits: r.credits, canAddResellers: !!r.can_add_resellers, note: r.note || "", level: r.level || 1, country: r.country || "TN", imageUrl: r.image_url || "" }); setShowResellerPassword(false); setShowResellerForm(true); };
  const saveReseller = async () => {
    const trimmedName = resellerForm.name.trim();
    const trimmedEmail = resellerForm.email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail || !resellerForm.password.trim()) return;
    // Duplicate email check
    const dupReseller = resellers.find(r => r.email.toLowerCase() === trimmedEmail && r.id !== editingReseller?.id);
    const dupClient = clients.find(c => c.email.toLowerCase() === trimmedEmail);
    if (dupReseller) { toast({ title: "⚠️ Email déjà utilisé", description: `Ce mail appartient déjà au revendeur "${dupReseller.name}".`, variant: "destructive" }); return; }
    if (dupClient) { toast({ title: "⚠️ Email déjà utilisé", description: `Ce mail appartient déjà au client "${dupClient.name}".`, variant: "destructive" }); return; }
    try {
      if (editingReseller) {
        await apiUpdateReseller(editingReseller.id, { name: trimmedName, email: trimmedEmail, password: resellerForm.password.trim(), credits: resellerForm.credits, can_add_resellers: resellerForm.canAddResellers ? 1 : 0, note: resellerForm.note, level: resellerForm.level, country: resellerForm.country, image_url: resellerForm.imageUrl.trim() });
        toast({ title: t("success"), description: t("resellerUpdated") });
      } else {
        await apiCreateReseller({ name: trimmedName, email: trimmedEmail, password: resellerForm.password.trim(), credits: resellerForm.credits, can_add_resellers: resellerForm.canAddResellers ? 1 : 0, note: resellerForm.note, level: resellerForm.level, country: resellerForm.country, image_url: resellerForm.imageUrl.trim() });
        toast({ title: t("success"), description: t("resellerCreated") });
      }
      setShowResellerForm(false); reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };
  const confirmDeleteReseller = async (id: string) => { setDeleting(true); try { await apiDeleteReseller(id); setDeleteTarget(null); toast({ title: t("success"), description: t("resellerDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };
  const handleResellerCreditsAction = async () => {
    if (!resellerPointsTarget) return;
    try {
      if (resellerPointsAction === "empty") {
        await apiEmptyResellerCredits(resellerPointsTarget.id);
      } else {
        const pts = parseFloat(pointsAmount);
        if (isNaN(pts) || pts <= 0) return;
        if (resellerPointsAction === "add") {
          await apiAddResellerCredits(resellerPointsTarget.id, pts, resellerPointsNote, resellerPointsPaid);
        } else {
          await apiRemoveResellerCredits(resellerPointsTarget.id, pts);
        }
      }
      setResellerPointsTarget(null); setPointsAmount(""); setResellerPointsNote(""); setResellerPointsPaid(false); setResellerPointsAction("add");
      toast({ title: t("success"), description: t("pointsUpdated") }); reload();
    } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
  };
  const handleToggleActive = async (id: string) => { try { await apiToggleResellerActive(id); toast({ title: t("success"), description: t("statusUpdated") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } };

  // --- Reseller transaction history ---
  const openResellerHistory = async (r: ApiReseller) => {
    setTxHistoryReseller(r);
    setTxHistoryRows([]);
    setTxHistoryLoading(true);
    try {
      const rows = await apiGetPointTransactions(undefined, r.id);
      setTxHistoryRows(rows);
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally { setTxHistoryLoading(false); }
  };
  const toggleTxPaid = async (tx: ApiPointTransaction) => {
    setTxPaidUpdating(tx.id);
    const nextPaid = !tx.is_paid;
    try {
      await apiUpdateTransactionPaid(tx.id, nextPaid);
      setTxHistoryRows(prev => prev.map(x => x.id === tx.id ? { ...x, is_paid: nextPaid ? 1 : 0 } : x));
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally { setTxPaidUpdating(null); }
  };

  // Bulk reseller actions
  const toggleSelectReseller = (id: string) => { setSelectedResellers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAllResellers = () => { setSelectedResellers(prev => prev.size === filteredResellers.length ? new Set() : new Set(filteredResellers.map(r => r.id))); };
  const bulkDeleteResellers = async () => { setDeleting(true); try { await apiBatchDeleteResellers([...selectedResellers]); setSelectedResellers(new Set()); toast({ title: t("success"), description: t("bulkResellersDeleted") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); } };
  const bulkToggleResellers = async () => { try { await apiBatchToggleResellers([...selectedResellers]); setSelectedResellers(new Set()); toast({ title: t("success"), description: t("statusUpdated") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } };

  // --- Reset codes ---
  const handleResetCredentials = async () => {
    if (!resetTarget) return;
    setDeleting(true);
    try { await apiResetOrderCredentials(resetTarget.id); setResetTarget(null); toast({ title: t("success"), description: t("credentialsReset") }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } finally { setDeleting(false); }
  };

  // --- Reset request handling (Approve / Cancel) ---
  // Supports both legacy (order-linked) and new flow (reset-product, marker [REQ:...] in message)
  const parseResetReqMarker = (message: string) => {
    const m = message.match(/\[REQ:(reseller|client)=([a-zA-Z0-9_-]+)(?:\|product=([a-zA-Z0-9_-]+))?\]/);
    if (!m) return null;
    return { kind: m[1] as "reseller" | "client", id: m[2], productId: m[3] || null };
  };

  const handleResetRequest = async (notif: ApiNotification, action: "approve" | "cancel", customMessage?: string) => {
    setProcessingResetId(notif.id);
    try {
      let targetReseller: string | null = null;
      let targetClient: string | null = null;
      let label = "";

      if (notif.order_id) {
        // Legacy: routed via the linked order
        const order = orders.find(o => o.id === notif.order_id);
        targetReseller = order?.reseller_id || null;
        targetClient = order?.client_id || null;
        label = order?.service_name || getServiceName(order?.service_id || "");
      } else {
        // New flow: parse the hidden marker
        const marker = parseResetReqMarker(notif.message || "");
        if (marker) {
          if (marker.kind === "reseller") targetReseller = marker.id;
          else targetClient = marker.id;
          if (marker.productId) {
            const rp = resetProducts.find(p => p.id === marker.productId);
            if (rp) label = rp.name;
          }
        }
      }

      const trimmed = (customMessage || "").trim();
      const defaultMsg = action === "approve"
        ? `✅ ${t("resetApprovedMsg")}${label ? " — " + label : ""}`
        : `❌ ${t("resetCancelledMsg")}${label ? " — " + label : ""}`;
      let replyMsg = trimmed
        ? (action === "approve" ? `✅ ${label ? label + " — " : ""}${trimmed}` : `❌ ${label ? label + " — " : ""}${trimmed}`)
        : defaultMsg;

      // Propagate the original request's correlation id (CID) so the reseller/client UI
      // can match this reply to the exact pending request and flip it to Approuvé/Annulé.
      const cidMatch = (notif.message || "").match(/\[CID:([a-zA-Z0-9_-]+)\]/);
      if (cidMatch) replyMsg += `\n[CID:${cidMatch[1]}]`;

      // Only create reply notification if we know the recipient
      if (targetReseller || targetClient) {
        await apiCreateNotification({
          type: action === "approve" ? "reset_approved" : "reset_cancelled",
          message: replyMsg,
          order_id: notif.order_id || null,
          client_id: targetClient,
          reseller_id: targetReseller,
        });
      }
      await apiMarkNotificationRead(notif.id, action === "approve" ? "approved" : "cancelled");
      toast({ title: t("success"), description: action === "approve" ? t("resetApproved") : t("resetCancelled") });
      reload();
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setProcessingResetId(null);
    }
  };

  const getResetRequestOutcome = (message: string): "approved" | "cancelled" | null => {
    const match = message.match(/\[ACT:(approved|cancelled)\]/);
    return match ? (match[1] as "approved" | "cancelled") : null;
  };

  const isResetRequestPending = (notif: ApiNotification) =>
    notif.type === "reset_request" && !getResetRequestOutcome(notif.message || "");

  // --- Reset Products CRUD ---
  const reloadResetProducts = useCallback(async () => {
    try { setResetProducts(await apiGetResetProducts()); } catch { /* silent */ }
  }, []);

  const openCreateRP = () => {
    setEditingRP(null);
    setRpForm({
      name: "", description: "", imageUrl: "", sortOrder: 0, isActive: 1,
      fields: [{ key: "", label: "", type: "text", required: true }],
    });
    setShowRPForm(true);
  };

  const openEditRP = (rp: ApiResetProduct) => {
    setEditingRP(rp);
    setRpForm({
      name: rp.name,
      description: rp.description || "",
      imageUrl: rp.image_url || "",
      sortOrder: Number(rp.sort_order) || 0,
      isActive: Number(rp.is_active) ? 1 : 0,
      fields: (rp.fields && rp.fields.length > 0) ? [...rp.fields] : [{ key: "", label: "", type: "text", required: true }],
    });
    setShowRPForm(true);
  };

  const addRPField = () => setRpForm(f => ({ ...f, fields: [...f.fields, { key: "", label: "", type: "text", required: false }] }));
  const removeRPField = (idx: number) => setRpForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  const updateRPField = (idx: number, patch: Partial<ApiResetProductField>) => setRpForm(f => ({
    ...f,
    fields: f.fields.map((x, i) => i === idx ? { ...x, ...patch } : x),
  }));

  const saveResetProduct = async () => {
    const name = rpForm.name.trim();
    if (!name) {
      toast({ title: "Erreur", description: "Le nom est requis", variant: "destructive" });
      return;
    }
    const data = {
      name,
      description: rpForm.description.trim(),
      image_url: rpForm.imageUrl.trim(),
      fields: [],
      sort_order: 0,
      is_active: 1,
    };
    try {
      if (editingRP) {
        await apiUpdateResetProduct(editingRP.id, data);
        toast({ title: "Succès", description: "Produit reset mis à jour avec succès" });
      } else {
        await apiCreateResetProduct(data);
        toast({ title: "Succès", description: "Produit reset créé avec succès" });
      }
      setShowRPForm(false);
      reloadResetProducts();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'enregistrer le produit reset",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteResetProduct = async () => {
    if (!deleteRPId) return;
    setDeleting(true);
    try {
      await apiDeleteResetProduct(deleteRPId);
      toast({ title: t("success"), description: t("resetProductDeleted") || "Reset product deleted" });
      setDeleteRPId(null);
      reloadResetProducts();
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const totalPointsUsed = orders.reduce((sum, o) => sum + Number(o.credits_used), 0);
  const totalRevenue = totalPointsUsed;
  const getClientName = (id: string) => clients.find((c) => c.id === id)?.name || "—";
  const getResellerName = (id: string) => resellers.find((r) => r.id === id)?.name || "—";
  const getServiceName = (id: string) => services.find((s) => s.id === id)?.name || "—";
  const getBuyerName = (o: ApiOrder) => o.client_name || o.reseller_name || (o.client_id ? getClientName(o.client_id) : o.reseller_id ? getResellerName(o.reseller_id) : "—");

  const handleLogout = () => { setAuth(null); navigate("/"); };

  // --- CSV Export ---
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const exportClients = () => downloadCSV("clients.csv", [t("name"), t("email"), t("points"), t("status"), t("date")], clients.map(c => [c.name, c.email, String(c.credits), c.is_active ? t("active") : t("inactive"), c.created_at || ""]));
  const exportResellers = () => downloadCSV("resellers.csv", [t("name"), t("email"), t("points"), t("status"), t("canAddResellers"), t("date")], resellers.map(r => [r.name, r.email, String(r.credits), r.is_active ? t("active") : t("inactive"), r.can_add_resellers ? "Yes" : "No", r.created_at || ""]));
  const exportOrders = () => downloadCSV("orders.csv", [t("buyer"), t("service"), t("status"), t("date")], orders.map(o => [getBuyerName(o), o.service_name || getServiceName(o.service_id), o.status, o.created_at]));
  const exportServices = () => downloadCSV("services.csv", [t("name"), t("description"), "TNDs", t("stock")], services.map(s => [s.name, s.description, String(s.price_credits), s.stock !== null ? String(s.stock) : ""]));

  // Server-side search for paginated tabs; client-side for services
  const filteredClients = clients; // already filtered server-side
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredResellers = resellers; // already filtered server-side
  const openComplaints = complaints.filter(c => c.status === "open" || c.status === "in_review");
  const fulfilledOrders = orders.filter(o => o.status === "fulfilled");
  const resellerOrders = orders.filter(o => o.reseller_id);

  const pendingOrdersCount = orders.filter(o => o.status === "pending").length;
  const pendingResetCount = adminNotifications.filter(isResetRequestPending).length;

  const sidebarItems: { key: Tab; icon: React.ElementType; label: string; badge?: number }[] = [
    { key: "stats", icon: LayoutDashboard, label: t("dashboard") },
    { key: "services", icon: Package, label: t("produits") },
    { key: "categories", icon: Store, label: "Catégories" },
    { key: "orders", icon: FileText, label: t("mesCommandes"), badge: pendingOrdersCount + pendingResetCount },
    { key: "resellers", icon: Store, label: t("resellers") },
    { key: "historique", icon: History, label: "Historique de transaction" },
    { key: "keyHistory", icon: Key, label: t("assignedKeysHistory") },
    { key: "stockOutLog", icon: AlertTriangle, label: t("stockOutLog") },
    { key: "resetCodes", icon: RotateCcw, label: t("resetCodesPage") || "Reset Codes", badge: pendingResetCount },
    { key: "globalMessages", icon: Megaphone, label: "Message Global" },
    { key: "settings", icon: Coins, label: "Paramètres" },
    { key: "docs", icon: BookOpen, label: "Documentation" },
  ];

  const getStatusBadge = (status: OrderStatus) => {
    const map: Record<OrderStatus, { bg: string; text: string; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-600", label: t("pending") },
      fulfilled: { bg: "bg-success/10", text: "text-success", label: t("fulfilled") },
      disputed: { bg: "bg-destructive/10", text: "text-destructive", label: t("disputed") },
      resolved: { bg: "bg-primary/10", text: "text-primary", label: t("resolved") },
      cancelled: { bg: "bg-muted", text: "text-muted-foreground", label: "Cancelled" },
    };
    const s = map[status] || map.pending;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${s.bg} ${s.text} text-xs font-medium`}>{s.label}</span>;
  };

  const getComplaintStatusBadge = (status: ComplaintStatus) => {
    const map: Record<ComplaintStatus, { bg: string; text: string; label: string }> = {
      open: { bg: "bg-yellow-500/10", text: "text-yellow-600", label: t("open") },
      in_review: { bg: "bg-primary/10", text: "text-primary", label: t("inReview") },
      resolved: { bg: "bg-success/10", text: "text-success", label: t("resolved") },
      rejected: { bg: "bg-destructive/10", text: "text-destructive", label: t("rejected") },
    };
    const s = map[status] || map.open;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${s.bg} ${s.text} text-xs font-medium`}>{s.label}</span>;
  };

  const inputClass = "w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all";

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)]">
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col border-e border-border transition-all duration-300 ${sidebarCollapsed ? "w-[72px]" : "w-[260px]"}`} style={{ background: "hsl(228, 35%, 7%)" }}>
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-glow transition-transform hover:scale-105">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </button>
          {!sidebarCollapsed && (
            <div>
              <h2 className="font-display font-bold text-white text-sm">{t("adminDashboard")}</h2>
              <p className="text-[10px] text-white/30">admin@tnsat.tn</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setSearchQuery(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                tab === item.key ? "gradient-primary text-white shadow-glow" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="flex items-center gap-2 truncate">
                  {item.label}
                  {!!item.badge && item.badge > 0 && (
                    <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">{item.badge}</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 hover:text-red-400 hover:bg-red-500/[0.06] transition-all ${sidebarCollapsed ? "justify-center" : ""}`}>
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span>{t("logout")}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex overflow-x-auto no-scrollbar">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setSearchQuery(""); }}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-3 text-[9px] font-semibold transition-all relative ${tab === item.key ? "text-primary" : "text-muted-foreground"}`}
            >
              {tab === item.key && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full gradient-primary" />}
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-[52px]">{item.label}</span>
              {!!item.badge && item.badge > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">{item.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-display font-bold text-foreground truncate">{sidebarItems.find(i => i.key === tab)?.label}</h1>
            </div>
            <div className="flex items-center gap-3">
              {tab === "orders" && (
                <div className="relative hidden sm:block">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" placeholder={t("searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 ps-9 pe-4 rounded-lg border border-border bg-secondary/50 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 w-56" />
                </div>
              )}
              
              {tab === "services" && <><button onClick={exportServices} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button><button onClick={openCreateService} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-medium shadow-glow"><Plus className="h-4 w-4" /><span className="hidden sm:inline">{t("create")}</span></button></>}
              {tab === "orders" && <button onClick={exportOrders} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>}
              
              {tab === "resellers" && <><button onClick={exportResellers} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button><button onClick={openCreateReseller} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-sm font-medium shadow-glow"><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">{t("create")}</span></button></>}
              {tab === "transactions" && <button onClick={exportOrders} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>}
              {tab === "keyHistory" && <button onClick={() => downloadCSV("assigned-keys.csv", [t("service"), t("keyFields"), t("assignedTo"), t("assignedAt")], assignedKeysHistory.map(k => [k.service_name || "", k.fields?.map(f => `${f.title}: ${f.value}`).join(" | ") || "", k.buyer_name || "", k.assigned_at || ""]))} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>}
              {tab === "stockOutLog" && <button onClick={() => downloadCSV("stock-out-attempts.csv", [t("date"), t("service"), t("buyer"), t("buyerType"), t("attemptedCredits")], stockOutAttempts.map(a => [a.created_at, a.service_name || "", `${a.buyer_name} (${a.buyer_email})`, a.buyer_type, String(a.attempted_credits)]))} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"><Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>}
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {/* Stats */}
          {tab === "stats" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard icon={Users} label={t("totalClients")} value={clientsTotal.toString()} color="primary" />
                <StatCard icon={Store} label={t("totalResellers")} value={resellersTotal.toString()} color="accent" />
                <StatCard icon={ShoppingCart} label={t("totalOrders")} value={ordersTotal.toString()} color="success" />
                <StatCard icon={DollarSign} label={t("totalRevenue")} value={`${totalPointsUsed.toLocaleString()} TND`} color="primary" />
              </div>
              <div className="grid sm:grid-cols-1 gap-5">
                <div className="bg-card rounded-2xl border border-border shadow-premium p-6 relative overflow-hidden group hover:border-yellow-500/20 transition-all">
                  <div className="absolute top-0 end-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors" />
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-yellow-500/10 border border-yellow-500/10"><Clock className="h-5 w-5 text-yellow-600" /></span>
                    <h3 className="font-display font-bold text-foreground">{t("pendingOrders")}</h3>
                  </div>
                  <p className="text-4xl font-display font-bold text-foreground tracking-tight">{orders.filter(o => o.status === "pending").length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("awaitingCredentials")}</p>
                </div>
              </div>
              {/* Recent orders */}
              <div className="bg-card rounded-2xl border border-border shadow-premium">
                <div className="flex items-center justify-between p-6 pb-4">
                  <h3 className="font-display font-bold text-foreground">{t("recentOrders")}</h3>
                  <button onClick={() => setTab("orders")} className="text-xs text-primary font-medium hover:underline">{t("viewAll")} →</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-t border-b border-border">
                      <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyer")}</th>
                      <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                      <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("pointsUsed")}</th>
                      <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                      <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("status")}</th>
                    </tr></thead>
                    <tbody>
                      {orders.slice(0, 5).map((o) => (
                        <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-6"><div className="flex items-center gap-2"><span className="flex items-center justify-center w-7 h-7 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold">{getBuyerName(o).charAt(0).toUpperCase()}</span><span className="font-medium text-foreground">{getBuyerName(o)}</span></div></td>
                          <td className="py-3 px-6 text-foreground">{o.service_name || getServiceName(o.service_id)}</td>
                          <td className="py-3 px-6"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-semibold"><Zap className="h-3 w-3" />{o.credits_used}</span></td>
                          <td className="py-3 px-6 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-6">{getStatusBadge(o.status)}</td>
                        </tr>
                      ))}
                      {orders.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("noOrders")}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Low Stock Alerts */}
              {(() => {
                const lowStockProducts = services.filter(s => {
                  const kc = keyCounts[s.id];
                  return kc && kc.available <= 5;
                });
                if (lowStockProducts.length === 0) return null;
                return (
                  <div className="bg-card rounded-2xl border border-destructive/30 shadow-premium p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></span>
                      <div>
                        <h3 className="font-display font-bold text-foreground">{t("stockEmptyAlert")}</h3>
                        <p className="text-xs text-muted-foreground">{lowStockProducts.length} produit(s) avec stock bas (≤5 clés)</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lowStockProducts.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                          <span className="text-sm font-medium text-foreground">{s.name}</span>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold ${keyCounts[s.id]?.available === 0 ? 'text-destructive' : 'text-yellow-600'}`}>
                              🔑 {keyCounts[s.id]?.available || 0} {t("codeAvailable").toLowerCase()}
                            </span>
                            <button onClick={() => { openKeyManager(s); setTab("services"); }} className="text-xs text-primary font-medium hover:underline">
                              Gérer →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Products/Services */}
          {tab === "services" && (
            <div className="space-y-4">
              {showServiceForm && (
                <div className="bg-card rounded-2xl border border-border shadow-premium p-6 space-y-5">
                  <h3 className="font-display font-bold text-foreground">{editingService ? t("edit") : t("create")} {t("service")}</h3>
                  
                  {/* Basic info */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("name")} *</label>
                    <input maxLength={100} placeholder={t("name")} value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className={inputClass} />
                  </div>

                  {/* Image — URL or upload */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("imageUrl")}</label>
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 space-y-2">
                        <input maxLength={500} placeholder="https://... ou téléchargez une image" value={maskUrl(serviceForm.imageUrl)} onChange={(e) => setServiceForm({ ...serviceForm, imageUrl: unmaskUrl(e.target.value) })} className={inputClass} />
                        <label className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm cursor-pointer hover:bg-secondary transition-all ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploadingImage ? "Envoi..." : "Télécharger une image"}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingImage(true);
                            try {
                              const url = await apiUploadImage(file);
                              setServiceForm(prev => ({ ...prev, imageUrl: url }));
                              toast({ title: t("success"), description: "Image téléchargée" });
                            } catch (err: any) {
                              toast({ title: t("error"), description: err.message, variant: "destructive" });
                            } finally {
                              setUploadingImage(false);
                              e.target.value = "";
                            }
                          }} />
                        </label>
                      </div>
                      {serviceForm.imageUrl && (
                        <div className="relative w-16 h-16 rounded-xl border border-border overflow-hidden bg-secondary/30 flex-shrink-0 group">
                          <img src={serviceForm.imageUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                          <button
                            type="button"
                            onClick={() => setServiceForm({ ...serviceForm, imageUrl: "" })}
                            className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                            title="Remove image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea maxLength={1000} placeholder={t("description")} value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} className="w-full h-20 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none" />
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("category")} *</label>
                    <select value={serviceForm.category} onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })} className={inputClass}>
                      <option value="">-- {t("category")} --</option>
                      {apiCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("pricing")}</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Prix (TND) *</label>
                        <input placeholder="0" type="text" inputMode="decimal" value={serviceForm.priceCredits} onChange={(e) => {
                          const raw = e.target.value.replace(',', '.');
                          if (raw !== '' && !/^\d*\.?\d{0,2}$/.test(raw)) return;
                          const tnd = parseFloat(raw) || 0;
                          setServiceForm({ ...serviceForm, priceCredits: raw, priceTND: tnd });
                        }} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("stock")} ({t("optional")})</label>
                        <input placeholder="∞" type="number" min={0} value={serviceForm.stock} onChange={(e) => setServiceForm({ ...serviceForm, stock: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  {/* Sale type: stock (instant key delivery) vs command (manual fulfillment) */}
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("saleType")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setServiceForm({ ...serviceForm, saleType: "command" })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${serviceForm.saleType === "command" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="text-xs font-bold">{t("saleTypeCommand")}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{t("saleTypeCommandHint")}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceForm({ ...serviceForm, saleType: "stock" })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${serviceForm.saleType === "stock" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                      >
                        <div className="text-xs font-bold">{t("saleTypeStock")}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{t("saleTypeStockHint")}</div>
                      </button>
                    </div>
                    {serviceForm.saleType === "stock" && editingService && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        💡 {t("saleTypeStockManageKeys")}
                      </p>
                    )}
                  </div>

                  {/* Delivery type */}
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("deliveryType")}</label>
                    <select value={serviceForm.deliveryTypeId} onChange={(e) => setServiceForm({ ...serviceForm, deliveryTypeId: e.target.value })} className={inputClass}>
                      <option value="">{t("selectDeliveryType")}</option>
                      {deliveryTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                    </select>
                  </div>

                  {/* Specifications (key-value pairs) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("specifications")}</p>
                      <button onClick={() => setServiceForm({ ...serviceForm, specifications: [...serviceForm.specifications, { key: "", value: "" }] })} className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"><Plus className="h-3 w-3" /> {t("addSpec")}</button>
                    </div>
                    {serviceForm.specifications.length === 0 && <p className="text-xs text-muted-foreground/50 italic">{t("noSpecsYet")}</p>}
                    <div className="space-y-2">
                      {serviceForm.specifications.map((spec, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input placeholder={t("specKey")} value={spec.key} onChange={(e) => {
                            const specs = [...serviceForm.specifications]; specs[idx] = { ...specs[idx], key: e.target.value }; setServiceForm({ ...serviceForm, specifications: specs });
                          }} className={`${inputClass} flex-1`} />
                          <input placeholder={t("specValue")} value={spec.value} onChange={(e) => {
                            const specs = [...serviceForm.specifications]; specs[idx] = { ...specs[idx], value: e.target.value }; setServiceForm({ ...serviceForm, specifications: specs });
                          }} className={`${inputClass} flex-1`} />
                          <button onClick={() => setServiceForm({ ...serviceForm, specifications: serviceForm.specifications.filter((_, i) => i !== idx) })} className="p-2 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("productFeatures")}</p>
                      <button onClick={() => setServiceForm({ ...serviceForm, features: [...serviceForm.features, ""] })} className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"><Plus className="h-3 w-3" /> {t("addFeature")}</button>
                    </div>
                    {serviceForm.features.length === 0 && <p className="text-xs text-muted-foreground/50 italic">{t("noFeaturesYet")}</p>}
                    <div className="space-y-2">
                      {serviceForm.features.map((feat, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input placeholder={`${t("feature")} ${idx + 1}`} value={feat} onChange={(e) => {
                            const f = [...serviceForm.features]; f[idx] = e.target.value; setServiceForm({ ...serviceForm, features: f });
                          }} className={`${inputClass} flex-1`} />
                          <button onClick={() => setServiceForm({ ...serviceForm, features: serviceForm.features.filter((_, i) => i !== idx) })} className="p-2 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={saveService} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl gradient-primary text-primary-foreground text-sm font-medium shadow-glow">{t("save")}</button>
                    <button onClick={() => setShowServiceForm(false)} className="h-10 px-5 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors">{t("cancel")}</button>
                  </div>
                </div>
              )}
              {filteredServices.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noServices")}</p></div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServices.map(s => (
                    <div key={s.id} className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden group hover:border-primary/20 transition-all">
                      {s.image_url && <div className="aspect-video bg-secondary overflow-hidden"><img src={s.image_url} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /></div>}
                      <div className="p-5">
                        <h3 className="font-display font-semibold text-foreground text-sm mb-1">{s.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-foreground">{s.price_credits} TND</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {s.stock !== null && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t("stock")}: {s.stock}</span>}
                          {keyCounts[s.id] && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">🔑 {keyCounts[s.id].available} dispo / {keyCounts[s.id].total} total</span>}
                          {s.specifications && Object.keys(s.specifications).length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary">{Object.keys(s.specifications).length} {t("specifications").toLowerCase()}</span>}
                          {s.features && s.features.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{s.features.length} {t("productFeatures").toLowerCase()}</span>}
                          {s.visibility_mode === "whitelist" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-semibold inline-flex items-center gap-1"><Eye className="h-3 w-3" />{t("restricted")}</span>}
                          {s.visibility_mode === "blacklist" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />{t("hidden")}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditService(s)} className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-1"><Pencil className="h-3.5 w-3.5" />{t("edit")}</button>
                          <button onClick={() => openPricingManager(s)} className="h-9 px-3 rounded-lg border border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 transition-colors flex items-center gap-1" title={t("managePricesPerReseller")}><DollarSign className="h-3.5 w-3.5" /></button>
                          <button onClick={() => openVisibilityManager(s)} className="h-9 px-3 rounded-lg border border-purple-500/30 text-purple-600 text-sm hover:bg-purple-500/10 transition-colors flex items-center gap-1" title={t("manageVisibility")}><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => openKeyManager(s)} className="h-9 px-3 rounded-lg border border-primary/20 text-primary text-sm hover:bg-primary/5 transition-colors flex items-center gap-1" title="Gérer les clés">🔑</button>
                          <button onClick={() => setDeleteTarget({ type: "service", id: s.id })} className="h-9 px-3 rounded-lg border border-destructive/20 text-destructive text-sm hover:bg-destructive/5 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Orders */}
          {tab === "orders" && (() => {
            // Build virtual "reset request" rows from unread reset notifications
            // so the admin sees them in the same list as the regular orders.
            const allResetReq = adminNotifications.filter(n => n.type === "reset_request");
            const resetReqRows = allResetReq.filter(n => {
              const isPending = isResetRequestPending(n);
              if (resetFilter === "pending") return isPending;
              if (resetFilter === "done") return !isPending;
              return true;
            }).map(n => {
              const marker = parseResetReqMarker(n.message || "");
              let buyerName = "—";
              let isReseller = false;
              if (marker?.kind === "reseller") {
                isReseller = true;
                const res = resellers.find(r => r.id === marker.id);
                buyerName = res?.name || "Revendeur";
              } else if (marker?.kind === "client") {
                const c = clients.find(c => c.id === marker.id);
                buyerName = c?.name || "Client";
              } else if (n.order_id) {
                const ord = orders.find(o => o.id === n.order_id);
                if (ord) {
                  buyerName = getBuyerName(ord);
                  isReseller = !!ord.reseller_id;
                }
              }
              let serviceName = "—";
              if (marker?.productId) {
                const rp = resetProducts.find(p => p.id === marker.productId);
                if (rp) serviceName = rp.name;
              }
              if (serviceName === "—" && n.order_id) {
                const ord = orders.find(o => o.id === n.order_id);
                if (ord) serviceName = ord.service_name || getServiceName(ord.service_id);
              }
              const rawMsg = n.message || "";
              const outcome = getResetRequestOutcome(rawMsg);
              const displayMsg = rawMsg
                .replace(/\s*\[REQ:[^\]]*\]\s*/g, "")
                .replace(/\s*\[ACT:(approved|cancelled)\]\s*/g, "")
                .trim();
              return { notif: n, buyerName, isReseller, serviceName, displayMsg, outcome };
            });

            const hasContent = orders.length > 0 || resetReqRows.length > 0;

            const pendingCount = allResetReq.filter(isResetRequestPending).length;
            const doneCount = allResetReq.filter(n => !isResetRequestPending(n)).length;
            return (
            <div>
              {allResetReq.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider me-1">
                    <RotateCcw className="h-3 w-3 inline me-1" />Reset:
                  </span>
                  {([
                    { key: "pending" as const, label: "Non traités", count: pendingCount, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
                    { key: "done" as const, label: "Traités", count: doneCount, cls: "bg-success/10 text-success border-success/30" },
                    { key: "all" as const, label: "Tous", count: allResetReq.length, cls: "bg-secondary text-foreground border-border" },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setResetFilter(opt.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        resetFilter === opt.key ? `${opt.cls} ring-2 ring-offset-1 ring-offset-background ring-current` : "bg-card text-muted-foreground border-border hover:bg-secondary/50"
                      }`}
                    >
                      {opt.label}
                      <span className="px-1.5 py-0.5 rounded bg-background/60 text-[10px]">{opt.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {!hasContent ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noOrders")}</p></div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                     <thead><tr className="border-b border-border bg-secondary/30">
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyer")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("note")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("status")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-end">{t("actions")}</th>
                       </tr></thead>
                      <tbody>
                        {/* Reset code requests — shown first, with a clear "Reset Code" hint */}
                        {resetReqRows.map(({ notif, buyerName, isReseller, serviceName, displayMsg, outcome }) => (
                          <tr key={`reset-${notif.id}`} className="border-b border-border/50 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                            <td className="py-3 px-6">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">{buyerName.charAt(0).toUpperCase()}</span>
                                <span className="font-medium text-foreground">{buyerName}</span>
                                {isReseller && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">R</span>}
                              </div>
                            </td>
                            <td className="py-3 px-6">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                                    <RotateCcw className="h-2.5 w-2.5" /> Reset Code
                                  </span>
                                  <span className="text-foreground">{serviceName}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words max-w-md line-clamp-3" title={displayMsg}>{displayMsg}</p>
                              </div>
                            </td>
                            <td className="py-3 px-6 text-muted-foreground">—</td>
                            <td className="py-3 px-6 text-muted-foreground">{new Date(notif.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-6">
                              {isResetRequestPending(notif) ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                  <RotateCcw className="h-3 w-3" />{t("pending") || "En attente"}
                                </span>
                              ) : outcome === "cancelled" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                                  <XCircle className="h-3 w-3" />Annulé
                                </span>
                              ) : outcome === "approved" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                                  <CheckCircle className="h-3 w-3" />Approuvé
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                                  <CheckCircle className="h-3 w-3" />Traité
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-6">
                              <div className="flex items-center gap-1 justify-end">
                                {isResetRequestPending(notif) && (
                                  <>
                                    <button
                                      disabled={processingResetId === notif.id}
                                      onClick={() => {
                                        setResetApproveTarget({ notif, buyerName, serviceName, displayMsg });
                                        setResetApproveAction("approve");
                                        setResetApproveText("");
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-all disabled:opacity-50"
                                    >
                                      {processingResetId === notif.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                      {t("approve")}
                                    </button>
                                    <button
                                      disabled={processingResetId === notif.id}
                                      onClick={() => {
                                        setResetApproveTarget({ notif, buyerName, serviceName, displayMsg });
                                        setResetApproveAction("cancel");
                                        setResetApproveText("");
                                      }}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all disabled:opacity-50"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      {t("cancel")}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {orders.map(o => {
                          const dt = deliveryTypes.find(d => d.id === o.delivery_type_id);
                          const hasAdminResponse = (orderAdminResponseCounts[o.id] || 0) > 0;
                          const isAutoApproved = hasAdminResponse && (o.status === "pending" || o.status === "disputed");
                          return (
                            <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="py-3 px-6"><div className="flex items-center gap-2"><span className="flex items-center justify-center w-7 h-7 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold">{getBuyerName(o).charAt(0).toUpperCase()}</span><span className="font-medium text-foreground">{getBuyerName(o)}</span>{o.reseller_id && <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">R</span>}</div></td>
                              <td className="py-3 px-6 text-foreground">{o.service_name || getServiceName(o.service_id)}</td>
                              <td className="py-3 px-6 text-muted-foreground text-xs max-w-[150px] truncate" title={o.note || ""}>{o.note || "—"}</td>
                              <td className="py-3 px-6 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-6">
                                {isAutoApproved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium"><CheckCircle className="h-3 w-3" />Approuvé</span>
                                ) : getStatusBadge(o.status)}
                              </td>
                              <td className="py-3 px-6">
                                <div className="flex items-center gap-1 justify-end">
                                  {!isAutoApproved && (o.status === "pending" || o.status === "disputed") && dt && (
                                    <button onClick={() => openFillCredentials(o)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-all"><Send className="h-3 w-3" />{t("fillCredentials")}</button>
                                  )}
                                  {!isAutoApproved && o.status === "pending" && (
                                    <button onClick={async () => { try { await apiCancelOrder(o.id); toast({ title: t("success"), description: "Order cancelled & points refunded" }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/5 text-destructive text-xs font-medium hover:bg-destructive/10 transition-all"><XCircle className="h-3 w-3" />Cancel</button>
                                  )}
                                  {o.credentials && <button onClick={() => openFillCredentials(o)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title={t("viewCredentials")}><Eye className="h-4 w-4" /></button>}
                                  {!isAutoApproved && (o.status === "pending" || o.status === "disputed") && (
                                    <button onClick={async () => {
                                        setApprovingOrder(o); setApproveText(""); setSendingApproval(false);
                                        try { const r = await apiGetOrderResponses(o.id); setApproveExistingResponses(r); } catch { setApproveExistingResponses([]); }
                                      }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-all"><CheckCircle className="h-3 w-3" />{t("approveOrder")}</button>
                                  )}
                                  <button onClick={async () => {
                                      setViewingResponseOrder(o); setLoadingResponses(true);
                                      try { const r = await apiGetOrderResponses(o.id); setViewingOrderResponses(r); } catch { setViewingOrderResponses([]); }
                                      finally { setLoadingResponses(false); }
                                    }} className="relative inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-all" title={t("viewResponses")}>
                                      <MessageSquare className="h-3 w-3" />
                                      {(orderResponseCounts[o.id] || 0) > 0 && (
                                        <span className="absolute -top-1.5 -end-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">{orderResponseCounts[o.id]}</span>
                                      )}
                                    </button>
                                  {(o.status === "fulfilled" || o.status === "cancelled" || o.status === "resolved" || isAutoApproved) && (
                                    <button onClick={async () => { try { await apiDeleteOrder(o.id); toast({ title: t("success"), description: "Commande supprimée" }); reload(); } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); } }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                                  )}
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
              <PaginationControls page={ordersPage} totalPages={Math.ceil(ordersTotal / PAGE_SIZE)} total={ordersTotal} limit={PAGE_SIZE} onPageChange={setOrdersPage} />
            </div>
            );
          })()}


          {tab === "resellers" && (
            <div className="space-y-4">
              {showResellerForm && (
                <div className="bg-card rounded-2xl border border-border shadow-premium p-6 space-y-4">
                  <h3 className="font-display font-bold text-foreground">{editingReseller ? t("edit") : t("create")} {t("reseller")}</h3>
                  {/* Profile picture — URL or upload */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Photo de profil</label>
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 space-y-2">
                        <input maxLength={500} placeholder="https://... ou téléchargez une image" value={resellerForm.imageUrl} onChange={(e) => setResellerForm({ ...resellerForm, imageUrl: e.target.value })} className={inputClass} />
                        <label className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm cursor-pointer hover:bg-secondary transition-all ${uploadingResellerImage ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingResellerImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {uploadingResellerImage ? "Envoi..." : "Télécharger une image"}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingResellerImage(true);
                            try {
                              const url = await apiUploadImage(file);
                              setResellerForm(prev => ({ ...prev, imageUrl: url }));
                              toast({ title: t("success"), description: "Image téléchargée" });
                            } catch (err: any) {
                              toast({ title: t("error"), description: err.message, variant: "destructive" });
                            } finally {
                              setUploadingResellerImage(false);
                              e.target.value = "";
                            }
                          }} />
                        </label>
                      </div>
                      {resellerForm.imageUrl && (
                        <div className="relative w-16 h-16 rounded-full border border-border overflow-hidden bg-secondary/30 flex-shrink-0">
                          <img src={resellerForm.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                          <button
                            type="button"
                            onClick={() => setResellerForm({ ...resellerForm, imageUrl: "" })}
                            className="absolute top-0 right-0 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                            title="Remove image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input maxLength={100} placeholder={t("name")} value={resellerForm.name} onChange={(e) => setResellerForm({ ...resellerForm, name: e.target.value })} className={inputClass} />
                    <input maxLength={255} placeholder={t("email")} type="email" value={resellerForm.email} onChange={(e) => setResellerForm({ ...resellerForm, email: e.target.value })} className={inputClass} />
                    <div className="relative">
                      <input maxLength={128} placeholder={t("password")} type={showResellerPassword ? "text" : "password"} value={resellerForm.password} onChange={(e) => setResellerForm({ ...resellerForm, password: e.target.value })} className={inputClass} />
                      <button type="button" onClick={() => setShowResellerPassword(!showResellerPassword)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showResellerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <input placeholder={t("points")} type="number" min={0} step={0.01} value={resellerForm.credits} onChange={(e) => setResellerForm({ ...resellerForm, credits: parseFloat(e.target.value) || 0 })} className={inputClass} />
                    <input maxLength={500} placeholder={t("note")} value={resellerForm.note} onChange={(e) => setResellerForm({ ...resellerForm, note: e.target.value })} className={inputClass} />
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("level")}</label>
                      <input type="number" min={1} max={10} value={resellerForm.level} onChange={(e) => setResellerForm({ ...resellerForm, level: parseInt(e.target.value) || 1 })} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("country")}</label>
                      <select value={resellerForm.country} onChange={(e) => setResellerForm({ ...resellerForm, country: e.target.value })} className={inputClass}>
                        <option value="TN">🇹🇳 Tunisie</option>
                        <option value="DZ">🇩🇿 Algérie</option>
                        <option value="MA">🇲🇦 Maroc</option>
                        <option value="LY">🇱🇾 Libye</option>
                        <option value="FR">🇫🇷 France</option>
                        <option value="DE">🇩🇪 Allemagne</option>
                        <option value="IT">🇮🇹 Italie</option>
                        <option value="ES">🇪🇸 Espagne</option>
                        <option value="BE">🇧🇪 Belgique</option>
                        <option value="CA">🇨🇦 Canada</option>
                        <option value="OTHER">🌍 Autre</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={resellerForm.canAddResellers} onChange={(e) => setResellerForm({ ...resellerForm, canAddResellers: e.target.checked })} className="rounded" />
                    {t("canAddResellers")}
                  </label>
                  <div className="flex gap-3">
                    <button onClick={saveReseller} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl gradient-primary text-primary-foreground text-sm font-medium shadow-glow">{t("save")}</button>
                    <button onClick={() => setShowResellerForm(false)} className="h-10 px-5 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors">{t("cancel")}</button>
                  </div>
                </div>
              )}
              {filteredResellers.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noResellers")}</p></div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  {selectedResellers.size > 0 && (
                    <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 border-b border-border">
                      <span className="text-sm font-medium text-foreground">{selectedResellers.size} {t("selected")}</span>
                      <button onClick={() => setBulkToggleTarget("resellers")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-600 text-xs font-medium hover:bg-yellow-500/20 transition-colors"><Power className="h-3 w-3" />{t("toggleActive")}</button>
                      <button onClick={() => setBulkDeleteTarget("resellers")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"><Trash2 className="h-3 w-3" />{t("delete")}</button>
                      <button onClick={() => setSelectedResellers(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors ms-auto">{t("cancel")}</button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-secondary/30">
                        <th className="py-3 px-3 w-10"><input type="checkbox" checked={selectedResellers.size === filteredResellers.length && filteredResellers.length > 0} onChange={toggleSelectAllResellers} className="rounded" /></th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("name")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("email")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("note")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("points")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("level")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("owner")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("country")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-start">{t("status")}</th>
                        <th className="py-3 px-4 font-medium text-muted-foreground text-end">{t("actions")}</th>
                      </tr></thead>
                      <tbody>
                        {filteredResellers.map(r => {
                          const countryFlags: Record<string, string> = { TN: "🇹🇳", DZ: "🇩🇿", MA: "🇲🇦", LY: "🇱🇾", FR: "🇫🇷", DE: "🇩🇪", IT: "🇮🇹", ES: "🇪🇸", BE: "🇧🇪", CA: "🇨🇦" };
                          return (
                            <tr key={r.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${selectedResellers.has(r.id) ? "bg-primary/[0.03]" : ""}`}>
                              <td className="py-3 px-3"><input type="checkbox" checked={selectedResellers.has(r.id)} onChange={() => toggleSelectReseller(r.id)} className="rounded" /></td>
                              <td className="py-3 px-4"><div className="flex items-center gap-3">{r.image_url ? <img src={r.image_url} alt={r.name} className="w-8 h-8 rounded-full object-cover bg-accent/20 ring-1 ring-border" /> : <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-bold">{r.name.charAt(0).toUpperCase()}</span>}<span className="font-medium text-foreground">{r.name}</span></div></td>
                              <td className="py-3 px-4 text-muted-foreground text-xs">{r.email}</td>
                              <td className="py-3 px-4 text-muted-foreground text-xs max-w-[120px] truncate">{r.note || "—"}</td>
                              <td className="py-3 px-4"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/5 text-primary text-xs font-semibold"><Zap className="h-3 w-3" />{r.credits.toLocaleString()}</span></td>
                              <td className="py-3 px-4 text-xs text-muted-foreground">Level {r.level}</td>
                              <td className="py-3 px-4 text-xs text-muted-foreground">{r.parent_name || "—"}</td>
                              <td className="py-3 px-4 text-sm">{countryFlags[r.country] || "🌍"}</td>
                              <td className="py-3 px-4">{r.is_active ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">{t("active")}</span> : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">{t("inactive")}</span>}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => openEditReseller(r)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title={t("edit")}><Pencil className="h-4 w-4" /></button>
                                  <button onClick={() => { setResellerPointsTarget(r); setPointsAmount(""); setResellerPointsNote(""); setResellerPointsPaid(false); setResellerPointsAction("add"); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all" title="Gérer solde"><Coins className="h-4 w-4" /></button>
                                  <button onClick={() => openResellerHistory(r)} className="p-2 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/5 transition-all" title={t("transactionHistory")}><History className="h-4 w-4" /></button>
                                  <button onClick={() => handleToggleActive(r.id)} className="p-2 rounded-lg text-muted-foreground hover:text-yellow-600 hover:bg-yellow-500/5 transition-all" title={t("toggleActive")}><Power className="h-4 w-4" /></button>
                                  <button onClick={() => setDeleteTarget({ type: "reseller", id: r.id })} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all" title={t("delete")}><Trash2 className="h-4 w-4" /></button>
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
              <PaginationControls page={resellersPage} totalPages={Math.ceil(resellersTotal / PAGE_SIZE)} total={resellersTotal} limit={PAGE_SIZE} onPageChange={setResellersPage} />
            </div>
          )}


          {tab === "historique" && (
            <div>
              {resellerOrders.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noHistory")}</p></div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-secondary/30">
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("reseller")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("pointsUsed")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("status")}</th>
                      </tr></thead>
                      <tbody>
                        {resellerOrders.map(o => (
                          <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-6 font-medium text-foreground">{o.reseller_name || (o.reseller_id ? getResellerName(o.reseller_id) : "—")}</td>
                            <td className="py-3 px-6 text-foreground">{o.service_name || getServiceName(o.service_id)}</td>
                            <td className="py-3 px-6"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-semibold"><Zap className="h-3 w-3" />{o.credits_used}</span></td>
                            <td className="py-3 px-6 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-6">{getStatusBadge(o.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assigned Keys History */}
          {tab === "keyHistory" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-card rounded-2xl border border-border shadow-premium p-5">
                <h3 className="font-display font-bold text-foreground text-sm mb-3">{t("filters")}</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("filterByProduct")}</label>
                    <select value={keyHistoryServiceFilter} onChange={(e) => setKeyHistoryServiceFilter(e.target.value)} className={inputClass}>
                      <option value="">{t("allProducts")}</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("from")}</label>
                    <input type="date" value={keyHistoryDateFrom} onChange={(e) => setKeyHistoryDateFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("to")}</label>
                    <input type="date" value={keyHistoryDateTo} onChange={(e) => setKeyHistoryDateTo(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground uppercase">Par page</label>
                  <select value={keyHistoryPerPage} onChange={(e) => setKeyHistoryPerPage(Number(e.target.value))} className="h-9 px-2 rounded-lg border border-border bg-background text-foreground text-xs">
                    {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {keyHistoryLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : assignedKeysHistory.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noAssignedKeys")}</p></div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-secondary/30">
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("keyFields")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("assignedTo")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">Note admin</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("assignedAt")}</th>
                      </tr></thead>
                      <tbody>
                        {assignedKeysHistory.map(k => (
                          <tr key={k.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors align-top">
                            <td className="py-3 px-6 font-medium text-foreground">{k.service_name || "—"}</td>
                            <td className="py-3 px-6">
                              <div className="space-y-0.5">
                                {k.fields?.map((f, i) => (
                                  <div key={i} className="text-xs"><span className="text-muted-foreground">{f.title}:</span> <span className="text-foreground font-mono">{f.value}</span></div>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-6 text-foreground">{k.buyer_name || "—"}</td>
                            <td className="py-3 px-6 text-muted-foreground text-xs max-w-[240px]">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 whitespace-pre-wrap break-words">{k.reseller_note || <span className="text-muted-foreground/50 italic">—</span>}</div>
                                <button
                                  onClick={() => openNoteEditor({ kind: "key", id: k.id, label: k.service_name || "" }, k.reseller_note)}
                                  title={t("edit") || "Modifier"}
                                  className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-6 text-muted-foreground">{k.assigned_at ? new Date(k.assigned_at).toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <PaginationControls
                page={keyHistoryPage}
                totalPages={keyHistoryTotalPages}
                total={keyHistoryTotal}
                limit={keyHistoryPerPage}
                onPageChange={setKeyHistoryPage}
              />
            </div>
          )}


          {tab === "stockOutLog" && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border shadow-premium p-5">
                <h3 className="font-display font-bold text-foreground text-sm mb-3">{t("filters")}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("filterByProduct")}</label>
                    <select value={stockOutServiceFilter} onChange={(e) => setStockOutServiceFilter(e.target.value)} className={inputClass}>
                      <option value="">{t("allProducts")}</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("filterByReseller")}</label>
                    <select value={stockOutResellerFilter} onChange={(e) => setStockOutResellerFilter(e.target.value)} className={inputClass}>
                      <option value="">{t("allResellers")}</option>
                      {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("buyerType")}</label>
                    <select value={stockOutBuyerType} onChange={(e) => setStockOutBuyerType(e.target.value as "" | "reseller" | "client")} className={inputClass}>
                      <option value="">{t("allBuyerTypes")}</option>
                      <option value="reseller">{t("resellerOnly")}</option>
                      <option value="client">{t("clientOnly")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("from")}</label>
                    <input type="date" value={stockOutDateFrom} onChange={(e) => setStockOutDateFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{t("to")}</label>
                    <input type="date" value={stockOutDateTo} onChange={(e) => setStockOutDateTo(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>

              {stockOutLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : stockOutAttempts.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("noStockOutAttempts")}</p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-secondary/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {stockOutTotal} {t("stockOutAttempts").toLowerCase()}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-secondary/30">
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyer")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyerType")}</th>
                        <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("attemptedCredits")}</th>
                      </tr></thead>
                      <tbody>
                        {stockOutAttempts.map(a => (
                          <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-6 text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                            <td className="py-3 px-6 font-medium text-foreground">{a.service_name || "—"}</td>
                            <td className="py-3 px-6">
                              <div className="font-medium text-foreground">{a.buyer_name}</div>
                              {a.buyer_email && <div className="text-xs text-muted-foreground">{a.buyer_email}</div>}
                            </td>
                            <td className="py-3 px-6">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.buyer_type === "reseller" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                                {a.buyer_type === "reseller" ? t("resellerOnly") : a.buyer_type === "client" ? t("clientOnly") : "—"}
                              </span>
                            </td>
                            <td className="py-3 px-6 font-mono text-foreground">{a.attempted_credits.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {stockOutTotal > 50 && (
                    <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>{stockOutPage} / {Math.ceil(stockOutTotal / 50)}</span>
                      <div className="flex gap-2">
                        <button disabled={stockOutPage <= 1} onClick={() => setStockOutPage(p => p - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-secondary">←</button>
                        <button disabled={stockOutPage >= Math.ceil(stockOutTotal / 50)} onClick={() => setStockOutPage(p => p + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-secondary">→</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "transactions" && (
            <div>
              {orders.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center"><CreditCard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{t("noTransactions")}</p></div>
              ) : (
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                       <thead><tr className="border-b border-border bg-secondary/30">
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">#</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyer")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("durationMonths")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">TNDs</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                         <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("status")}</th>
                       </tr></thead>
                      <tbody>
                        {orders.map((o, i) => {
                          return (
                            <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="py-3 px-6 text-muted-foreground text-xs">#{i + 1}</td>
                              <td className="py-3 px-6 font-medium text-foreground">{getBuyerName(o)}</td>
                              <td className="py-3 px-6 text-foreground">{o.service_name || getServiceName(o.service_id)}</td>
                              <td className="py-3 px-6"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/5 text-accent text-xs font-semibold">{o.duration_months || 12} {t("months")}</span></td>
                              <td className="py-3 px-6"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-semibold"><Zap className="h-3 w-3" />{o.credits_used}</span></td>
                              <td className="py-3 px-6 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-6">{getStatusBadge(o.status)}</td>
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


          {tab === "resetCodes" && (() => {
            const PageIcon = RotateCcw;
            const pageTitle = t("resetCodesPage") || "Reset Codes";

            const resetRequests = adminNotifications.filter(isResetRequestPending);
            const resetProductNames = new Set(
              resetProducts.map(rp => (rp.name || "").trim().toLowerCase()).filter(Boolean)
            );
            const resetFulfilledOrders = fulfilledOrders.filter(o => {
              const name = (o.service_name || getServiceName(o.service_id) || "").trim().toLowerCase();
              if (!name) return false;
              if (resetProductNames.has(name)) return true;
              for (const rp of resetProductNames) {
                if (name.includes(rp) || rp.includes(name)) return true;
              }
              return false;
            });

            return (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <PageIcon className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold text-foreground text-lg">{pageTitle}</h2>
                </div>

                {/* All pending reset requests (any product) */}
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center gap-2">
                    <PageIcon className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-bold text-foreground">{t("resetRequests")}</h3>
                    {resetRequests.length > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                        {resetRequests.length}
                      </span>
                    )}
                  </div>
                  {resetRequests.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">{t("noResetRequests")}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {resetRequests.map(n => {
                        const order = orders.find(o => o.id === n.order_id);
                        // Strip the hidden routing marker from the displayed message
                        const displayMsg = (n.message || "").replace(/\s*\[REQ:[^\]]*\]\s*$/, "");
                        return (
                          <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground font-medium break-words whitespace-pre-wrap">{displayMsg}</p>
                              <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border text-xs text-foreground">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 whitespace-pre-wrap break-words">
                                    <span className="font-semibold text-muted-foreground">Note admin:</span>{" "}
                                    {n.reseller_note || <span className="text-muted-foreground/60 italic">—</span>}
                                  </div>
                                  <button
                                    onClick={() => openNoteEditor({ kind: "notif", id: n.id, label: "Demande de reset" }, n.reseller_note)}
                                    title={t("edit") || "Modifier"}
                                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(n.created_at).toLocaleString()}
                                {order && <> · {getBuyerName(order)} · {order.service_name || getServiceName(order.service_id)}</>}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                disabled={processingResetId === n.id}
                                onClick={() => {
                                  setResetApproveAction("approve");
                                  setResetApproveText("");
                                  setResetApproveTarget({
                                    notif: n,
                                    buyerName: order ? getBuyerName(order) : "",
                                    serviceName: order ? (order.service_name || getServiceName(order.service_id)) : "",
                                    displayMsg,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-all disabled:opacity-50"
                              >
                                {processingResetId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                {t("approve")}
                              </button>
                              <button
                                disabled={processingResetId === n.id}
                                onClick={() => {
                                  setResetApproveAction("cancel");
                                  setResetApproveText("");
                                  setResetApproveTarget({
                                    notif: n,
                                    buyerName: order ? getBuyerName(order) : "",
                                    serviceName: order ? (order.service_name || getServiceName(order.service_id)) : "",
                                    displayMsg,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all disabled:opacity-50"
                              >
                                <XCircle className="h-3 w-3" />
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reset Products catalog (admin CRUD) */}
                <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-display font-bold text-foreground">{t("resetProducts") || "Reset Products"}</h3>
                      <span className="text-xs text-muted-foreground">({resetProducts.length})</span>
                    </div>
                    <button onClick={openCreateRP} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all">
                      <Plus className="h-3.5 w-3.5" />{t("addResetProduct") || "Add reset product"}
                    </button>
                  </div>
                  {resetProducts.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">{t("noResetProducts") || "No reset products yet."}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                      {resetProducts.map(rp => (
                        <div key={rp.id} className="border border-border rounded-xl p-3 bg-secondary/20 flex gap-3">
                          {rp.image_url ? (
                            <img src={rp.image_url} alt={rp.name} className="w-16 h-16 rounded-lg object-cover bg-muted shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <RotateCcw className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-foreground text-sm truncate">{rp.name}</h4>
                                <p className="text-[11px] text-muted-foreground truncate">{rp.description || "—"}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditRP(rp)} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"><Pencil className="h-3 w-3" /></button>
                                <button onClick={() => setDeleteRPId(rp.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* All fulfilled orders — admin can edit credentials or hard-reset */}
                {resetFulfilledOrders.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border p-12 text-center">
                    <PageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">{t("noOrders")}</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-secondary/30">
                          <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("buyer")}</th>
                          <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("service")}</th>
                          <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("credentials")}</th>
                          <th className="py-3 px-6 font-medium text-muted-foreground text-start">{t("date")}</th>
                          <th className="py-3 px-6 font-medium text-muted-foreground text-end">{t("actions")}</th>
                        </tr></thead>
                        <tbody>
                          {resetFulfilledOrders.map(o => (
                            <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                              <td className="py-3 px-6 font-medium text-foreground">{getBuyerName(o)}</td>
                              <td className="py-3 px-6 text-foreground">{o.service_name || getServiceName(o.service_id)}</td>
                              <td className="py-3 px-6">
                                {o.credentials ? (
                                  <div className="text-xs space-y-0.5">
                                    {Object.entries(o.credentials).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="text-foreground font-mono">{v}</span></div>)}
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-3 px-6 text-muted-foreground">{o.fulfilled_at ? new Date(o.fulfilled_at).toLocaleDateString() : "—"}</td>
                              <td className="py-3 px-6">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => openFillCredentials(o)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-all"><Pencil className="h-3 w-3" />{t("edit")}</button>
                                  <button onClick={() => setResetTarget(o)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/5 text-destructive text-xs font-medium hover:bg-destructive/10 transition-all"><RotateCcw className="h-3 w-3" />{t("resetCredentials")}</button>
                                </div>
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

          {tab === "categories" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-bold text-foreground">Catégories de produits</h2>
                  <p className="text-xs text-muted-foreground">Gérez les catégories affichées aux clients et revendeurs</p>
                </div>
                <button onClick={() => { setEditingCat(null); setCatForm({ name: "", imageUrl: "", sortOrder: apiCategories.length }); setShowCatForm(true); }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-glow hover:shadow-lg transition-all">
                  <Plus className="h-4 w-4" /> Ajouter
                </button>
              </div>

              {/* Category Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {apiCategories.map((cat) => {
                  const img = getCategoryImage(cat.name, cat.image_url);
                  return (
                    <div key={cat.id} className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden group hover:border-primary/20 transition-all">
                      <div className="aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden">
                        {img ? (
                          <img src={img} alt={cat.name} className="w-3/4 h-3/4 object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                        ) : (
                          <Package className="h-12 w-12 text-muted-foreground/20" />
                        )}
                      </div>
                      <div className="p-3 bg-secondary/20">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-card text-xs font-bold text-primary">
                            {cat.product_count} <span className="text-muted-foreground font-normal">Produits</span>
                          </span>
                          {cat.visibility_mode === "whitelist" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 font-semibold inline-flex items-center gap-1"><Eye className="h-3 w-3" />{t("restricted")}</span>}
                          {cat.visibility_mode === "blacklist" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />{t("hidden")}</span>}
                        </div>
                        <h4 className="font-display font-bold text-foreground text-sm truncate">{cat.name}</h4>
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, imageUrl: cat.image_url || "", sortOrder: cat.sort_order }); setShowCatForm(true); }} className="flex-1 h-8 rounded-lg border border-border bg-card text-muted-foreground text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1">
                            <Pencil className="h-3 w-3" /> {t("edit")}
                          </button>
                          <button onClick={() => openCategoryVisibility(cat)} title={t("visibilityFor")} className="h-8 w-8 rounded-lg border border-border text-purple-600 hover:bg-purple-500/10 transition-all flex items-center justify-center">
                            <Eye className="h-3 w-3" />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: "category", id: cat.id })} className="h-8 w-8 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-all flex items-center justify-center">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {apiCategories.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Aucune catégorie. Cliquez "Ajouter" pour créer.</p>
                </div>
              )}

              {/* Category Form Dialog */}
              {showCatForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCatForm(false)}>
                  <div className="bg-card rounded-2xl border border-border shadow-premium w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-display font-bold text-foreground">{editingCat ? "Modifier la catégorie" : "Nouvelle catégorie"}</h3>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("name")} *</label>
                      <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className={inputClass} placeholder="IPTV ACTIVE CODE" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Image de la catégorie ({t("optional")})</label>
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 space-y-2">
                          <input maxLength={500} placeholder="https://... ou téléchargez une image" value={maskUrl(catForm.imageUrl)} onChange={e => setCatForm({ ...catForm, imageUrl: unmaskUrl(e.target.value) })} className={inputClass} />
                          <label className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm cursor-pointer hover:bg-secondary transition-all ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                            {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {uploadingImage ? "Envoi..." : "Télécharger une image"}
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingImage(true);
                              try {
                                const url = await apiUploadImage(file);
                                setCatForm(prev => ({ ...prev, imageUrl: url }));
                                toast({ title: t("success"), description: "Image téléchargée" });
                              } catch (err: any) {
                                toast({ title: t("error"), description: err.message, variant: "destructive" });
                              } finally {
                                setUploadingImage(false);
                                e.target.value = "";
                              }
                            }} />
                          </label>
                          <p className="text-[10px] text-muted-foreground">Laisser vide pour utiliser l'image par défaut</p>
                        </div>
                        {catForm.imageUrl && (
                          <div className="relative w-16 h-16 rounded-xl border border-border overflow-hidden bg-secondary/30 flex-shrink-0 group">
                            <img src={catForm.imageUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                            <button
                              type="button"
                              onClick={() => setCatForm({ ...catForm, imageUrl: "" })}
                              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ordre d'affichage</label>
                      <input type="number" min={0} value={catForm.sortOrder} onChange={e => setCatForm({ ...catForm, sortOrder: parseInt(e.target.value) || 0 })} className={inputClass} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowCatForm(false)} className="flex-1 h-10 rounded-xl border border-border text-muted-foreground text-sm hover:bg-secondary transition-all">{t("cancel")}</button>
                      <button onClick={async () => {
                        const name = catForm.name.trim();
                        if (!name) { toast({ title: t("error"), description: "Le nom est obligatoire", variant: "destructive" }); return; }
                        try {
                          if (editingCat) {
                            await apiUpdateCategory(editingCat.id, { name, image_url: catForm.imageUrl.trim(), sort_order: catForm.sortOrder });
                            toast({ title: t("success"), description: "Catégorie mise à jour" });
                          } else {
                            await apiCreateCategory({ name, image_url: catForm.imageUrl.trim(), sort_order: catForm.sortOrder });
                            toast({ title: t("success"), description: "Catégorie créée" });
                          }
                          setShowCatForm(false);
                          reload();
                        } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
                      }} className="flex-1 h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-glow hover:shadow-lg transition-all">{t("save")}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "globalMessages" && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-premium p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/10">
                      <Megaphone className="h-5 w-5 text-primary" />
                    </span>
                    <div>
                      <h2 className="text-lg font-display font-bold text-foreground">Messages Globaux</h2>
                      <p className="text-xs text-muted-foreground">Diffusez un message à tous les revendeurs. Ils le verront à leur prochaine connexion jusqu'à ce qu'ils cliquent "J'ai lu".</p>
                    </div>
                  </div>
                  <button onClick={openCreateGM} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow">
                    <Plus className="h-4 w-4" /> Nouveau message
                  </button>
                </div>

                {globalMessages.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun message global. Créez-en un pour informer tous vos revendeurs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {globalMessages.map((m) => {
                      const total = Number(m.total_resellers || 0);
                      const read = Number(m.read_count || 0);
                      const pct = total > 0 ? Math.round((read / total) * 100) : 0;
                      return (
                        <div key={m.id} className="p-4 sm:p-5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1 flex gap-3">
                              {m.image_url && (
                                <img src={m.image_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-muted border border-border shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
                                  {m.is_active ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold">ACTIF</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">INACTIF</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{m.message}</p>
                                <p className="text-[11px] text-muted-foreground/70 mt-2">{new Date(m.created_at).toLocaleString("fr-FR")}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">Lu par</div>
                                <div className="text-sm font-bold text-foreground">{read} / {total}</div>
                                <div className="w-24 h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                                  <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <button onClick={() => openGMDetails(m)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                              <Eye className="h-3.5 w-3.5" /> Voir détails
                            </button>
                            <button onClick={() => openEditGM(m)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                              <Pencil className="h-3.5 w-3.5" /> Modifier
                            </button>
                            <button onClick={() => toggleGMActive(m)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors">
                              <Power className="h-3.5 w-3.5" /> {m.is_active ? "Désactiver" : "Activer"}
                            </button>
                            <button onClick={() => setDeleteGMId(m.id)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" /> Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "settings" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-premium p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/10">
                    <Coins className="h-5 w-5 text-primary" />
                  </span>
                  <div>
                    <h2 className="text-lg font-display font-bold text-foreground">Paramètres généraux</h2>
                    <p className="text-xs text-muted-foreground">Configuration de la plateforme</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-5 rounded-xl border border-border bg-secondary/30">
                    <label className="block text-sm font-semibold text-foreground mb-1">Devise de la plateforme</label>
                    <p className="text-xs text-muted-foreground">
                      Tous les soldes, prix et transactions sont exprimés directement en{" "}
                      <span className="text-primary font-bold">Dinar Tunisien (TND)</span>.
                      Aucune conversion à configurer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "docs" && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Header */}
              <div className="bg-card rounded-2xl border border-border shadow-premium p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/10">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </span>
                  <div>
                    <h2 className="text-xl font-display font-bold text-foreground">Documentation Administrateur</h2>
                    <p className="text-sm text-muted-foreground">Guide complet de toutes les fonctionnalités de TN SAT</p>
                  </div>
                </div>
              </div>

              {/* Vue d'ensemble */}
              <DocSection title="🏠 Vue d'ensemble — Comment fonctionne TN SAT" id="overview">
                <p>TN SAT est votre plateforme de vente de services IPTV et streaming. Voici comment tout s'organise :</p>
                <h4>Les 3 types d'utilisateurs</h4>
                <ul>
                  <li><strong>Vous (Administrateur)</strong> — Vous contrôlez tout : les produits, les comptes, les prix, les commandes, les réclamations.</li>
                  <li><strong>Clients</strong> — Ce sont vos acheteurs directs. Ils se connectent, voient vos produits, et achètent avec du solde TND.</li>
                  <li><strong>Revendeurs</strong> — Ce sont des partenaires qui achètent vos produits pour les revendre à leurs propres clients. Certains peuvent même créer des sous-revendeurs.</li>
                </ul>
                <h4>Le principe général</h4>
                <p>Tout fonctionne avec des <strong>TND</strong>. Vos clients et revendeurs vous paient en argent réel (virement, espèces, etc.), et en échange vous leur ajoutez du solde TND sur la plateforme. Avec ces TND, ils achètent vos produits.</p>
                <h4>Le cycle de vie d'une vente</h4>
                <ol>
                  <li>Vous créez un produit (service IPTV, compte Netflix, etc.) avec un prix en TND.</li>
                  <li>Un client/revendeur achète → son solde sont déduits automatiquement.</li>
                  <li>Soit la commande est livrée automatiquement (si vous avez des clés en stock), soit elle attend que vous remplissiez les identifiants manuellement.</li>
                  <li>Le client voit ses identifiants dans son tableau de bord et reçoit une notification.</li>
                </ol>
              </DocSection>

              {/* Dashboard / Stats */}
              <DocSection title="📊 Tableau de bord (Stats)" id="stats">
                <p>C'est votre vue d'ensemble rapide. Dès que vous vous connectez, vous voyez :</p>
                <ul>
                  <li><strong>Total Clients / Revendeurs</strong> — Le nombre de comptes créés.</li>
                  <li><strong>Total Commandes</strong> — Toutes les ventes effectuées.</li>
                  <li><strong>Revenu Total</strong> — La somme de tous le solde TND dépensés par vos clients et revendeurs.</li>
                  <li><strong>Commandes en attente</strong> — Les ventes qui attendent que vous fournissiez les identifiants. <em>Logique : seules les commandes "pending" sans clé automatique apparaissent ici.</em></li>
                  
                </ul>
                <p>Les <strong>graphiques</strong> montrent l'évolution de vos ventes dans le temps et vos produits les plus populaires.</p>
              </DocSection>

              {/* Services */}
              <DocSection title="📦 Services (Produits)" id="services">
                <p>Ce sont les produits que vous vendez. Chaque service a un prix, une catégorie, et éventuellement un stock.</p>
                <h4>Créer un service — étape par étape</h4>
                <ol>
                  <li>Cliquez sur <strong>+ Créer</strong> dans l'onglet Services.</li>
                  <li><strong>Nom</strong> — Ex: "IPTV 12 mois Premium".</li>
                  <li><strong>Description</strong> — Détails visibles par l'acheteur.</li>
                  <li><strong>Image</strong> — URL de l'image du produit (copier-coller un lien d'image).</li>
                  <li><strong>TNDs</strong> — Entrez le prix en TND directement.</li>
                  <li><strong>Stock</strong> — Laissez vide = stock illimité. Sinon entrez une quantité. <em>Logique : chaque achat réduit le stock de 1. Si le stock atteint 0, personne ne peut acheter.</em></li>
                  <li><strong>Catégorie</strong> — Classement du produit (IPTV, Netflix, etc.).</li>
                  
                  <li><strong>Spécifications</strong> — Paires clé/valeur (ex: Qualité → 4K, Durée → 12 mois).</li>
                  <li><strong>Caractéristiques</strong> — Points forts listés sous forme de puces (ex: "Compatible Smart TV").</li>
                </ol>
                <h4>Ce qui se passe en coulisse quand quelqu'un achète</h4>
                <ol>
                  <li>Le système vérifie que l'acheteur a assez de TND.</li>
                  <li>Le solde TND sont déduits immédiatement de son solde.</li>
                  <li>Le stock du service est réduit de 1 (si le stock est défini).</li>
                  <li>Si des <strong>clés produit</strong> sont disponibles pour ce service → une clé est assignée automatiquement et la commande est livrée instantanément.</li>
                  <li>Sinon → la commande passe en "En attente" et vous devez la traiter manuellement.</li>
                </ol>
                <h4>Modifier / Supprimer</h4>
                <p>Boutons ✏️ et 🗑️ sur chaque service. ⚠️ La suppression est définitive et supprime aussi les clés produit associées.</p>
              </DocSection>

              {/* Orders */}
              <DocSection title="📝 Commandes — Tout le cycle" id="orders">
                <p>Chaque achat crée une commande. Voici le cycle complet :</p>
                <h4>Les statuts et ce qu'ils signifient</h4>
                <ul>
                  <li><strong>🟡 En attente (pending)</strong> — L'acheteur a payé. Vous devez fournir les identifiants. C'est votre action principale au quotidien.</li>
                  <li><strong>🟢 Livrée (fulfilled)</strong> — Les identifiants ont été fournis (manuellement par vous OU automatiquement par une clé produit). L'acheteur peut les voir.</li>
                  <li><strong>🔴 Contestée (disputed)</strong> — L'acheteur a signalé un problème sur cette commande.</li>
                  <li><strong>✅ Résolue (resolved)</strong> — Vous avez traité la réclamation.</li>
                  <li><strong>⚫ Annulée (cancelled)</strong> — Commande annulée. <em>Logique : le solde TND sont automatiquement remboursés et le stock est restauré.</em></li>
                </ul>
                <h4>Remplir une commande manuellement</h4>
                <ol>
                  <li>Trouvez la commande en attente → cliquez <strong>Remplir</strong>.</li>
                  <li>Les champs à remplir dépendent du type de livraison du service (email, mot de passe, lien, code, etc.).</li>
                  <li>Validez → statut passe à "fulfilled", l'acheteur reçoit une notification.</li>
                </ol>
                <h4>Réinitialiser les identifiants</h4>
                <p>Si les identifiants ne fonctionnent plus : cliquez <strong>Reset</strong>. Les identifiants sont effacés et la commande repasse en "pending" pour que vous en fournissiez de nouveaux. <em>Logique : le solde TND ne sont pas re-déduits, c'est juste un remplacement d'identifiants.</em></p>
                <h4>Annuler une commande</h4>
                <p>Cliquez <strong>Annuler</strong>. <em>Logique automatique : le solde TND sont remboursés au client/revendeur + le stock est restauré de +1.</em></p>
              </DocSection>

              {/* Clés produit */}
              <DocSection title="🔑 Clés Produit — Livraison Automatique" id="product-keys">
                <p>C'est la fonctionnalité qui vous fait gagner le plus de temps ! Au lieu de remplir chaque commande manuellement, vous pré-chargez des clés/identifiants et le système les distribue tout seul.</p>
                <h4>Comment ça marche exactement</h4>
                <ol>
                  <li>Vous allez dans un service → cliquez <strong>🔑 Gérer les clés</strong>.</li>
                  <li>Vous ajoutez des clés (une par une ou en lot via import texte/CSV).</li>
                  <li>Chaque clé contient des paires titre/valeur (ex: "Username: abc123", "Password: xyz789").</li>
                  <li>Quand quelqu'un achète ce service → le système prend automatiquement la première clé disponible.</li>
                  <li>La clé est marquée "assignée" et la commande passe directement en "fulfilled".</li>
                  <li>L'acheteur voit ses identifiants immédiatement, sans aucune action de votre part.</li>
                </ol>
                <h4>⚠️ Important</h4>
                <ul>
                  <li>Si toutes les clés sont épuisées, la commande passe en "pending" (mode manuel). Pensez à recharger régulièrement.</li>
                  <li>L'onglet <strong>Historique des clés</strong> montre toutes les clés assignées avec l'acheteur et la date.</li>
                </ul>
                <h4>Import en lot</h4>
                <p>Collez vos clés (une par ligne). Si chaque clé a plusieurs champs (ex: username;password), séparez-les par un point-virgule et définissez les titres des colonnes.</p>
              </DocSection>

              {/* Resellers */}
              <DocSection title="🏪 Revendeurs" id="resellers">
                <p>Les revendeurs sont des partenaires commerciaux. Ils achètent vos produits et les revendent à leurs propres clients.</p>
                <h4>Créer un revendeur</h4>
                <ol>
                  <li>Cliquez <strong>+ Créer</strong> → nom, email, mot de passe, TND initiaux.</li>
                  <li><strong>Option "Peut ajouter des revendeurs"</strong> — Si activée, ce revendeur peut recruter ses propres sous-revendeurs. <em>Logique : il devient un "super revendeur" avec un mini-tableau de bord de gestion.</em></li>
                </ol>
                <h4>Ce que le revendeur voit dans son espace</h4>
                <ul>
                  <li>La liste de vos services avec les prix en TND.</li>
                  <li>Son solde de TND.</li>
                  <li>Ses commandes passées et leurs statuts.</li>
                  <li>La possibilité de recharger son solde via un code de recharge.</li>
                  <li>S'il a le droit : la gestion de ses sous-revendeurs.</li>
                </ul>
                <h4>Gérer le solde TND</h4>
                <p>Icône <strong>💰</strong> → Ajouter, Retirer ou Vider le solde TND. Chaque opération est enregistrée dans l'historique des transactions.</p>
                <h4>Activer / Désactiver</h4>
                <p>Bouton <strong>⚡</strong>. Un revendeur désactivé ne peut plus se connecter ni commander. Ses données restent intactes.</p>
              </DocSection>

              {/* Clients */}
              <DocSection title="👥 Clients" id="clients">
                <p>Vos acheteurs directs.</p>
                <h4>Créer un client</h4>
                <p>Cliquez <strong>+ Créer</strong> → nom, email (unique), mot de passe (min 6 caractères), TND initiaux.</p>
                <h4>Ce que le client voit dans son espace</h4>
                <ul>
                  <li>Les services disponibles, triés par catégorie.</li>
                  <li>Son solde de TND.</li>
                  <li>Ses commandes avec les identifiants (quand livrées).</li>
                  <li>Ses notifications.</li>
                  <li>La possibilité d'ouvrir une réclamation sur une commande livrée.</li>
                </ul>
                <h4>Gérer le solde TND</h4>
                <p>Icône <strong>💰</strong> → 3 options :</p>
                <ul>
                  <li><strong>Ajouter</strong> — Ajoute du solde TND (après que le client vous ait payé).</li>
                  <li><strong>Retirer</strong> — Retire du solde TND (ne descend jamais en dessous de 0).</li>
                  <li><strong>Vider</strong> — Remet le solde à 0 d'un coup.</li>
                </ul>
                <p><em>Logique : chaque mouvement de TND crée une ligne dans l'historique des transactions (visible par vous et par le client).</em></p>
                <h4>Actions en lot</h4>
                <p>Cochez plusieurs clients → Supprimer ou Activer/Désactiver en un clic. Export CSV disponible.</p>
              </DocSection>

              {/* Paiement en TND */}
              <DocSection title="💰 Paiements en TND — La logique financière" id="credits">
                <p>Le solde TND sont la monnaie interne de TN SAT. Voici tout ce qu'il faut savoir :</p>
                <h4>Fonctionnement</h4>
                <p>Le solde TND sont la seule unité de valeur sur TN SAT. Vous fixez le prix de chaque produit en TND. Le taux de conversion interne (modifiable dans Paramètres) sert uniquement au calcul interne.</p>
                <h4>Quand le solde TND bougent automatiquement</h4>
                <ul>
                  <li><strong>Achat</strong> → Le solde TND sont déduits du solde de l'acheteur.</li>
                  <li><strong>Annulation</strong> → Le solde TND sont remboursés automatiquement.</li>
                  <li><strong>Recharge par code</strong> → Le solde TND sont ajoutés au revendeur qui entre le code.</li>
                </ul>
                <h4>Quand VOUS bougez le solde TND manuellement</h4>
                <ul>
                  <li>Via le bouton 💰 sur un client ou revendeur (ajouter / retirer / vider).</li>
                </ul>
                <h4>Historique des transactions</h4>
                <p>Chaque mouvement est tracé avec : le type (ajout/débit/remboursement), le montant, le solde après opération, et la date. Les clients et revendeurs voient leur propre historique dans leur espace.</p>
              </DocSection>

              {/* Codes de recharge */}
              <DocSection title="🎫 Codes de Recharge" id="recharge">
                <p>Les codes de recharge permettent aux <strong>revendeurs</strong> de s'ajouter du solde TND de manière autonome, sans vous contacter.</p>
                <h4>Comment ça marche</h4>
                <ol>
                  <li>Vous générez des codes (ex: "TNSAT-A8K2M") avec un montant de TND prédéfini.</li>
                  <li>Vous donnez ces codes à vos revendeurs (en échange d'un paiement réel).</li>
                  <li>Le revendeur entre le code dans son espace → le solde TND sont ajoutés automatiquement à son solde.</li>
                </ol>
                <h4>⚠️ Règles importantes</h4>
                <ul>
                  <li>Un code ne peut être utilisé qu'<strong>une seule fois</strong>.</li>
                  <li>Après utilisation, le code est marqué comme "utilisé" avec la date et le revendeur.</li>
                  <li>Vous pouvez générer plusieurs codes d'un coup (en lot) avec un préfixe personnalisé.</li>
                </ul>
              </DocSection>

              {/* Historique & Transactions */}
              <DocSection title="📜 Historique & Transactions" id="historique">
                <h4>Onglet Historique</h4>
                <p>Toutes les commandes livrées, triées par date (les plus récentes en premier). Montre : service, acheteur, TND utilisés, dates.</p>
                <h4>Onglet Transactions</h4>
                <p>Vue financière : mêmes données mais avec les montants convertis en TND. Exportable en CSV pour votre comptabilité.</p>
                <h4>Onglet Reset Codes</h4>
                <p>Liste des commandes livrées avec un bouton <strong>Reset</strong> rapide pour réinitialiser les identifiants si besoin.</p>
              </DocSection>

              {/* Paramètres */}
              <DocSection title="⚙️ Paramètres" id="settings">
                <h4>Taux de conversion TND → TNDs</h4>
                <p>Ce chiffre détermine combien de TND vaut 1 TND. Actuellement : <strong>1 TND = {CREDITS_PER_TND} TND</strong>.</p>
                <h4>Comment modifier</h4>
                <ol>
                  <li>Allez dans <strong>Paramètres</strong> (icône 💰 dans le menu).</li>
                  <li>Changez la valeur → cliquez <strong>Enregistrer</strong>.</li>
                </ol>
                <h4>⚠️ Impact du changement</h4>
                <ul>
                  <li>Les <strong>prix des services</strong> changent immédiatement (prix TND × nouveau taux = nouveau prix en TND).</li>
                  <li>Les <strong>TND déjà attribués</strong> aux comptes ne changent pas.</li>
                  <li><em>Exemple : si vous passez de 10 à 20 TND/TND, un service à 5 TND passe de 50 à 100 TND. Mais un client qui avait 50 TND les garde — il pourra juste acheter moins de choses.</em></li>
                </ul>
                <p><strong>Conseil :</strong> Évitez de changer souvent. Prévenez vos revendeurs avant tout changement.</p>
              </DocSection>

              {/* Notifications */}
              <DocSection title="🔔 Notifications" id="notifications">
                <p>Le système notifie automatiquement les utilisateurs :</p>
                <ul>
                  <li><strong>Commande livrée</strong> → Le client/revendeur est notifié que ses identifiants sont prêts.</li>
                  <li><strong>Réclamation mise à jour</strong> → Notification quand vous répondez à une réclamation.</li>
                  <li><strong>TND ajoutés</strong> → Notification quand vous ajoutez du solde TND à un compte.</li>
                </ul>
                <p>Les notifications apparaissent sous forme de 🔔 dans le tableau de bord de chaque utilisateur.</p>
              </DocSection>

              {/* Connexion */}
              <DocSection title="🔐 Connexion & Sécurité" id="login">
                <h4>Trois types de comptes, une seule page de connexion</h4>
                <ul>
                  <li><strong>Admin</strong> — Votre compte. Redirige vers ce tableau de bord.</li>
                  <li><strong>Client</strong> — Redirige vers l'espace client (boutique + commandes).</li>
                  <li><strong>Revendeur</strong> — Redirige vers l'espace revendeur (boutique + gestion).</li>
                </ul>
                <p><em>Logique : le système identifie automatiquement le type de compte (admin, client ou revendeur) et redirige vers le bon espace.</em></p>
                <p>Un compte <strong>désactivé</strong> reçoit un message d'erreur et ne peut pas se connecter.</p>
              </DocSection>

              {/* Site public */}
              <DocSection title="🌐 Site Public" id="landing">
                <p>La page d'accueil visible par tous les visiteurs (avant connexion). Elle contient :</p>
                <ul>
                  <li>Présentation de TN SAT avec bouton WhatsApp pour vous contacter.</li>
                  <li>Comment ça marche / Pourquoi nous choisir / Statistiques.</li>
                  <li>Le site est <strong>trilingue</strong> : Français, Anglais, Arabe (sélecteur dans la barre de navigation).</li>
                </ul>
              </DocSection>

              {/* Conseils */}
              <DocSection title="💡 Conseils & Astuces" id="tips">
                <h4>🚀 Gagner du temps</h4>
                <ul>
                  <li><strong>Clés produit</strong> — Pré-chargez des clés pour la livraison automatique. Zéro intervention manuelle !</li>
                  <li><strong>Codes de recharge</strong> — Générez-les en lot. Les revendeurs se rechargent tout seuls.</li>
                  <li><strong>Actions en lot</strong> — Sélectionnez plusieurs comptes pour agir d'un coup.</li>
                  <li><strong>Export CSV</strong> — Exportez tout pour votre comptabilité.</li>
                </ul>
                <h4>🛡️ Bonnes pratiques</h4>
                <ul>
                  <li>Vérifiez les <strong>réclamations ouvertes</strong> chaque jour.</li>
                  <li>Surveillez le <strong>stock</strong> et les <strong>clés produit</strong> pour éviter les ruptures.</li>
                  <li><strong>Désactivez</strong> plutôt que supprimer les comptes problématiques (les données sont conservées).</li>
                  <li>Ne changez pas le taux de conversion sans prévenir vos revendeurs.</li>
                </ul>
              </DocSection>

            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {/* Note editor (Historique code & Reset Codes) — admin fills the note */}
      <AlertDialog open={!!noteTarget} onOpenChange={(open) => { if (!noteSaving && !open) setNoteTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Note admin
              {noteTarget?.label && <span className="text-muted-foreground font-normal text-sm">— {noteTarget.label}</span>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette note sera visible par le revendeur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value.slice(0, 2000))}
            rows={5}
            placeholder="Note..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
          <div className="text-[11px] text-muted-foreground text-end">{noteText.length}/2000</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={noteSaving}>{t("cancel") || "Annuler"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); saveNote(); }}
              disabled={noteSaving}
              className="gradient-primary text-primary-foreground"
            >
              {noteSaving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CheckCircle className="h-4 w-4 me-2" />}
              {t("save") || "Enregistrer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!deleting) setDeleteTarget(open ? deleteTarget : null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle><AlertDialogDescription></AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => {
              if (deleteTarget?.type === "client") confirmDeleteClient(deleteTarget.id);
              else if (deleteTarget?.type === "service") confirmDeleteService(deleteTarget.id);
              else if (deleteTarget?.type === "deliveryType") confirmDeleteDT(deleteTarget.id);
              else if (deleteTarget?.type === "reseller") confirmDeleteReseller(deleteTarget.id);
              else if (deleteTarget?.type === "category") { setDeleting(true); apiDeleteCategory(deleteTarget.id).then(() => { setDeleteTarget(null); toast({ title: t("success"), description: "Catégorie supprimée" }); reload(); }).catch((e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" })).finally(() => setDeleting(false)); }
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage points for client */}
      <AlertDialog open={!!pointsTarget} onOpenChange={() => { setPointsTarget(null); setPointsAction("add"); setPointsAmount(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gérer solde — {pointsTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Solde actuel : <span className="font-bold text-primary">{pointsTarget?.credits?.toLocaleString()} TND</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 mb-3">
            {(["add", "remove", "empty"] as const).map(a => (
              <button
                key={a}
                onClick={() => setPointsAction(a)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  pointsAction === a
                    ? a === "empty" ? "bg-destructive text-destructive-foreground border-destructive" : "gradient-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:border-foreground/20"
                }`}
              >
                {a === "add" ? t("addPoints") : a === "remove" ? t("removePoints") : t("emptyPoints")}
              </button>
            ))}
          </div>
          {pointsAction === "empty" ? (
            <p className="text-sm text-destructive">{t("confirmEmptyPoints")}</p>
          ) : (
            <div className="space-y-3">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder={pointsAction === "add" ? "Montant TND à ajouter" : "Montant TND à retirer"}
                className={inputClass}
              />
              <input
                placeholder="Note (optionnel)"
                value={resellerPointsNote}
                onChange={(e) => setResellerPointsNote(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePointsAction}>{t("save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage reseller TND */}
      <AlertDialog open={!!resellerPointsTarget} onOpenChange={() => setResellerPointsTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gérer solde — {resellerPointsTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription>{resellerPointsTarget?.email} — Solde actuel : <span className="font-bold text-primary">{resellerPointsTarget?.credits?.toLocaleString()} TND</span></AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["add", "remove", "empty"] as const).map(a => (
                <button key={a} onClick={() => setResellerPointsAction(a)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${resellerPointsAction === a ? (a === "add" ? "bg-primary text-primary-foreground border-primary" : a === "remove" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-accent text-accent-foreground border-accent") : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"}`}>
                  {a === "add" ? "➕ Ajouter" : a === "remove" ? "➖ Retirer" : "🗑️ Vider"}
                </button>
              ))}
            </div>
            {resellerPointsAction !== "empty" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">
                  {resellerPointsAction === "add" ? "TNDs à ajouter" : "TNDs à retirer"}
                </label>
                <input type="number" min={0.01} step={0.01} placeholder="Ex: 50" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} className={inputClass} />
              </div>
            )}
            {resellerPointsAction === "empty" && (
              <p className="text-sm text-destructive font-medium p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                ⚠️ Cela va vider entièrement le solde de {resellerPointsTarget?.credits?.toLocaleString()} TND.
              </p>
            )}
            {resellerPointsAction === "add" && (
              <>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">{t("note")}</label>
                  <input placeholder={t("note")} value={resellerPointsNote} onChange={(e) => setResellerPointsNote(e.target.value)} className={inputClass} />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" checked={resellerPointsPaid} onChange={(e) => setResellerPointsPaid(e.target.checked)} className="rounded" />
                  {t("paidByReseller")}
                </label>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResellerCreditsAction}
              className={resellerPointsAction === "empty" || resellerPointsAction === "remove" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary text-primary-foreground"}>
              {resellerPointsAction === "add" ? t("save") : resellerPointsAction === "remove" ? "Retirer" : "Vider le solde"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reseller transaction history */}
      <AlertDialog open={!!txHistoryReseller} onOpenChange={(o) => { if (!o) { setTxHistoryReseller(null); setTxHistoryRows([]); } }}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />{t("transactionHistory")} — {txHistoryReseller?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              {txHistoryReseller?.email} — Solde : <span className="font-bold text-primary">{txHistoryReseller?.credits?.toLocaleString()} TND</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {txHistoryLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : txHistoryRows.length === 0 ? (
              <div className="text-center py-10"><CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{t("noTransactions")}</p></div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/30">
                    <th className="py-2 px-3 font-medium text-muted-foreground text-start text-xs">{t("date")}</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground text-start text-xs">Type</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground text-end text-xs">Montant</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground text-end text-xs">Solde</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground text-start text-xs">Description</th>
                    <th className="py-2 px-3 font-medium text-muted-foreground text-center text-xs">{t("paidByReseller")}</th>
                  </tr></thead>
                  <tbody>
                    {txHistoryRows.map(tx => {
                      const isCredit = tx.type === "credit";
                      const paid = !!tx.is_paid;
                      return (
                        <tr key={tx.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="py-2 px-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isCredit ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              {isCredit ? "+ Ajout" : "− Débit"}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-end font-semibold ${isCredit ? "text-success" : "text-destructive"}`}>
                            {isCredit ? "+" : "−"}{tx.amount.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-end text-foreground font-medium">{tx.balance_after.toLocaleString()}</td>
                          <td className="py-2 px-3 text-muted-foreground text-xs max-w-[260px]">{tx.description || "—"}</td>
                          <td className="py-2 px-3 text-center">
                            {isCredit ? (
                              <button
                                onClick={() => toggleTxPaid(tx)}
                                disabled={txPaidUpdating === tx.id}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50 ${paid ? "bg-success/10 text-success hover:bg-success/20" : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"}`}
                                title={paid ? "Marquer impayé" : "Marquer payé"}
                              >
                                {txPaidUpdating === tx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : (paid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />)}
                                {paid ? "Payé" : "Impayé"}
                              </button>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fill Credentials Dialog */}
      <AlertDialog open={!!fillCredOrder} onOpenChange={() => setFillCredOrder(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("fillCredentials")} — {fillCredOrder?.service_name || getServiceName(fillCredOrder?.service_id || "")}</AlertDialogTitle>
            <AlertDialogDescription>{t("fillCredentialsDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          {fillCredOrder?.note && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 mb-1">
              <p className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-1">📝 {t("note")} du client</p>
              <p className="text-sm text-foreground font-medium">{fillCredOrder.note}</p>
            </div>
          )}
          {(() => {
            if (!fillCredOrder) return null;
            const dt = deliveryTypes.find(d => d.id === fillCredOrder.delivery_type_id);
            if (!dt) return <p className="text-sm text-muted-foreground">{t("noDeliveryTypeLinked")}</p>;
            return (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("deliveryType")}: <span className="font-semibold text-foreground">{dt.name}</span></p>
                {dt.fields.map(f => (
                  <div key={f.key}>
                    <label className="text-sm font-medium text-foreground mb-1 block">{f.label} {f.required && <span className="text-destructive">*</span>}</label>
                    {f.type === "textarea" ? (
                      <textarea value={credForm[f.key] || ""} onChange={(e) => setCredForm({ ...credForm, [f.key]: e.target.value })} className={`${inputClass} h-20 py-2 resize-none`} placeholder={f.label} />
                    ) : (
                      <input type={f.type === "date" ? "date" : f.type === "url" ? "url" : "text"} value={credForm[f.key] || ""} onChange={(e) => setCredForm({ ...credForm, [f.key]: e.target.value })} className={inputClass} placeholder={f.label} />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
          {fillCredOrder && (fillCredOrder.status === "pending" || fillCredOrder.status === "disputed") && keyCounts[fillCredOrder.service_id]?.available > 0 && (
            <div className="border border-primary/20 rounded-xl p-3 bg-primary/5">
              <p className="text-xs text-primary font-medium mb-2">🔑 {keyCounts[fillCredOrder.service_id].available} clé(s) disponible(s) en stock</p>
              <button onClick={() => autoAssignKey(fillCredOrder)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-xs font-medium shadow-glow">
                <Zap className="h-3.5 w-3.5" /> Assigner automatiquement
              </button>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={saveFillCredentials}>{t("save")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Credentials Confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => { if (!deleting) setResetTarget(open ? resetTarget : null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetCredentials")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resetCredentialsConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleResetCredentials} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("resetCredentials")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Product Form Dialog */}
      {showRPForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRPForm(false)}>
          <div className="bg-card rounded-2xl border border-border shadow-premium w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground text-lg">
                {editingRP ? (t("editResetProduct") || "Edit reset product") : (t("addResetProduct") || "Add reset product")}
              </h3>
              <button onClick={() => setShowRPForm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-all"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("name")}</label>
                <input className={inputClass} value={rpForm.name} onChange={e => setRpForm({ ...rpForm, name: e.target.value })} placeholder="IPTV Active Code, Xtream IPTV, M3U..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("description")}</label>
                <textarea className={inputClass + " min-h-[60px] py-2"} value={rpForm.description} onChange={e => setRpForm({ ...rpForm, description: e.target.value })} />
              </div>

              {/* Image */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Image</label>
                <div className="flex gap-2 items-center">
                  {rpForm.imageUrl && <img src={rpForm.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted" />}
                  <input className={inputClass} value={maskUrl(rpForm.imageUrl)} onChange={e => setRpForm({ ...rpForm, imageUrl: unmaskUrl(e.target.value) })} placeholder="https://..." />
                  <label className="inline-flex items-center gap-1.5 px-3 h-11 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium cursor-pointer transition-all whitespace-nowrap">
                    {uploadingRPImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploadingRPImage(true);
                      try {
                        const url = await apiUploadImage(file);
                        setRpForm(f => ({ ...f, imageUrl: url }));
                      } catch (err: any) {
                        toast({ title: t("error"), description: err.message, variant: "destructive" });
                      } finally { setUploadingRPImage(false); e.target.value = ""; }
                    }} />
                  </label>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowRPForm(false)} className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-all">{t("cancel")}</button>
              <button onClick={saveResetProduct} className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
                {editingRP ? t("save") : (t("create") || "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reset Product confirmation */}
      <AlertDialog open={!!deleteRPId} onOpenChange={(open) => { if (!deleting && !open) setDeleteRPId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDelete") || "Are you sure?"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={confirmDeleteResetProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bulkDeleteTarget} onOpenChange={(open) => { if (!deleting) setBulkDeleteTarget(open ? bulkDeleteTarget : null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression en lot</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {bulkDeleteTarget === "clients" ? selectedClients.size : selectedResellers.size} {bulkDeleteTarget === "clients" ? "client(s)" : "revendeur(s)"} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => { if (bulkDeleteTarget === "clients") bulkDeleteClients(); else if (bulkDeleteTarget === "resellers") bulkDeleteResellers(); setBulkDeleteTarget(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin me-1" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Toggle Confirmation */}
      <AlertDialog open={!!bulkToggleTarget} onOpenChange={(open) => { if (!open) setBulkToggleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'action en lot</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir activer/désactiver {bulkToggleTarget === "clients" ? selectedClients.size : selectedResellers.size} {bulkToggleTarget === "clients" ? "client(s)" : "revendeur(s)"} ? Les comptes actifs seront désactivés et vice versa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (bulkToggleTarget === "clients") bulkToggleClients(); else if (bulkToggleTarget === "resellers") bulkToggleResellers(); setBulkToggleTarget(null); }}
              className="bg-yellow-600 text-white hover:bg-yellow-700"
            >
              <Power className="h-4 w-4 me-1" />
              Activer/Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Key Management Dialog */}
      <AlertDialog open={!!keysServiceId} onOpenChange={() => setKeysServiceId(null)}>
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>🔑 Gestion des clés — {keysServiceName}</AlertDialogTitle>
            <AlertDialogDescription>Ajoutez des clés/codes avec des paires titre-valeur. Elles seront assignées automatiquement aux commandes.</AlertDialogDescription>
          </AlertDialogHeader>

          {/* Add new key */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ajouter une clé</p>
            {newKeyFields.map((field, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input placeholder="Titre (ex: Username, Code, Lien)" value={field.title} onChange={(e) => {
                  const f = [...newKeyFields]; f[idx] = { ...f[idx], title: e.target.value }; setNewKeyFields(f);
                }} className={`${inputClass} flex-1`} />
                <input placeholder="Valeur" value={field.value} onChange={(e) => {
                  const f = [...newKeyFields]; f[idx] = { ...f[idx], value: e.target.value }; setNewKeyFields(f);
                }} className={`${inputClass} flex-1`} />
                {newKeyFields.length > 1 && (
                  <button onClick={() => setNewKeyFields(newKeyFields.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setNewKeyFields([...newKeyFields, { title: "", value: "" }])} className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"><Plus className="h-3 w-3" /> Ajouter un champ</button>
            </div>
            <button onClick={addProductKey} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-xs font-medium shadow-glow"><Plus className="h-3.5 w-3.5" /> Ajouter cette clé</button>
          </div>

          {/* Bulk import */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📥 Import en masse</p>
            <p className="text-[11px] text-muted-foreground">Collez ou importez un fichier CSV/texte. Chaque ligne = une clé. Utilisez le séparateur pour plusieurs champs par clé.</p>
            
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Titres des champs (séparés par le séparateur)</label>
                <input value={bulkTitles} onChange={(e) => setBulkTitles(e.target.value)} placeholder="Code" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Séparateur</label>
                <select value={bulkSeparator} onChange={(e) => setBulkSeparator(e.target.value)} className={inputClass}>
                  <option value=";">Point-virgule ( ; )</option>
                  <option value=",">Virgule ( , )</option>
                  <option value="|">Pipe ( | )</option>
                  <option value={"\t"}>Tabulation</option>
                </select>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground bg-secondary/50 rounded-lg p-2.5 space-y-1">
              <p className="font-semibold">Exemples :</p>
              <p>• 1 champ — Titres: <code className="text-primary bg-primary/10 px-1 rounded">Code</code></p>
              <p className="ps-3 font-mono text-[9px]">ABC123<br/>DEF456<br/>GHI789</p>
              <p>• 2 champs — Titres: <code className="text-primary bg-primary/10 px-1 rounded">Username;Password</code></p>
              <p className="ps-3 font-mono text-[9px]">user1;pass1<br/>user2;pass2</p>
            </div>

            <textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder={"Collez vos clés ici, une par ligne...\nExemple:\nuser1;pass1\nuser2;pass2"}
              className="w-full h-28 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm cursor-pointer hover:bg-secondary transition-all">
                <Upload className="h-3.5 w-3.5" />
                <span className="text-xs">Importer fichier CSV/TXT</span>
                <input type="file" accept=".csv,.txt,.text" className="hidden" onChange={handleBulkFileUpload} />
              </label>
              {bulkImportText && (
                <span className="text-[10px] text-muted-foreground">
                  {bulkImportText.split("\n").filter(l => l.trim()).length} ligne(s) détectée(s)
                </span>
              )}
            </div>

            <button
              onClick={bulkImportKeys}
              disabled={importingBulk || !bulkImportText.trim()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg gradient-primary text-primary-foreground text-xs font-medium shadow-glow disabled:opacity-50"
            >
              {importingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {importingBulk ? "Import en cours..." : "Importer toutes les clés"}
            </button>
          </div>

          {/* Keys list */}
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Clés en stock ({productKeys.filter(k => k.status === "available").length} disponibles, {productKeys.filter(k => k.status === "assigned").length} assignées)
              </p>
              {productKeys.length > 0 && (
                <button onClick={() => {
                  const allTitles = [...new Set(productKeys.flatMap(pk => pk.fields.map(f => f.title)))];
                  const header = ["Statut", ...allTitles].join(";");
                  const rows = productKeys.map(pk => {
                    const vals = allTitles.map(t => {
                      const f = pk.fields.find(f => f.title === t);
                      return (f?.value || "").replace(/;/g, ",");
                    });
                    return [pk.status === "available" ? "Disponible" : "Assignée", ...vals].join(";");
                  });
                  const csv = "\uFEFF" + [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `cles_${keysServiceName.replace(/\s+/g, "_")}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-secondary transition-colors">
                  <Download className="h-3.5 w-3.5" /> Exporter CSV
                </button>
              )}
            </div>
            {loadingKeys ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : productKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 italic py-4 text-center">Aucune clé ajoutée pour ce produit</p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {productKeys.map(pk => (
                  <div key={pk.id} className={`border rounded-xl p-3 ${pk.status === "assigned" ? "border-accent/20 bg-accent/5" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        {pk.fields.map((f, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="font-semibold text-foreground min-w-[80px]">{f.title}:</span>
                            <span className="text-muted-foreground break-all">{f.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pk.status === "available" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                          {pk.status === "available" ? "Disponible" : "Assignée"}
                        </span>
                        <button onClick={() => removeProductKey(pk.id)} title={pk.status === "assigned" ? "Supprimer (assignée)" : "Supprimer"} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Responses Dialog */}
      <AlertDialog open={!!viewingResponseOrder} onOpenChange={(open) => { if (!open) { setViewingResponseOrder(null); setViewingOrderResponses([]); } }}>
        <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("viewResponses")} — {viewingResponseOrder?.service_name}</AlertDialogTitle>
            <AlertDialogDescription>
              {viewingResponseOrder?.reseller_name || viewingResponseOrder?.client_name || ""}
              {viewingResponseOrder?.credits_used ? ` • ${viewingResponseOrder.credits_used} TND` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Order credentials */}
          {viewingResponseOrder?.credentials && Object.keys(viewingResponseOrder.credentials).length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-semibold text-success uppercase tracking-wider">{t("credentials")}</h4>
              {Object.entries(viewingResponseOrder.credentials).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-foreground select-all">{v}</span>
                </div>
              ))}
            </div>
          )}

          {loadingResponses ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : viewingOrderResponses.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("noResponsesYet")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {viewingOrderResponses.map(r => (
                <div key={r.id} className="bg-accent/5 border border-accent/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-accent">{r.reseller_name || r.client_name || "Admin"}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                       <button onClick={() => { setEditingResponseId(r.id); setEditingResponseText(r.response_text); }} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title={t("edit")}><Pencil className="h-3 w-3" /></button>
                       <button onClick={async () => {
                         if (!confirm(t("confirmDelete") || "Delete this response?")) return;
                         try {
                           await apiDeleteOrderResponse(r.id);
                           setViewingOrderResponses(prev => prev.filter(x => x.id !== r.id));
                           if (viewingResponseOrder) setOrderAdminResponseCounts(prev => ({ ...prev, [viewingResponseOrder.id]: Math.max(0, (prev[viewingResponseOrder.id] || 1) - 1) }));
                           toast({ title: t("success") });
                         } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
                       }} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title={t("delete")}><Trash2 className="h-3 w-3" /></button>
                     </div>
                   </div>
                   <p className="text-sm text-foreground whitespace-pre-wrap">{r.response_text}</p>
                </div>
              ))}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Response Note Dialog */}
      <AlertDialog open={!!editingResponseId} onOpenChange={(open) => { if (!open && !savingResponseEdit) { setEditingResponseId(null); setEditingResponseText(""); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("edit")} — Response</AlertDialogTitle>
            <AlertDialogDescription>
              Update the note sent with this approved order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Note</label>
            <textarea
              value={editingResponseText}
              onChange={(e) => setEditingResponseText(e.target.value)}
              autoFocus
              rows={6}
              className="w-full min-h-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="Write your response..."
            />
            <p className="text-[11px] text-muted-foreground">{editingResponseText.length} characters</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingResponseEdit}>{t("cancel")}</AlertDialogCancel>
            <button
              disabled={savingResponseEdit || !editingResponseText.trim()}
              onClick={async () => {
                if (!editingResponseId) return;
                setSavingResponseEdit(true);
                try {
                  const id = editingResponseId;
                  const text = editingResponseText.trim();
                  await apiUpdateOrderResponse(id, text);
                  setViewingOrderResponses(prev => prev.map(x => x.id === id ? { ...x, response_text: text } : x));
                  setEditingResponseId(null); setEditingResponseText("");
                  toast({ title: t("success") });
                } catch (e: any) { toast({ title: t("error"), description: e.message, variant: "destructive" }); }
                finally { setSavingResponseEdit(false); }
              }}
              className="h-10 px-4 rounded-lg text-sm font-medium gradient-primary text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {savingResponseEdit && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("save")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-reseller pricing manager */}
      <AlertDialog open={!!pricingService} onOpenChange={(open) => { if (!open) { setPricingService(null); setPricingOverrides([]); setPricingDrafts({}); } }}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              {t("pricingFor")} — {pricingService?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("pricePerResellerHint")}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-secondary/40 border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">{t("defaultPrice")}: </span>
              <span className="font-bold text-foreground">{pricingService?.price_credits} TND</span>
              <span className="text-xs text-muted-foreground ms-3">
                {pricingOverrides.length} {t("customPriceCount")}
              </span>
            </div>
            <button
              onClick={resetAllPricesForService}
              disabled={pricingResetting || pricingOverrides.length === 0}
              className="h-9 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-1.5"
              title={t("sameForAllResellers")}
            >
              {pricingResetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {t("resetAllToDefault")}
            </button>
          </div>

          {pricingLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-1.5 mt-3 max-h-[50vh] overflow-y-auto">
              {resellers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t("noResellers") || "—"}</p>
              ) : resellers.map(r => {
                const ov = pricingOverrides.find(p => p.reseller_id === r.id);
                const draft = pricingDrafts[r.id];
                const draftVal = draft !== undefined ? draft : (ov ? String(ov.price_credits) : "");
                return (
                  <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
                    <div className="col-span-5 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                    </div>
                    <div className="col-span-4 flex items-center gap-2">
                      <input
                        type="number" step="0.01" min="0"
                        value={draftVal}
                        onChange={(e) => setPricingDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder={String(pricingService?.price_credits ?? "")}
                        className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="text-xs text-muted-foreground">TND</span>
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-1.5">
                      {ov && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold">{t("customPrice")}</span>}
                      <button
                        onClick={() => savePricingForReseller(r.id)}
                        disabled={pricingSavingId === r.id}
                        className="h-8 px-3 rounded-lg gradient-primary text-primary-foreground text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {pricingSavingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("save")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-service visibility manager */}
      <AlertDialog open={!!visibilityService} onOpenChange={(open) => { if (!open && !visibilitySaving) { setVisibilityService(null); } }}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              {t("visibilityFor")} — {visibilityService?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("visibilityHint")}</AlertDialogDescription>
          </AlertDialogHeader>

          {visibilityLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {([
                  { v: "all" as const, label: t("visibilityAll"), Icon: Eye },
                  { v: "whitelist" as const, label: t("visibilityWhitelist"), Icon: Eye },
                  { v: "blacklist" as const, label: t("visibilityBlacklist"), Icon: EyeOff },
                ]).map(({ v, label, Icon }) => (
                  <label key={v} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${visibilityMode === v ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                    <input type="radio" name="vmode" checked={visibilityMode === v} onChange={() => setVisibilityMode(v)} className="accent-primary" />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>

              {visibilityMode !== "all" && (
                <div className="border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("selectResellers")} ({visibilitySelected.size})</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setVisibilitySelected(new Set(resellers.map(r => r.id)))} className="text-xs h-7 px-2 rounded-md border border-border hover:bg-secondary">{t("selectAll")}</button>
                      <button type="button" onClick={() => setVisibilitySelected(new Set())} className="text-xs h-7 px-2 rounded-md border border-border hover:bg-secondary">{t("deselectAll")}</button>
                    </div>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto space-y-1">
                    {resellers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">{t("noResellers") || "—"}</p>
                    ) : resellers.map(r => {
                      const checked = visibilitySelected.has(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleVisibilityReseller(r.id)} className="accent-primary h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={visibilitySaving}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); saveVisibility(); }} disabled={visibilitySaving || visibilityLoading}>
              {visibilitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-category visibility manager */}
      <AlertDialog open={!!visibilityCategory} onOpenChange={(open) => { if (!open && !catVisibilitySaving) { setVisibilityCategory(null); } }}>
        <AlertDialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              {t("visibilityFor")} — {visibilityCategory?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("visibilityHint")}</AlertDialogDescription>
          </AlertDialogHeader>

          {catVisibilityLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {([
                  { v: "all" as const, label: t("visibilityAll"), Icon: Eye },
                  { v: "whitelist" as const, label: t("visibilityWhitelist"), Icon: Eye },
                  { v: "blacklist" as const, label: t("visibilityBlacklist"), Icon: EyeOff },
                ]).map(({ v, label, Icon }) => (
                  <label key={v} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${catVisibilityMode === v ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                    <input type="radio" name="catvmode" checked={catVisibilityMode === v} onChange={() => setCatVisibilityMode(v)} className="accent-primary" />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>

              {catVisibilityMode !== "all" && (
                <div className="border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("selectResellers")} ({catVisibilitySelected.size})</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setCatVisibilitySelected(new Set(resellers.map(r => r.id)))} className="text-xs h-7 px-2 rounded-md border border-border hover:bg-secondary">{t("selectAll")}</button>
                      <button type="button" onClick={() => setCatVisibilitySelected(new Set())} className="text-xs h-7 px-2 rounded-md border border-border hover:bg-secondary">{t("deselectAll")}</button>
                    </div>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto space-y-1">
                    {resellers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">{t("noResellers") || "—"}</p>
                    ) : resellers.map(r => {
                      const checked = catVisibilitySelected.has(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleCatVisibilityReseller(r.id)} className="accent-primary h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={catVisibilitySaving}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); saveCategoryVisibility(); }} disabled={catVisibilitySaving || catVisibilityLoading}>
              {catVisibilitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetApproveTarget} onOpenChange={(open) => { if (!open && processingResetId === null) { setResetApproveTarget(null); setResetApproveText(""); } }}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetApproveAction === "approve" ? t("approve") : t("cancel")} — {resetApproveTarget?.serviceName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetApproveTarget?.buyerName}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Original request from the reseller / client */}
          {resetApproveTarget?.displayMsg && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                {t("resetRequests") || "Demande de reset"}
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{resetApproveTarget.displayMsg}</p>
            </div>
          )}

          {/* Admin response textarea */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("yourResponse") || "Votre réponse"}
            </label>
            <textarea
              value={resetApproveText}
              onChange={(e) => setResetApproveText(e.target.value)}
              placeholder={resetApproveAction === "approve"
                ? "Indiquez les nouveaux identifiants ou un message pour le revendeur..."
                : "Expliquez la raison de l'annulation (optionnel)..."}
              className="w-full min-h-[100px] rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingResetId !== null}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={processingResetId !== null || (resetApproveAction === "approve" && !resetApproveText.trim())}
              onClick={async (e) => {
                e.preventDefault();
                if (!resetApproveTarget) return;
                const target = resetApproveTarget;
                const action = resetApproveAction;
                const text = resetApproveText;
                await handleResetRequest(target.notif, action, text);
                setResetApproveTarget(null);
                setResetApproveText("");
              }}
              className={resetApproveAction === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {processingResetId !== null
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : (resetApproveAction === "approve" ? <CheckCircle className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />)}
              {resetApproveAction === "approve" ? t("approve") : t("cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Approve Order Dialog */}
      <AlertDialog open={!!approvingOrder} onOpenChange={(open) => { if (!open) { setApprovingOrder(null); setApproveText(""); setApproveExistingResponses([]); } }}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveOrder")} — {approvingOrder?.service_name}</AlertDialogTitle>
            <AlertDialogDescription>
              {approvingOrder?.reseller_name || approvingOrder?.client_name || ""}
              {approvingOrder?.credits_used ? ` • ${approvingOrder.credits_used} TND` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Order credentials */}
          {approvingOrder?.credentials && Object.keys(approvingOrder.credentials).length > 0 && (
            <div className="bg-success/5 border border-success/20 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-semibold text-success uppercase tracking-wider">{t("credentials")}</h4>
              {Object.entries(approvingOrder.credentials).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-foreground select-all">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Previous responses */}
          {approveExistingResponses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("previousResponses") || "Réponses précédentes"}</h4>
              {approveExistingResponses.map(r => (
                <div key={r.id} className="bg-accent/5 border border-accent/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-accent">{r.reseller_name || r.client_name || "Admin"}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{r.response_text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Admin response textarea */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("yourResponse")}</label>
            <textarea
              value={approveText}
              onChange={(e) => setApproveText(e.target.value)}
              placeholder={t("responsePlaceholder") || "Entrez vos informations ici..."}
              className="w-full min-h-[100px] rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!approveText.trim() || sendingApproval}
              onClick={async (e) => {
                e.preventDefault();
                if (!approvingOrder || !approveText.trim()) return;
                setSendingApproval(true);
                try {
                  await apiCreateOrderResponse({ order_id: approvingOrder.id, is_admin: true, response_text: approveText.trim() });
                  // Mark order as fulfilled (livré) if not already
                  if (approvingOrder.status === "pending" || approvingOrder.status === "disputed") {
                    try {
                      const existingCreds = approvingOrder.credentials && Object.keys(approvingOrder.credentials).length > 0
                        ? approvingOrder.credentials
                        : { response: approveText.trim() };
                      await apiFulfillOrder(approvingOrder.id, existingCreds);
                    } catch (err: any) {
                      toast({ title: t("error"), description: err.message, variant: "destructive" });
                    }
                  }
                  toast({ title: t("success"), description: t("responseSent") || "Réponse envoyée !" });
                  // Update response count for this order
                  setOrderResponseCounts(prev => ({ ...prev, [approvingOrder.id]: (prev[approvingOrder.id] || 0) + 1 }));
                  setOrderAdminResponseCounts(prev => ({ ...prev, [approvingOrder.id]: (prev[approvingOrder.id] || 0) + 1 }));
                  setApprovingOrder(null); setApproveText(""); setApproveExistingResponses([]);
                  reload();
                } catch (e: any) {
                  toast({ title: t("error"), description: e.message, variant: "destructive" });
                } finally {
                  setSendingApproval(false);
                }
              }}
            >
              {sendingApproval ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("contactSend") || "Envoyer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Message — Create / Edit */}
      <AlertDialog open={showGMForm} onOpenChange={(open) => { if (!savingGM && !open) { setShowGMForm(false); setEditingGM(null); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              {editingGM ? "Modifier le message global" : "Nouveau message global"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ce message s'affichera à tous les revendeurs actifs lors de leur prochaine connexion, jusqu'à ce qu'ils cliquent "J'ai lu".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre</label>
              <input
                type="text"
                value={gmForm.title}
                onChange={(e) => setGmForm({ ...gmForm, title: e.target.value })}
                placeholder="Ex: Maintenance prévue le 30/04"
                className={inputClass + " mt-1"}
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message</label>
              <textarea
                value={gmForm.message}
                onChange={(e) => setGmForm({ ...gmForm, message: e.target.value })}
                placeholder="Tapez ici l'annonce visible par tous les revendeurs..."
                className="w-full min-h-[140px] mt-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image (optionnel)</label>
              <div className="flex gap-2 items-center mt-1">
                {gmForm.imageUrl && (
                  <img src={gmForm.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted border border-border" />
                )}
                <input
                  type="text"
                  value={maskUrl(gmForm.imageUrl)}
                  onChange={(e) => setGmForm({ ...gmForm, imageUrl: unmaskUrl(e.target.value) })}
                  placeholder="https://... ou téléversez ci-contre"
                  className={inputClass}
                />
                <label className="inline-flex items-center gap-1.5 px-3 h-11 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium cursor-pointer transition-all whitespace-nowrap">
                  {uploadingGMImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploadingGMImage(true);
                    try {
                      const url = await apiUploadImage(file);
                      setGmForm((f) => ({ ...f, imageUrl: url }));
                    } catch (err: any) {
                      toast({ title: t("error"), description: err.message, variant: "destructive" });
                    } finally { setUploadingGMImage(false); e.target.value = ""; }
                  }} />
                </label>
                {gmForm.imageUrl && (
                  <button type="button" onClick={() => setGmForm({ ...gmForm, imageUrl: "" })} className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-border bg-secondary hover:bg-destructive/10 hover:text-destructive transition-all" title="Retirer l'image">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">L'image sera affichée aux revendeurs avec le message.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!gmForm.isActive}
                onChange={(e) => setGmForm({ ...gmForm, isActive: e.target.checked ? 1 : 0 })}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-foreground">Actif (visible par les revendeurs)</span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingGM}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingGM || !gmForm.title.trim() || !gmForm.message.trim()}
              onClick={(e) => { e.preventDefault(); saveGM(); }}
            >
              {savingGM ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {editingGM ? "Enregistrer" : "Publier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Message — Delete confirm */}
      <AlertDialog open={!!deleteGMId} onOpenChange={(open) => { if (!open) setDeleteGMId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce message global ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le message et son historique de lectures seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDeleteGM(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global Message — View details (reads / unread) */}
      <AlertDialog open={!!viewingGM} onOpenChange={(open) => { if (!open) setViewingGM(null); }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {viewingGM?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-foreground/80 bg-secondary/40 p-3 rounded-lg mt-2">
              {viewingGM?.message}
            </AlertDialogDescription>
            {viewingGM?.image_url && (
              <img src={viewingGM.image_url} alt="" className="mt-2 w-full max-h-64 object-contain rounded-lg border border-border bg-muted" />
            )}
          </AlertDialogHeader>
          {loadingGMDetails ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-success mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Lu par ({viewingGM?.reads?.length || 0})
                </h4>
                {viewingGM?.reads && viewingGM.reads.length > 0 ? (
                  <div className="space-y-1.5">
                    {viewingGM.reads.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-success/5 border border-success/10 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{r.reseller_name || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.reseller_email || ""}</div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.read_at).toLocaleString("fr-FR")}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucun revendeur n'a encore lu ce message.</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-600 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  En attente ({viewingGM?.unread_resellers?.length || 0})
                </h4>
                {viewingGM?.unread_resellers && viewingGM.unread_resellers.length > 0 ? (
                  <div className="space-y-1.5">
                    {viewingGM.unread_resellers.map((r) => (
                      <div key={r.reseller_id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{r.reseller_name || "—"}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.reseller_email || ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Tous les revendeurs actifs ont lu ce message ✅</p>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) => (
  <div className="bg-card rounded-2xl border border-border shadow-premium p-6 hover:border-primary/20 transition-all group relative overflow-hidden">
    <div className={`absolute top-0 end-0 w-20 h-20 rounded-full blur-2xl transition-colors ${color === "accent" ? "bg-accent/5 group-hover:bg-accent/10" : color === "success" ? "bg-success/5 group-hover:bg-success/10" : "bg-primary/5 group-hover:bg-primary/10"}`} />
    <div className="flex items-center justify-between mb-4">
      <span className={`flex items-center justify-center w-12 h-12 rounded-xl border ${color === "accent" ? "bg-accent/10 border-accent/10" : color === "success" ? "bg-success/10 border-success/10" : "bg-primary/5 border-primary/10"}`}>
        <Icon className={`h-5 w-5 ${color === "accent" ? "text-accent" : color === "success" ? "text-success" : "text-primary"}`} />
      </span>
    </div>
    <p className="text-3xl font-display font-bold text-foreground mb-0.5 tracking-tight">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);
const DocSection = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => (
  <div id={id} className="bg-card rounded-2xl border border-border shadow-premium p-6 sm:p-8">
    <h3 className="text-lg font-display font-bold text-foreground mb-4 pb-3 border-b border-border">{title}</h3>
    <div className="prose prose-sm max-w-none text-muted-foreground [&_h4]:text-foreground [&_h4]:font-display [&_h4]:font-bold [&_h4]:text-sm [&_h4]:mt-5 [&_h4]:mb-2 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:space-y-1.5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_ol]:space-y-1.5 [&_li]:leading-relaxed [&_strong]:text-foreground [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs">
      {children}
    </div>
  </div>
);

export default AdminDashboard;
