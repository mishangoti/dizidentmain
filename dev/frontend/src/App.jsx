// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { UserManager } from "oidc-client-ts";

import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/dashboards/Dashboard";
import DoctorDashboard from "./pages/dashboards/DoctorDashboard";
import PatientDashboard from "./pages/dashboards/PatientDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import ServiceProviderDashboard from "./pages/dashboards/ServiceProviderDashboard";
import { ToastProvider } from "./components/common/ToastProvider";
import GlobalLoader from "./components/common/GlobalLoader";
import BackendOfflineBanner from "./components/common/BackendOfflineBanner";
import { AUTHENTIK_ENABLED, oidcSettings } from "./auth/authFlags";
import OidcSessionBridge from "./auth/OidcSessionBridge";
import { clearAccessToken } from "./auth/tokenStore";
import { isHmsApiUrl, setBackendOffline } from "./api/backendStatus";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("hms_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const normalized = {
          ...parsed,
          id: parsed.id ?? parsed.userId ?? null,
        };
        setUser(normalized);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__fetchPatched) return;
    window.__fetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.__nativeFetch = originalFetch;
    window.fetch = (...args) => {
      const hms = isHmsApiUrl(args[0]);
      window.dispatchEvent(new CustomEvent("app-loading", { detail: 1 }));
      return originalFetch(...args)
        .then((res) => {
          if (hms) setBackendOffline(false);
          return res;
        })
        .catch((err) => {
          if (hms) setBackendOffline(true);
          throw err;
        })
        .finally(() => {
          window.dispatchEvent(new CustomEvent("app-loading", { detail: -1 }));
        });
    };
  }, []);

  const handleLogin = useCallback((userObj) => {
    const normalized = {
      ...userObj,
      id: userObj.id ?? userObj.userId ?? null,
    };
    setUser(normalized);
    localStorage.setItem("hms_user", JSON.stringify(normalized));
  }, []);

  const handleLogout = useCallback(async () => {
    const authSource = user?.authSource;
    setUser(null);
    clearAccessToken();
    localStorage.clear();

    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      }
    });

    if (AUTHENTIK_ENABLED && authSource === "authentik") {
      try {
        const um = new UserManager(oidcSettings);
        await um.signoutRedirect();
        return;
      } catch (e) {
        console.error("Authentik signout failed", e);
      }
    }
  }, [user]);

  const getDefaultRouteForUser = () => {
    if (!user) return "/login";
    if (user.role === "SUPERADMIN") return "/super-admin/overview";
    if (user.role === "ORG") return "/org/overview";
    if (user.role === "DOCTOR") return "/doctor/overview";
    if (user.role === "SERVICE_PROVIDER") return "/service-provider/overview";
    if (user.role === "PATIENT") return "/patient/overview";
    return "/login";
  };

  return (
    <ToastProvider>
      <BackendOfflineBanner />
      <GlobalLoader />
      {AUTHENTIK_ENABLED && <OidcSessionBridge />}
      <Router>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={getDefaultRouteForUser()} replace />}
          />

          {AUTHENTIK_ENABLED && (
            <Route
              path="/auth/callback"
              element={<AuthCallback onLogin={handleLogin} />}
            />
          )}

          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={getDefaultRouteForUser()} replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/super-admin/*"
            element={
              user?.role === "SUPERADMIN" ? (
                <SuperAdminDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/org/*"
            element={
              user?.role === "ORG" ? (
                <Dashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/doctor/*"
            element={
              user?.role === "DOCTOR" ? (
                <DoctorDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/service-provider/*"
            element={
              user?.role === "SERVICE_PROVIDER" ? (
                <ServiceProviderDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/patient/*"
            element={
              user?.role === "PATIENT" ? (
                <PatientDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}
