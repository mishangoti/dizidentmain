import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import api from "../api/api";
import {
  AUTHENTIK_ENABLED,
  LEGACY_AUTH_ENABLED,
  SSO_GOOGLE_ENABLED,
  SSO_MICROSOFT_ENABLED,
} from "../auth/authFlags";

function AuthentikSignInButton({ label = "Sign in with Authentik", hint }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      if (hint) {
        sessionStorage.setItem("hms_oidc_sso_hint", hint);
      }
      // Force credential prompt so a leftover akadmin session is not reused silently
      await auth.signinRedirect({ prompt: "login" });
    } catch (e) {
      console.error(e);
      alert("Could not start Authentik login.");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-outline-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-12"
      onClick={start}
      disabled={busy || auth.isLoading}
    >
      {busy ? "Redirecting…" : label}
    </button>
  );
}

export default function LoginPage({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!LEGACY_AUTH_ENABLED) {
      alert("Legacy login is disabled. Use Authentik.");
      return;
    }
    if (!identifier || !password) {
      alert("Please enter email or mobile, and password");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/login", { identifier, password });
      onLogin({ ...res.data, authSource: "legacy" });
    } catch (err) {
      console.error(err);
      alert("Login failed. Please check email/mobile and password.");
    } finally {
      setLoading(false);
    }
  };

  const showSsoRow = AUTHENTIK_ENABLED && (SSO_GOOGLE_ENABLED || SSO_MICROSOFT_ENABLED);

  return (
    <section className="auth bg-base d-flex flex-wrap">
      <div className="auth-left d-lg-block d-none">
        <div className="d-flex align-items-center flex-column h-100 justify-content-center">
          <img src="/images/auth/auth-img.png" alt="Clinic login" />
        </div>
      </div>
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
        <div className="max-w-464-px mx-auto w-100">
          <div>
            <a href="/" className="mb-40 max-w-290-px d-inline-block">
              <img src="/images/logo.png" alt="Clinic Dashboard" />
            </a>
            <h4 className="mb-12">Sign In to your Account</h4>
            <p className="mb-16 text-secondary-light text-lg">
              {AUTHENTIK_ENABLED && LEGACY_AUTH_ENABLED
                ? "Use clinic credentials or Sign in with Authentik / SSO."
                : AUTHENTIK_ENABLED
                  ? "Sign in with Authentik or SSO."
                  : "Welcome back! Please enter your details."}
            </p>
            {AUTHENTIK_ENABLED && (
              <p className="mb-32 text-secondary-light text-sm">
                Authentik / SSO uses <strong>email only</strong> (e.g.{" "}
                <code>org@dizidental.local</code>). Email or mobile below is for legacy Sign In.
              </p>
            )}
          </div>

          {LEGACY_AUTH_ENABLED && (
            <form onSubmit={handleSubmit}>
              <div className="icon-field mb-16">
                <span className="icon top-50 translate-middle-y">
                  <i className="ri-user-line"></i>
                </span>
                <input
                  type="text"
                  className="form-control h-56-px bg-neutral-50 radius-12"
                  placeholder="Email or mobile number"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="position-relative mb-20">
                <div className="icon-field">
                  <span className="icon top-50 translate-middle-y">
                    <i className="ri-lock-2-line"></i>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control h-56-px bg-neutral-50 radius-12"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="toggle-password ri-eye-line cursor-pointer position-absolute end-0 top-50 translate-middle-y me-16 text-secondary-light"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                ></button>
              </div>

              <button
                type="submit"
                className="btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-16"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Sign In"}
              </button>
            </form>
          )}

          {AUTHENTIK_ENABLED && LEGACY_AUTH_ENABLED && (
            <div className="text-center my-16 text-secondary-light">or</div>
          )}

          {AUTHENTIK_ENABLED && (
            <>
              <AuthentikSignInButton label="Sign in with Authentik" hint="password" />
              <p className="mt-12 text-secondary-light text-sm text-center">
                On the Authentik screen use a seeded email / password, e.g.{" "}
                <code>org@dizidental.local</code> / <code>org123</code>.
              </p>
            </>
          )}

          {showSsoRow && (
            <>
              <div className="text-center my-16 text-secondary-light">SSO</div>
              {SSO_GOOGLE_ENABLED && (
                <AuthentikSignInButton label="Continue with Google" hint="google" />
              )}
              {SSO_MICROSOFT_ENABLED && (
                <AuthentikSignInButton label="Continue with Microsoft" hint="microsoft" />
              )}
              <p className="mt-12 text-secondary-light text-sm">
                Choose Google or Microsoft on the Authentik sign-in screen (sources must be
                configured — see Authentik SSO checklist).
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
