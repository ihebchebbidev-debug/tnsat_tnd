/**
 * API client for PHP backend
 * All CRUD operations go through these functions
 */

const API_BASE = "https://draminesaid.com/directadmin/satutnd/backend/api";

// Paginated response shape from PHP APIs
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/${endpoint}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
  } catch (e) {
    throw new Error("Network error — unable to reach server");
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server returned invalid response (status ${res.status})`);
  }
  if (!res.ok) {
    const err: any = new Error(data?.error || `API error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

// ---- Auth ----
export interface AuthResponse {
  success: boolean;
  type: "admin" | "client" | "reseller";
  client?: { id: string; name: string; email: string; credits: number };
  reseller?: { id: string; name: string; email: string; credits: number; can_add_resellers: number };
}

export const apiLogin = (email: string, password: string) =>
  request<AuthResponse>("auth.php", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

// ---- Clients ----
export interface ApiClient {
  id: string;
  name: string;
  email: string;
  password: string;
  credits: number;
  is_active: number;
  created_at?: string;
}

export const apiGetClients = () => request<ApiClient[]>("clients.php");
export const apiGetClientsPaginated = (params: PaginationParams) => {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));
  if (params.search) qs.set("search", params.search);
  return request<PaginatedResponse<ApiClient>>(`clients.php?${qs.toString()}`);
};
export const apiGetClient = (id: string) => request<ApiClient>(`clients.php?id=${id}`);

export const apiCreateClient = (data: { name: string; email: string; password: string; credits: number }) =>
  request<{ id: string }>("clients.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateClient = (id: string, data: { name: string; email: string; password: string; credits: number }) =>
  request<{ success: boolean }>(`clients.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const apiAddCredits = (id: string, credits: number, note?: string) =>
  request<{ success: boolean }>(`clients.php?id=${id}&action=add_credits`, {
    method: "PUT",
    body: JSON.stringify({ credits, note }),
  });

export const apiRemoveCredits = (id: string, credits: number) =>
  request<{ success: boolean }>(`clients.php?id=${id}&action=remove_credits`, {
    method: "PUT",
    body: JSON.stringify({ credits }),
  });

export const apiEmptyCredits = (id: string) =>
  request<{ success: boolean }>(`clients.php?id=${id}&action=empty_credits`, {
    method: "PUT",
    body: JSON.stringify({}),
  });

export const apiDeleteClient = (id: string) =>
  request<{ success: boolean }>(`clients.php?id=${id}`, { method: "DELETE" });

export const apiToggleClientActive = (id: string) =>
  request<{ success: boolean }>(`clients.php?id=${id}&action=toggle_active`, {
    method: "PUT",
    body: JSON.stringify({}),
  });

// Batch operations
export const apiBatchDeleteClients = (ids: string[]) =>
  request<{ success: boolean; deleted: number }>("clients.php?action=batch_delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const apiBatchToggleClients = (ids: string[]) =>
  request<{ success: boolean; updated: number }>("clients.php?action=batch_toggle_active", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

// ---- Resellers ----
export interface ApiReseller {
  id: string;
  name: string;
  email: string;
  password: string;
  credits: number;
  can_add_resellers: number;
  parent_reseller_id: string | null;
  parent_name?: string | null;
  note: string | null;
  level: number;
  country: string;
  currency: string;
  image_url: string | null;
  is_active: number;
  created_at?: string;
}

export const apiGetResellers = (parentId?: string) =>
  request<ApiReseller[]>(`resellers.php${parentId ? `?parent_id=${parentId}` : ""}`);
export const apiGetResellersPaginated = (params: PaginationParams & { parentId?: string }) => {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));
  if (params.search) qs.set("search", params.search);
  if (params.parentId) qs.set("parent_id", params.parentId);
  return request<PaginatedResponse<ApiReseller>>(`resellers.php?${qs.toString()}`);
};

export const apiGetReseller = (id: string) => request<ApiReseller>(`resellers.php?id=${id}`);

export const apiCreateReseller = (data: {
  name: string; email: string; password: string; credits: number;
  can_add_resellers?: number; parent_reseller_id?: string | null;
  note?: string; level?: number; country?: string; currency?: string; image_url?: string;
}) => request<{ id: string }>("resellers.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateReseller = (id: string, data: {
  name: string; email: string; password: string; credits: number; can_add_resellers?: number;
  note?: string; level?: number; country?: string; currency?: string; image_url?: string;
}) => request<{ success: boolean }>(`resellers.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const apiAddResellerCredits = (id: string, credits: number, note?: string, paidByReseller?: boolean) =>
  request<{ success: boolean }>(`resellers.php?id=${id}&action=add_credits`, {
    method: "PUT",
    body: JSON.stringify({ credits, note, paid_by_reseller: paidByReseller }),
  });

export const apiRemoveResellerCredits = (id: string, credits: number) =>
  request<{ success: boolean }>(`resellers.php?id=${id}&action=remove_credits`, {
    method: "PUT",
    body: JSON.stringify({ credits }),
  });

export const apiEmptyResellerCredits = (id: string) =>
  request<{ success: boolean }>(`resellers.php?id=${id}&action=empty_credits`, { method: "PUT", body: JSON.stringify({}) });

export const apiToggleResellerActive = (id: string) =>
  request<{ success: boolean }>(`resellers.php?id=${id}&action=toggle_active`, { method: "PUT", body: JSON.stringify({}) });

export const apiSelfUpdateReseller = (id: string, data: { name: string; email: string; current_password: string; password?: string; image_url?: string }) =>
  request<{ success: boolean }>(`resellers.php?id=${id}&action=self_update`, { method: "PUT", body: JSON.stringify(data) });

export const apiDeleteReseller = (id: string) =>
  request<{ success: boolean }>(`resellers.php?id=${id}`, { method: "DELETE" });

// Batch operations
export const apiBatchDeleteResellers = (ids: string[]) =>
  request<{ success: boolean; deleted: number }>("resellers.php?action=batch_delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const apiBatchToggleResellers = (ids: string[]) =>
  request<{ success: boolean; updated: number }>("resellers.php?action=batch_toggle_active", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

// ---- Services ----
export interface ApiService {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_tnd: number;
  price_credits: number;
  stock: number | null;
  delivery_type_id: string | null;
  delivery_type_name?: string;
  category: string | null;
  specifications: Record<string, string> | null;
  features: string[] | null;
  sale_type?: "stock" | "command";
  visibility_mode?: "all" | "whitelist" | "blacklist";
  // Present when fetched with reseller_id — true if a custom price applies
  has_custom_price?: boolean;
  default_price_credits?: number;
}

export const apiGetServices = (resellerId?: string) =>
  request<ApiService[]>(`services.php${resellerId ? `?reseller_id=${encodeURIComponent(resellerId)}` : ""}`);

// ---- Reseller per-service custom prices (admin) ----
export interface ApiResellerServicePrice {
  service_id: string;
  reseller_id: string;
  price_credits: number;
  reseller_name?: string;
  reseller_email?: string;
  service_name?: string;
}

export const apiGetResellerPricesForService = (serviceId: string) =>
  request<ApiResellerServicePrice[]>(`reseller-prices.php?service_id=${encodeURIComponent(serviceId)}`);

export const apiSetResellerPrice = (data: { service_id: string; reseller_id: string; price_credits: number }) =>
  request<{ success: boolean }>(`reseller-prices.php`, { method: "POST", body: JSON.stringify(data) });

export const apiDeleteResellerPrice = (serviceId: string, resellerId: string) =>
  request<{ success: boolean }>(`reseller-prices.php?service_id=${encodeURIComponent(serviceId)}&reseller_id=${encodeURIComponent(resellerId)}`, { method: "DELETE" });

export const apiResetAllResellerPrices = (serviceId: string) =>
  request<{ success: boolean; deleted: number }>(`reseller-prices.php?action=reset_all`, {
    method: "POST",
    body: JSON.stringify({ service_id: serviceId }),
  });

// ---- Per-service visibility (admin) ----
export type ServiceVisibilityMode = "all" | "whitelist" | "blacklist";
export interface ApiServiceVisibility {
  service_id: string;
  mode: ServiceVisibilityMode;
  resellers: { reseller_id: string; name: string; email: string }[];
}
export const apiGetServiceVisibility = (serviceId: string) =>
  request<ApiServiceVisibility>(`service-visibility.php?service_id=${encodeURIComponent(serviceId)}`);

export const apiSetServiceVisibility = (data: { service_id: string; mode: ServiceVisibilityMode; reseller_ids: string[] }) =>
  request<{ success: boolean; mode: ServiceVisibilityMode; count: number }>(`service-visibility.php`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const apiCreateService = (data: {
  name: string; description: string; image_url: string;
  price_tnd: number; price_credits: number; stock?: number | null; delivery_type_id?: string;
  category?: string | null; specifications?: Record<string, string> | null; features?: string[] | null;
  sale_type?: "stock" | "command";
}) => request<{ id: string }>("services.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateService = (id: string, data: {
  name: string; description: string; image_url: string;
  price_tnd: number; price_credits: number; stock?: number | null; delivery_type_id?: string;
  category?: string | null; specifications?: Record<string, string> | null; features?: string[] | null;
  sale_type?: "stock" | "command";
}) => request<{ success: boolean }>(`services.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const apiDeleteService = (id: string) =>
  request<{ success: boolean }>(`services.php?id=${id}`, { method: "DELETE" });

// ---- Delivery Types ----
export interface ApiDeliveryType {
  id: string;
  name: string;
  description: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
}

export const apiGetDeliveryTypes = () => request<ApiDeliveryType[]>("delivery-types.php");

export const apiCreateDeliveryType = (data: { name: string; description: string; fields: any[] }) =>
  request<{ id: string }>("delivery-types.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateDeliveryType = (id: string, data: { name: string; description: string; fields: any[] }) =>
  request<{ success: boolean }>(`delivery-types.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const apiDeleteDeliveryType = (id: string) =>
  request<{ success: boolean }>(`delivery-types.php?id=${id}`, { method: "DELETE" });

// ---- Orders ----
export interface ApiOrder {
  id: string;
  client_id: string | null;
  reseller_id: string | null;
  service_id: string;
  credits_used: number;
  duration_months: number;
  status: "pending" | "fulfilled" | "disputed" | "resolved" | "cancelled";
  delivery_type_id: string | null;
  credentials: Record<string, string> | null;
  note: string | null;
  created_at: string;
  fulfilled_at: string | null;
  service_name?: string;
  client_name?: string;
  client_email?: string;
  reseller_name?: string;
  delivery_type_name?: string;
  delivery_type_fields?: { key: string; label: string; type: string; required: boolean }[];
}

export const apiGetOrders = (clientId?: string, resellerId?: string) => {
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (resellerId) params.set("reseller_id", resellerId);
  const qs = params.toString();
  return request<ApiOrder[]>(`orders.php${qs ? `?${qs}` : ""}`);
};
export const apiGetOrdersPaginated = (params: PaginationParams & { clientId?: string; resellerId?: string; status?: string }) => {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));
  if (params.search) qs.set("search", params.search);
  if (params.clientId) qs.set("client_id", params.clientId);
  if (params.resellerId) qs.set("reseller_id", params.resellerId);
  if (params.status) qs.set("status", params.status);
  return request<PaginatedResponse<ApiOrder>>(`orders.php?${qs.toString()}`);
};

export const apiGetOrder = (id: string) => request<ApiOrder>(`orders.php?id=${id}`);

export const apiCreateOrder = (data: { client_id?: string; reseller_id?: string; service_id: string; duration_months?: number; quantity?: number; note?: string }) =>
  request<{ id: string; status: string; credits_remaining: number }>("orders.php", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const apiFulfillOrder = (id: string, credentials: Record<string, string>) =>
  request<{ success: boolean }>(`orders.php?id=${id}&action=fulfill`, {
    method: "PUT",
    body: JSON.stringify({ credentials }),
  });

export const apiResetOrderCredentials = (id: string) =>
  request<{ success: boolean }>(`orders.php?id=${id}&action=reset_credentials`, {
    method: "PUT",
    body: JSON.stringify({}),
  });

export const apiCancelOrder = (id: string) =>
  request<{ success: boolean; status: string; credits_refunded: number }>(`orders.php?id=${id}&action=cancel`, {
    method: "PUT",
    body: JSON.stringify({}),
  });

export const apiDeleteOrder = (id: string) =>
  request<{ success: boolean }>(`orders.php?id=${id}`, { method: "DELETE" });

export const apiUpdateOrder = (id: string, data: { status?: string; credentials?: Record<string, string> }) =>
  request<{ success: boolean }>(`orders.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

// ---- Complaints ----
export interface ApiComplaint {
  id: string;
  order_id: string;
  client_id: string | null;
  reseller_id: string | null;
  reason: string;
  message: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  service_name?: string;
  client_name?: string;
  client_email?: string;
  reseller_name?: string;
  reseller_email?: string;
  credentials?: Record<string, string> | null;
  order_status?: string;
}

export const apiGetComplaints = (clientId?: string, resellerId?: string) => {
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (resellerId) params.set("reseller_id", resellerId);
  const qs = params.toString();
  return request<ApiComplaint[]>(`complaints.php${qs ? `?${qs}` : ""}`);
};
export const apiGetComplaintsPaginated = (params: PaginationParams) => {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));
  return request<PaginatedResponse<ApiComplaint>>(`complaints.php?${qs.toString()}`);
};

export const apiCreateComplaint = (data: { order_id: string; client_id?: string; reseller_id?: string; reason: string; message: string }) =>
  request<{ id: string; status: string }>("complaints.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateComplaint = (id: string, data: {
  status?: string; admin_response?: string; new_credentials?: Record<string, string>;
}) => request<{ success: boolean }>(`complaints.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

// ---- Notifications ----
export interface ApiNotification {
  id: string;
  client_id: string | null;
  reseller_id: string | null;
  type: string;
  message: string;
  order_id: string | null;
  complaint_id: string | null;
  is_read: number;
  created_at: string;
  reseller_note?: string | null;
}

export const apiGetNotifications = (clientId?: string, resellerId?: string) => {
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (resellerId) params.set("reseller_id", resellerId);
  return request<ApiNotification[]>(`notifications.php?${params.toString()}`);
};

export const apiGetAdminNotifications = () =>
  request<ApiNotification[]>(`notifications.php?admin=1`);

export const apiCreateNotification = (data: {
  type: string;
  message: string;
  order_id?: string | null;
  client_id?: string | null;
  reseller_id?: string | null;
}) => request<{ success: boolean; id: string }>("notifications.php", {
  method: "POST",
  body: JSON.stringify(data),
});

export const apiMarkNotificationRead = (id: string, outcome?: "approved" | "cancelled") =>
  request<{ success: boolean }>(`notifications.php?id=${id}`, {
    method: "PUT",
    body: outcome ? JSON.stringify({ outcome }) : undefined,
  });

export const apiMarkAllNotificationsRead = (clientId?: string, resellerId?: string) => {
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (resellerId) params.set("reseller_id", resellerId);
  params.set("action", "read_all");
  return request<{ success: boolean }>(`notifications.php?${params.toString()}`, { method: "PUT" });
};

export const apiUpdateNotificationNote = (id: string, note: string) =>
  request<{ success: boolean }>(`notifications.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify({ reseller_note: note }),
  });

// ---- Upload ----
export const apiUploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_BASE}/upload.php`, { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url;
};

// ---- Contact Messages ----
export interface ApiContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: number;
  created_at: string;
}

export const apiSendContactMessage = (data: { name: string; email: string; subject: string; message: string }) =>
  request<{ id: string; success: boolean }>("contact.php", { method: "POST", body: JSON.stringify(data) });

export const apiGetContactMessages = () => request<ApiContactMessage[]>("contact.php");
export const apiGetContactMessagesPaginated = (params: PaginationParams) => {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page || 1));
  qs.set("limit", String(params.limit || 20));
  return request<PaginatedResponse<ApiContactMessage>>(`contact.php?${qs.toString()}`);
};

export const apiMarkContactRead = (id: string) =>
  request<{ success: boolean }>(`contact.php?id=${id}`, { method: "PUT" });

export const apiDeleteContactMessage = (id: string) =>
  request<{ success: boolean }>(`contact.php?id=${id}`, { method: "DELETE" });

// ---- Point Transactions ----
export interface ApiPointTransaction {
  id: string;
  client_id: string | null;
  reseller_id: string | null;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
  is_paid?: number;
}

export const apiGetPointTransactions = (clientId?: string, resellerId?: string, filters?: { type?: string; from?: string; to?: string }) => {
  const params = new URLSearchParams();
  if (clientId) params.set("client_id", clientId);
  if (resellerId) params.set("reseller_id", resellerId);
  if (filters?.type) params.set("type", filters.type);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  return request<ApiPointTransaction[]>(`point-transactions.php?${params.toString()}`);
};

export const apiUpdateTransactionPaid = (id: string, isPaid: boolean) =>
  request<{ success: boolean; is_paid: number }>(`point-transactions.php?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ is_paid: isPaid }),
  });

// ---- Recharge Codes ----
export interface ApiRechargeCode {
  id: string;
  code: string;
  credits: number;
  is_used: number;
  used_by_reseller_id: string | null;
  reseller_name: string | null;
  used_at: string | null;
  created_at: string;
}

export const apiGetRechargeCodes = () =>
  request<ApiRechargeCode[]>("recharge-codes.php");

export const apiCreateRechargeCodes = (data: { credits: number; count: number; prefix?: string }) =>
  request<{ success: boolean; codes: { id: string; code: string; credits: number }[]; count: number }>(
    "recharge-codes.php", { method: "POST", body: JSON.stringify(data) }
  );

export const apiDeleteRechargeCode = (id: string) =>
  request<{ success: boolean }>(`recharge-codes.php?id=${id}`, { method: "DELETE" });

export const apiCheckRechargeCode = (code: string) =>
  request<{ valid: boolean; credits?: number; error?: string }>(
    "recharge-codes.php?action=check", { method: "POST", body: JSON.stringify({ code }) }
  );

export const apiRedeemRechargeCode = (code: string, resellerId: string) =>
  request<{ success: boolean; credits_added: number; new_balance: number }>(
    "recharge-codes.php?action=redeem", { method: "POST", body: JSON.stringify({ code, reseller_id: resellerId }) }
  );

// ---- Settings ----
export const apiGetSettings = () =>
  request<Record<string, string>>("settings.php");

export const apiGetSetting = (key: string) =>
  request<{ key: string; value: string }>(`settings.php?key=${key}`);

export const apiUpdateSetting = (key: string, value: string) =>
  request<{ success: boolean; key: string; value: string }>("settings.php", {
    method: "PUT",
    body: JSON.stringify({ key, value }),
  });

// ---- Categories ----
export interface ApiCategory {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
  product_count: number;
  visibility_mode?: "all" | "whitelist" | "blacklist";
  created_at?: string;
}

export const apiGetCategories = (resellerId?: string) =>
  request<ApiCategory[]>(`categories.php${resellerId ? `?reseller_id=${encodeURIComponent(resellerId)}` : ""}`);

export const apiCreateCategory = (data: { name: string; image_url: string; sort_order?: number }) =>
  request<{ id: string }>("categories.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateCategory = (id: string, data: { name: string; image_url: string; sort_order?: number }) =>
  request<{ success: boolean }>(`categories.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const apiDeleteCategory = (id: string) =>
  request<{ success: boolean }>(`categories.php?id=${id}`, { method: "DELETE" });

// ---- Per-category visibility (admin) ----
export interface ApiCategoryVisibility {
  category_id: string;
  mode: ServiceVisibilityMode;
  resellers: { reseller_id: string; name: string; email: string }[];
}
export const apiGetCategoryVisibility = (categoryId: string) =>
  request<ApiCategoryVisibility>(`category-visibility.php?category_id=${encodeURIComponent(categoryId)}`);

export const apiSetCategoryVisibility = (data: { category_id: string; mode: ServiceVisibilityMode; reseller_ids: string[] }) =>
  request<{ success: boolean; mode: ServiceVisibilityMode; count: number }>(`category-visibility.php`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// ---- Product Keys ----
export interface ApiProductKeyField {
  title: string;
  value: string;
}

export interface ApiProductKey {
  id: string;
  service_id: string;
  fields: ApiProductKeyField[];
  status: "available" | "assigned";
  order_id: string | null;
  assigned_at: string | null;
  created_at: string;
  reseller_note?: string | null;
}

export interface ApiProductKeyCount {
  total: number;
  available: number;
  assigned: number;
}

export const apiGetProductKeys = (serviceId: string, status?: string) => {
  const qs = new URLSearchParams({ service_id: serviceId });
  if (status) qs.set("status", status);
  return request<ApiProductKey[]>(`product-keys.php?${qs.toString()}`);
};

export const apiGetProductKeyCount = (serviceId: string) =>
  request<ApiProductKeyCount>(`product-keys.php?service_id=${serviceId}&count=1`);

export const apiGetAllProductKeyCounts = () =>
  request<Record<string, ApiProductKeyCount>>(`product-keys.php?count=1`);

export const apiAddProductKeys = (serviceId: string, keys: { fields: ApiProductKeyField[] }[]) =>
  request<{ success: boolean; count: number; keys: { id: string; fields: ApiProductKeyField[] }[] }>(
    "product-keys.php", { method: "POST", body: JSON.stringify({ service_id: serviceId, keys }) }
  );

export const apiAddSingleProductKey = (serviceId: string, fields: ApiProductKeyField[]) =>
  request<{ success: boolean; count: number; keys: { id: string; fields: ApiProductKeyField[] }[] }>(
    "product-keys.php", { method: "POST", body: JSON.stringify({ service_id: serviceId, fields }) }
  );

export const apiAssignProductKey = (serviceId: string, orderId: string) =>
  request<{ success: boolean; key_id: string; fields: ApiProductKeyField[] }>(
    "product-keys.php?action=assign", { method: "POST", body: JSON.stringify({ service_id: serviceId, order_id: orderId }) }
  );

export const apiUpdateProductKey = (id: string, fields: ApiProductKeyField[]) =>
  request<{ success: boolean }>(`product-keys.php?id=${id}`, { method: "PUT", body: JSON.stringify({ fields }) });

export const apiDeleteProductKey = (id: string) =>
  request<{ success: boolean }>(`product-keys.php?id=${id}`, { method: "DELETE" });

export const apiBulkDeleteProductKeys = (ids: string[]) =>
  request<{ success: boolean; deleted: number }>("product-keys.php?action=bulk_delete", {
    method: "DELETE", body: JSON.stringify({ ids }),
  });

export const apiUpdateProductKeyNote = (id: string, note: string) =>
  request<{ success: boolean }>(`product-keys.php?id=${id}&action=update_note`, {
    method: "PUT", body: JSON.stringify({ note }),
  });

// ---- Assigned Keys History ----
export interface ApiAssignedKeyHistory {
  id: string;
  service_id: string;
  service_name: string;
  fields: ApiProductKeyField[];
  status: string;
  order_id: string | null;
  assigned_at: string | null;
  created_at: string;
  buyer_name: string;
  buyer_client_id: string;
  buyer_reseller_id: string;
  reseller_note?: string | null;
}

export interface ApiAssignedKeysPage {
  data: ApiAssignedKeyHistory[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const apiGetAssignedKeysHistory = (filters?: {
  service_id?: string; from?: string; to?: string;
  reseller_id?: string; client_id?: string;
  page?: number; per_page?: number;
}) => {
  const params = new URLSearchParams({ action: 'assigned_history' });
  if (filters?.service_id) params.set('service_id', filters.service_id);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.reseller_id) params.set('reseller_id', filters.reseller_id);
  if (filters?.client_id) params.set('client_id', filters.client_id);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.per_page) params.set('per_page', String(filters.per_page));
  return request<ApiAssignedKeysPage>(`product-keys.php?${params.toString()}`);
};

// ---- Stock-Out Attempts (admin) ----
export interface ApiStockOutAttempt {
  id: string;
  service_id: string;
  service_name: string | null;
  client_id: string | null;
  reseller_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_type: "reseller" | "client" | "unknown";
  attempted_credits: number;
  created_at: string;
}

export const apiGetStockOutAttempts = (filters?: {
  service_id?: string;
  reseller_id?: string;
  client_id?: string;
  buyer_type?: "reseller" | "client";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (filters?.service_id)  qs.set("service_id", filters.service_id);
  if (filters?.reseller_id) qs.set("reseller_id", filters.reseller_id);
  if (filters?.client_id)   qs.set("client_id", filters.client_id);
  if (filters?.buyer_type)  qs.set("buyer_type", filters.buyer_type);
  if (filters?.from)        qs.set("from", filters.from);
  if (filters?.to)          qs.set("to", filters.to);
  qs.set("page", String(filters?.page ?? 1));
  qs.set("limit", String(filters?.limit ?? 50));
  return request<PaginatedResponse<ApiStockOutAttempt>>(`stock-out-attempts.php?${qs.toString()}`);
};

// ---- Order Responses ----
export interface ApiOrderResponse {
  id: string;
  order_id: string;
  reseller_id: string | null;
  client_id: string | null;
  response_text: string;
  created_at: string;
  reseller_name?: string;
  client_name?: string;
  service_name?: string;
  credentials?: Record<string, string> | null;
  order_status?: string;
  credits_used?: number;
  order_note?: string;
}

export const apiGetOrderResponses = (orderId: string) =>
  request<ApiOrderResponse[]>(`order-responses.php?order_id=${orderId}`);

export const apiGetAllOrderResponses = () =>
  request<ApiOrderResponse[]>("order-responses.php");

export const apiCreateOrderResponse = (data: { order_id: string; reseller_id?: string; client_id?: string; is_admin?: boolean; response_text: string }) =>
  request<{ success: boolean; id: string }>("order-responses.php", { method: "POST", body: JSON.stringify(data) });

export const apiUpdateOrderResponse = (id: string, response_text: string) =>
  request<{ success: boolean }>(`order-responses.php?id=${id}`, { method: "PUT", body: JSON.stringify({ response_text }) });

export const apiDeleteOrderResponse = (id: string) =>
  request<{ success: boolean }>(`order-responses.php?id=${id}`, { method: "DELETE" });

// ---- Reset Products (admin-managed catalog) ----
export interface ApiResetProductField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | string;
  required?: boolean;
}

export interface ApiResetProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  fields: ApiResetProductField[];
  sort_order: number;
  is_active: number;
  created_at?: string;
}

export const apiGetResetProducts = (activeOnly = false) =>
  request<ApiResetProduct[]>(`reset-products.php${activeOnly ? "?active=1" : ""}`);

export const apiCreateResetProduct = (data: {
  name: string; description: string; image_url: string;
  fields: ApiResetProductField[]; sort_order?: number; is_active?: number;
}) => request<{ id: string }>("reset-products.php", {
  method: "POST",
  body: JSON.stringify(data),
});

export const apiUpdateResetProduct = (id: string, data: {
  name: string; description: string; image_url: string;
  fields: ApiResetProductField[]; sort_order?: number; is_active?: number;
}) => request<{ success: boolean }>(`reset-products.php?id=${id}`, {
  method: "PUT",
  body: JSON.stringify(data),
});

export const apiDeleteResetProduct = (id: string) =>
  request<{ success: boolean }>(`reset-products.php?id=${id}`, { method: "DELETE" });

// Reseller (or client) submits a reset request for a given reset product
export const apiSubmitResetRequest = (data: {
  reset_product_id: string;
  reseller_id?: string;
  client_id?: string;
  values: Record<string, string>;
  note?: string;
}) => request<{ success: boolean; notification_id: string; cid: string }>(
  "reset-products.php?action=request",
  { method: "POST", body: JSON.stringify(data) }
);

// Reseller (or client) edits a still-pending reset request (matched by CID).
// Server refuses if the admin already approved/cancelled the request.
export const apiEditResetRequest = (data: {
  cid: string;
  reseller_id?: string;
  client_id?: string;
  values: Record<string, string>;
  note?: string;
}) => request<{ success: boolean }>(
  "reset-products.php?action=edit_request",
  { method: "POST", body: JSON.stringify(data) }
);

// ---- Global Messages (admin broadcast to all resellers) ----
export interface ApiGlobalMessageRead {
  id: string;
  reseller_id: string;
  read_at: string;
  reseller_name: string | null;
  reseller_email: string | null;
}

export interface ApiGlobalMessageUnreadReseller {
  reseller_id: string;
  reseller_name: string | null;
  reseller_email: string | null;
}

export interface ApiGlobalMessage {
  id: string;
  title: string;
  message: string;
  image_url?: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
  read_count?: number;
  total_resellers?: number;
  reads?: ApiGlobalMessageRead[];
  unread_resellers?: ApiGlobalMessageUnreadReseller[];
}

export const apiGetGlobalMessages = () =>
  request<ApiGlobalMessage[]>("global-messages.php");

export const apiGetGlobalMessage = (id: string) =>
  request<ApiGlobalMessage>(`global-messages.php?id=${id}`);

export const apiGetUnreadGlobalMessages = (resellerId: string) =>
  request<ApiGlobalMessage[]>(`global-messages.php?reseller_id=${resellerId}&unread=1`);

export const apiGetActiveGlobalMessages = () =>
  request<ApiGlobalMessage[]>(`global-messages.php?active=1`);

export const apiCreateGlobalMessage = (data: { title: string; message: string; image_url?: string | null; is_active?: number }) =>
  request<{ id: string; success: boolean }>("global-messages.php", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const apiUpdateGlobalMessage = (id: string, data: { title?: string; message?: string; image_url?: string | null; is_active?: number }) =>
  request<{ success: boolean }>(`global-messages.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const apiMarkGlobalMessageRead = (id: string, resellerId: string) =>
  request<{ success: boolean }>(`global-messages.php?id=${id}&action=mark_read`, {
    method: "PUT",
    body: JSON.stringify({ reseller_id: resellerId }),
  });

export const apiDeleteGlobalMessage = (id: string) =>
  request<{ success: boolean }>(`global-messages.php?id=${id}`, { method: "DELETE" });
