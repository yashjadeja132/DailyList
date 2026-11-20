import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Account, api, loadBaseUrl, setPlanRequiredHandler, setToken, setUnauthorizedHandler, Shop, User,
} from './api';
import {registerPush, unregisterPush} from './push';

/** Returned when the plan has to be paid online first. */
export type PaymentStart = {
  payment_required: true; order_id: string; payment_session_id: string; environment: 'sandbox' | 'production';
  amount: number; plan_name: string;
};

export type SignupData = {
  name: string; role: 'customer' | 'owner';
  /** The user ticked "I agree to the Terms & Conditions and Privacy Policy". Required to sign up. */
  accepted_terms: boolean;
  shop?: {name: string; address: string; lat?: number; lng?: number};
};

type Me = {user: User; shop: Shop | null} & Partial<Account>;

type Ctx = {
  user: User | null;
  shop: Shop | null; // the owner's own shop
  /** The current plan, usage (customers) and team info (shop owners). */
  account: Account;
  booting: boolean;
  /** false until the intro slides have been seen once on this phone */
  onboarded: boolean;
  finishOnboarding: () => void;
  /** Whether a phone number already has an account. */
  checkAccount: (phone: string) => Promise<boolean>;
  /** Sends an OTP by SMS. Returns a hint shown only on the development server. */
  sendOtp: (phone: string) => Promise<string | undefined>;
  /** Checks the OTP. 'signup' means a new number: collect details and call again with `signup`. */
  verifyOtp: (
    phone: string, otp: string, mode: 'login' | 'signup', signup?: SignupData,
  ) => Promise<'done' | 'signup'>;
  logout: () => Promise<void>;
  setShop: (s: Shop) => void;
  setUser: (u: User) => void;
  /** Reloads the plan / usage / team info from the server. */
  refreshAccount: () => Promise<void>;
  /** Buys (or switches to) a plan. */
  purchasePlan: (planId: number) => Promise<PaymentStart | null>;
};

const EMPTY: Account = {subscription: null, usage: null, team: null};

const AuthContext = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [account, setAccount] = useState<Account>(EMPTY);
  const [booting, setBooting] = useState(true);
  const [onboarded, setOnboarded] = useState(true);

  const takeAccount = (a: Partial<Account>) =>
    setAccount({subscription: a.subscription || null, usage: a.usage || null, team: a.team || null});

  // Forget the saved session (used by log out and when the server rejects our token).
  const clearSession = useCallback(async () => {
    setToken('');
    setShop(null);
    setUser(null);
    setAccount(EMPTY);
    await AsyncStorage.removeItem('token').catch(() => {});
    await AsyncStorage.removeItem('session').catch(() => {});
  }, []);

  const refreshAccount = useCallback(async () => {
    const me = await api<Me>('/auth/me');
    setUser(me.user);
    setShop(me.shop);
    takeAccount(me);
  }, []);

  // Sessions never expire by time. If the server ever rejects the token, log out automatically.
  // once someone is logged in, let this phone receive push notifications
  const userId = user?.id;
  useEffect(() => { if (userId) registerPush(); }, [userId]);

  useEffect(() => {
    setUnauthorizedHandler(() => { clearSession(); });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // The shop's plan ran out while using the app: reload the plan so the "choose a plan" screen shows.
  useEffect(() => {
    setPlanRequiredHandler(() => { refreshAccount().catch(() => {}); });
    return () => setPlanRequiredHandler(null);
  }, [refreshAccount]);

  // Keep a copy of the profile so the app opens straight into the account, even offline.
  useEffect(() => {
    if (user) AsyncStorage.setItem('session', JSON.stringify({user, shop, account})).catch(() => {});
  }, [user, shop, account]);

  const accept = useCallback(async (r: Me & {token: string}) => {
    setToken(r.token);
    await AsyncStorage.setItem('token', r.token);
    setShop(r.shop || null);
    takeAccount(r);
    setUser(r.user);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const started = Date.now();
      try {
        await loadBaseUrl();
        const seen = await AsyncStorage.getItem('onboarded');
        if (alive) setOnboarded(seen === '1');
        const t = await AsyncStorage.getItem('token');
        if (t) {
          setToken(t);
          // saved profile (ignored if it is damaged)
          let cached: Me | null = null;
          try {
            const c = JSON.parse((await AsyncStorage.getItem('session')) || 'null');
            if (c?.user && typeof c.user.id === 'number' && ['customer', 'owner'].includes(c.user.role)) {
              cached = {user: c.user, shop: c.shop || null, ...(c.account || {})};
            }
          } catch {}

          const apply = (me: Me) => {
            if (!alive) return;
            setShop(me.shop);
            takeAccount(me);
            setUser(me.user);
          };
          if (cached) {
            // open the app right away, then confirm with the server in the background
            apply(cached);
            api<Me>('/auth/me').then(apply).catch(() => {});
          } else {
            try {
              apply(await api<Me>('/auth/me'));
            } catch {
              // 401 already logged us out; any other error (offline) keeps the token for next time
            }
          }
        }
      } catch {
        // storage problem: carry on logged out
      }
      // keep the splash screen visible for a moment
      const wait = Math.max(0, 2800 - (Date.now() - started));
      setTimeout(() => alive && setBooting(false), wait);
    })();
    return () => { alive = false; };
  }, []);

  const value = useMemo<Ctx>(() => ({
    user, shop, account, booting, setShop, setUser, onboarded, refreshAccount,
    finishOnboarding: () => {
      setOnboarded(true);
      AsyncStorage.setItem('onboarded', '1').catch(() => {});
    },
    checkAccount: async phone => (await api<{exists: boolean}>('/auth/check', 'POST', {phone})).exists,
    sendOtp: async phone => (await api<{dev_hint?: string}>('/auth/send-otp', 'POST', {phone})).dev_hint,
    verifyOtp: async (phone, otp, mode, signup) => {
      const r = await api('/auth/verify', 'POST', {phone, otp, mode, signup});
      if (r.needs_signup) return 'signup';
      await accept(r);
      return 'done';
    },
    purchasePlan: async planId => {
      const r = await api<Partial<Account> & Partial<PaymentStart>>('/subscription/purchase', 'POST', {plan_id: planId});
      if (r.payment_required) return r as PaymentStart; // the plan is switched on after the payment
      takeAccount(r);
      return null;
    },
    logout: async () => {
      await unregisterPush();
      try { await api('/auth/logout', 'POST', {}); } catch {}
      await clearSession();
    },
  }), [user, shop, account, booting, onboarded, accept, clearSession, refreshAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
