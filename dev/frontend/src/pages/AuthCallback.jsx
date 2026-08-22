import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router-dom";
import api from "../api/api";
import { clearAccessToken, setAccessToken } from "../auth/tokenStore";

function defaultRouteForRole(role) {
  if (role === "SUPERADMIN") return "/super-admin/overview";
  if (role === "ORG") return "/org/overview";
  if (role === "DOCTOR") return "/doctor/overview";
  if (role === "SERVICE_PROVIDER") return "/service-provider/overview";
  if (role === "PATIENT") return "/patient/overview";
  return "/login";
}

function claimIdentity(profile = {}) {
  return {
    mobile:
      profile.mobile ||
      profile.preferred_username ||
      profile.nickname ||
      profile.username ||
      null,
    email: profile.email || null,
    sub: profile.sub || null,
  };
}

function formatIdentity(identity) {
  const parts = [];
  if (identity.mobile) parts.push(`user “${identity.mobile}”`);
  if (identity.email) parts.push(`email ${identity.email}`);
  if (identity.sub) parts.push(`sub ${identity.sub}`);
  return parts.length ? parts.join(", ") : "unknown Authentik identity";
}

export default function AuthCallback({ onLogin }) {
  const auth = useAuth();
  const [error, setError] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [doneUser, setDoneUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    if (auth.error) {
      setError(auth.error.message || "OIDC sign-in failed");
    }
  }, [auth.error]);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (finishing.current) return;
      if (!auth.isAuthenticated || !auth.user?.access_token) return;
      finishing.current = true;

      const id = claimIdentity(auth.user.profile || {});
      if (!cancelled) setIdentity(id);

      try {
        setAccessToken(auth.user.access_token);
        const res = await api.get("/auth/me");
        if (cancelled) return;
        const me = res.data;
        const userObj = {
          userId: me.userId,
          id: me.userId,
          mobile: me.mobile,
          role: me.role,
          email: me.email,
          authentikUserId: me.authentikUserId,
          name: me.mobile,
          authSource: "authentik",
        };
        onLogin(userObj);
        setDoneUser(userObj);
      } catch (e) {
        console.error(e);
        const status = e?.response?.status;
        const detail =
          e?.response?.data?.message ||
          e?.response?.data?.error_description ||
          e?.message ||
          "Signed in to Authentik but HMS /auth/me failed.";

        let hint = "";
        if (status === 401) {
          hint =
            ` Authentik signed you in as ${formatIdentity(id)}, but Clinic HMS has no matching user. ` +
            "Sign out of Authentik, then sign in with a seeded email (e.g. org@dizidental.local / org123). " +
            "Email or mobile on the login page is legacy-only and is not sent to Authentik.";
        }

        if (!cancelled) {
          setError(`${detail}${hint}`);
        }
        finishing.current = false;
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.user, onLogin]);

  const signOutOfAuthentik = async () => {
    setSigningOut(true);
    try {
      clearAccessToken();
      await auth.removeUser();
      await auth.signoutRedirect();
    } catch (e) {
      console.error(e);
      window.location.href = "/login";
    }
  };

  if (error) {
    return (
      <section className="auth bg-base d-flex flex-wrap">
        <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
          <div className="max-w-464-px mx-auto w-100 text-center">
            <h4 className="mb-12">Sign-in error</h4>
            <p className="mb-16 text-secondary-light">{error}</p>
            {identity && (
              <p className="mb-16 text-secondary-light text-sm">
                Authentik identity: <code>{identity.mobile || "(none)"}</code>
                {identity.email ? (
                  <>
                    {" "}
                    / <code>{identity.email}</code>
                  </>
                ) : null}
              </p>
            )}
            <p className="mb-24 text-secondary-light text-sm">
              Seed accounts use email on Authentik, e.g. <code>org@dizidental.local</code> /{" "}
              <code>org123</code> or <code>superadmin@dizidental.local</code> / <code>admin123</code>.
            </p>
            <div className="d-flex flex-column align-items-center">
              <button
                type="button"
                className="btn btn-primary btn-sm px-16 py-12 radius-12"
                onClick={signOutOfAuthentik}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out of Authentik & retry"}
              </button>
              <a href="/login" className="btn btn-outline-secondary btn-sm px-16 py-12 radius-12 mt-12">
                Back to login
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (doneUser) {
    return <Navigate to={defaultRouteForRole(doneUser.role)} replace />;
  }

  const profileMobile = claimIdentity(auth.user?.profile || {}).mobile;

  return (
    <section className="auth bg-base d-flex flex-wrap">
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center w-100">
        <div className="max-w-464-px mx-auto w-100 text-center">
          <h4 className="mb-12">Completing sign-in</h4>
          <p className="text-secondary-light">
            {auth.isLoading || !auth.isAuthenticated
              ? "Finishing Authentik login…"
              : `Loading clinic profile${profileMobile ? ` for ${profileMobile}` : ""}…`}
          </p>
        </div>
      </div>
    </section>
  );
}
