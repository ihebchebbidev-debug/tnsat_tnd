export interface Client {
  id: string;
  name: string;
  email: string;
  password: string;
  credits: number;
}

export interface Reseller {
  id: string;
  name: string;
  email: string;
  password: string;
  credits: number;
  canAddResellers: boolean;
  parentResellerId?: string;
  isActive: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceCredits: number;
  stock?: number;
  deliveryTypeId?: string;
}

export interface DeliveryTypeField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "url";
  required: boolean;
}

export interface DeliveryType {
  id: string;
  name: string;
  description: string;
  fields: DeliveryTypeField[];
}

export type OrderStatus = "pending" | "fulfilled" | "disputed" | "resolved" | "cancelled";

export interface Order {
  id: string;
  clientId: string;
  resellerId?: string;
  serviceId: string;
  creditsUsed: number;
  date: string;
  status: OrderStatus;
  deliveryTypeId?: string;
  credentials?: Record<string, string>;
}

export type ComplaintStatus = "open" | "in_review" | "resolved" | "rejected";

export interface Complaint {
  id: string;
  orderId: string;
  clientId: string;
  reason: "expired" | "not_working" | "wrong_credentials" | "other";
  message: string;
  status: ComplaintStatus;
  createdAt: string;
  adminResponse?: string;
  resolvedAt?: string;
}

export interface Notification {
  id: string;
  clientId: string;
  type: "credentials_ready" | "complaint_updated" | "complaint_resolved";
  message: string;
  orderId?: string;
  complaintId?: string;
  read: boolean;
  createdAt: string;
}

const KEYS = {
  clients: "clients",
  services: "services",
  orders: "orders",
  deliveryTypes: "delivery_types",
  complaints: "complaints",
  notifications: "notifications",
  lang: "tnsat_lang",
  auth: "tnsat_auth",
} as const;

function get<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Clients
export const getClients = (): Client[] => get<Client>(KEYS.clients);
export const saveClients = (c: Client[]) => set(KEYS.clients, c);

// Services
export const getServices = (): Service[] => get<Service>(KEYS.services);
export const saveServices = (s: Service[]) => set(KEYS.services, s);

// Orders
export const getOrders = (): Order[] => {
  const orders = get<Order>(KEYS.orders);
  return orders.map(o => ({ ...o, status: o.status || "pending" }));
};
export const saveOrders = (o: Order[]) => set(KEYS.orders, o);

// Delivery Types
export const getDeliveryTypes = (): DeliveryType[] => get<DeliveryType>(KEYS.deliveryTypes);
export const saveDeliveryTypes = (d: DeliveryType[]) => set(KEYS.deliveryTypes, d);

// Complaints
export const getComplaints = (): Complaint[] => get<Complaint>(KEYS.complaints);
export const saveComplaints = (c: Complaint[]) => set(KEYS.complaints, c);

// Notifications
export const getNotifications = (): Notification[] => get<Notification>(KEYS.notifications);
export const saveNotifications = (n: Notification[]) => set(KEYS.notifications, n);
export const getClientNotifications = (clientId: string): Notification[] =>
  getNotifications().filter(n => n.clientId === clientId);
export const markNotificationRead = (id: string) => {
  const all = getNotifications();
  saveNotifications(all.map(n => n.id === id ? { ...n, read: true } : n));
};

// Auth
export interface AuthState {
  type: "admin" | "client" | "reseller";
  clientId?: string;
  resellerId?: string;
}

export const getAuth = (): AuthState | null => {
  try {
    const raw = localStorage.getItem(KEYS.auth);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setAuth = (auth: AuthState | null) => {
  if (auth) {
    localStorage.setItem(KEYS.auth, JSON.stringify(auth));
  } else {
    localStorage.removeItem(KEYS.auth);
  }
};

// Language
export const getLang = (): "fr" | "en" | "ar" => {
  return (localStorage.getItem(KEYS.lang) as "fr" | "en" | "ar") || "fr";
};

export const setLangStorage = (lang: "fr" | "en" | "ar") => {
  localStorage.setItem(KEYS.lang, lang);
};

// Utility
export const generateId = () => crypto.randomUUID();
