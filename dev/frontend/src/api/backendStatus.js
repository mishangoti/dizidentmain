import { API_BASE, API_BASE_URL } from "../config";

const listeners = new Set();
let offline = false;

export function isBackendOffline() {
  return offline;
}

export function subscribeBackendStatus(listener) {
  listeners.add(listener);
  listener(offline);
  return () => listeners.delete(listener);
}

export function setBackendOffline(next) {
  const value = Boolean(next);
  if (offline === value) return;
  offline = value;
  listeners.forEach((fn) => fn(offline));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("backend-status", { detail: { offline } }));
  }
}

export function isHmsApiUrl(input) {
  if (!input) return false;
  const raw = typeof input === "string" ? input : input.url;
  if (!raw || typeof raw !== "string") return false;
  return raw.startsWith(API_BASE_URL) || raw.startsWith(API_BASE);
}

export function isNetworkError(error) {
  if (!error) return false;
  if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") return true;
  if (error.message && /network|failed to fetch|err_connection/i.test(error.message)) return true;
  return !error.response;
}

export async function pingBackend() {
  const fetchFn =
    (typeof window !== "undefined" && window.__nativeFetch) || fetch;
  try {
    await fetchFn(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    setBackendOffline(false);
    return true;
  } catch {
    setBackendOffline(true);
    return false;
  }
}
