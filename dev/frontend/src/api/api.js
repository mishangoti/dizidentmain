import axios from "axios";
import { API_BASE_URL } from "../config";
import { getAccessToken } from "../auth/tokenStore";
import { isNetworkError, setBackendOffline } from "./backendStatus";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-loading", { detail: 1 }));

      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const saved = localStorage.getItem("hms_user");
      if (saved) {
        try {
          const user = JSON.parse(saved);
          if (user.role === "DOCTOR") {
            const activeOrgId = localStorage.getItem("hms_active_org_id");
            if (activeOrgId) {
              config.headers["X-Active-Org-Id"] = activeOrgId;
            }
          }
        } catch {
          // Ignore
        }
      }
    }
    return config;
  },
  (error) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-loading", { detail: -1 }));
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-loading", { detail: -1 }));
    }
    setBackendOffline(false);
    return response;
  },
  (error) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-loading", { detail: -1 }));
    }
    if (isNetworkError(error)) {
      setBackendOffline(true);
    }
    return Promise.reject(error);
  }
);

export default api;
