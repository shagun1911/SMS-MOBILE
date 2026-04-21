import axios from "axios";
import { API_BASE_URL } from "@/constants/env";
import { useAuthStore } from "@/store/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
    refreshToken,
  });
  const newToken = data.token ?? data.accessToken;
  const newRefresh = data.refreshToken;
  useAuthStore.getState().setTokens(newToken, newRefresh ?? refreshToken);
  return newToken ?? null;
}

/**
 * Multipart upload via fetch — Axios + FormData is unreliable on React Native (often surfaces as "Network Error").
 * Retries once on 401 after refresh, same as the Axios interceptor.
 */
export async function postMultipart(path: string, formData: FormData, timeoutMs = 180000): Promise<unknown> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const run = async (token: string | null) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  let token = useAuthStore.getState().token ?? null;
  let res = await run(token);
  if (res.status === 401) {
    const next = await refreshAccessToken();
    if (!next) {
      useAuthStore.getState().logout();
      throw new Error("Session expired. Please log in again.");
    }
    res = await run(next);
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error((text && text.slice(0, 280)) || `Server returned invalid JSON (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      (json as { message?: string })?.message ||
      (json as { error?: string })?.error ||
      `Request failed (${res.status})`;
    throw new Error(String(msg));
  }
  return json;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

const CACHE_PREFIX = "sms_http_cache_v1:";
const DEFAULT_GET_CACHE_TTL_MS = 30_000;

function cacheKeyFor(config: { baseURL?: string; url?: string; params?: unknown }): string | null {
  const url = (config.url || "").toString();
  if (!url) return null;
  const params = config.params ? JSON.stringify(config.params) : "";
  return `${CACHE_PREFIX}${(config.baseURL || "")}${url}?${params}`;
}

function shouldCacheGet(url: string): boolean {
  const u = (url || "").toString();
  // Cache only read-heavy, non-sensitive endpoints.
  if (!u.startsWith("/")) return false;
  if (u.startsWith("/auth")) return false;
  if (u.includes("/payments")) return false;
  return [
    "/schools/me",
    "/classes",
    "/exams",
    "/sessions",
    "/transport",
    "/user-notifications",
    "/attendance",
    "/transport-attendance",
    "/timetable",
  ].some((p) => u.startsWith(p));
}

async function writeCache(key: string, payload: unknown, ttlMs: number) {
  const entry = { v: payload, e: Date.now() + Math.max(1000, ttlMs) };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

async function readCache(key: string): Promise<unknown | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v: unknown; e: number };
    if (!parsed?.e || Date.now() > parsed.e) return null;
    return parsed.v ?? null;
  } catch {
    return null;
  }
}

function isFormDataPayload(data: unknown): boolean {
  if (typeof FormData === "undefined" || data == null) return false;
  if (data instanceof FormData) return true;
  return typeof (data as { append?: unknown }).append === "function";
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (isFormDataPayload(config.data)) {
    const h = config.headers as Record<string, unknown> & {
      delete?: (key: string) => void;
    };
    delete h["Content-Type"];
    delete h["content-type"];
    h.delete?.("Content-Type");
    h.delete?.("content-type");
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
    try {
      const method = (response.config?.method || "get").toLowerCase();
      const url = (response.config?.url || "").toString();
      if (method === "get" && shouldCacheGet(url)) {
        const key = cacheKeyFor(response.config);
        if (key) {
          await writeCache(key, response.data, DEFAULT_GET_CACHE_TTL_MS);
        }
      }
    } catch {
      // ignore cache write errors
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    // Offline fallback: if GET fails with no HTTP response, serve cached data (best effort).
    try {
      const method = (originalRequest?.method || "get").toLowerCase();
      const url = (originalRequest?.url || "").toString();
      if (method === "get" && !error.response && shouldCacheGet(url)) {
        const key = cacheKeyFor(originalRequest);
        if (key) {
          const cached = await readCache(key);
          if (cached != null) {
            return Promise.resolve({
              data: cached,
              status: 200,
              statusText: "OK (cached)",
              headers: {},
              config: originalRequest,
            });
          }
        }
      }
    } catch {
      // ignore cache read errors
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });
        const newToken = data.token ?? data.accessToken;
        const newRefreshToken = data.refreshToken;
        useAuthStore.getState().setTokens(newToken, newRefreshToken ?? refreshToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
