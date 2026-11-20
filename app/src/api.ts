import AsyncStorage from '@react-native-async-storage/async-storage';

export type User = {id: number; name: string; phone: string; role: 'customer' | 'owner'};
export type Shop = {
  id: number; name: string; address: string; lat: number | null; lng: number | null;
  distance_km?: number | null;
  accepting?: ShopState; hours_closed?: boolean;
  phone?: string; open_time?: string; close_time?: string; pickup_info?: string; category?: string; area?: string;
  approval?: 'pending' | 'approved' | 'suspended' | 'rejected'; approval_note?: string;
};
export type ShopState = 'open' | 'busy' | 'closed';
export type Plan = {
  id: number; audience: 'owner' | 'customer'; name: string; description: string; price: number;
  duration_days: number; max_users: number; max_orders_per_shop: number; max_shops: number;
  is_default: number;
};
export type SubscriptionInfo = {
  id: number; started_at: string; expires_at: string | null; days_left: number | null; plan: Plan;
};
export type Usage = {cycle_start: string; orders_total: number; shops_used: number; per_shop: Record<string, number>};
export type TeamInfo = {count: number; max: number; is_primary: boolean};
export type Member = {id: number; name: string; phone: string; is_primary: number};
export type Account = {subscription: SubscriptionInfo | null; usage?: Usage | null; team?: TeamInfo | null};
export type ItemState = 'pending' | 'available' | 'unavailable' | 'partial';
export type Line = {
  id: number; name: string; qty: string; available: number;
  state: ItemState; avail_qty: string; response: '' | 'accepted' | 'rejected';
};
// Order life cycle: New -> Accepted -> (Awaiting you) -> Preparing -> Ready -> Picked up.
// Ends early as Declined (shop), Cancelled (customer) or Expired (nobody answered in time).
export const ACTIVE_STATUSES = ['New', 'Accepted', 'Awaiting you', 'Preparing', 'Ready'];
export const isActiveOrder = (status: string) => ACTIVE_STATUSES.includes(status);
export type Order = {
  id: number; shop_id: number; shop_name: string; customer_name: string; phone: string;
  note: string; status: string; created_at: string; items: Line[];
  decline_reason?: string; shop_accepting?: ShopState;
  code?: string; eta_minutes?: number | null; cancel_requested?: number; rating?: number | null; feedback?: string;
};

// `adb reverse tcp:3000 tcp:3000` lets a USB-connected phone reach the PC at localhost.
export const DEFAULT_URL = 'http://localhost:3000';

let baseUrl = DEFAULT_URL;
let token = '';

export const getBaseUrl = () => baseUrl;
export async function loadBaseUrl() {
  baseUrl = (await AsyncStorage.getItem('server_url')) || DEFAULT_URL;
  return baseUrl;
}
export async function setBaseUrl(url: string) {
  baseUrl = url.trim().replace(/\/$/, '') || DEFAULT_URL;
  await AsyncStorage.setItem('server_url', baseUrl);
}
export const setToken = (t: string) => { token = t; };

// Called when the server rejects our session token (corrupted, removed or unknown).
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

// Called when the server says the shop needs an active plan (it may have just expired).
let onPlanRequired: (() => void) | null = null;
export const setPlanRequiredHandler = (fn: (() => void) | null) => { onPlanRequired = fn; };

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: 'Bearer ' + token} : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the shop server at ${baseUrl}. Check the server address.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A rejected token means the session is no longer valid: log out automatically.
    if (res.status === 401 && token) onUnauthorized?.();
    if (res.status === 402 && data.code === 'plan_required') onPlanRequired?.();
    const err: any = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}

export type AppNotification = {id: number; order_id: number | null; title: string; body: string; read: number; created_at: string};
