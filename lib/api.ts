import axios from "axios";
import { API_BASE_URL } from "@/constants/env";
import { useAuthStore } from "@/store/authStore";

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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
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
