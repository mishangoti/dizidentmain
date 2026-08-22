const flag = (name, fallback = false) => {
  const v = import.meta.env[name];
  if (v === undefined || v === "") return fallback;
  return String(v).toLowerCase() === "true";
};

export const AUTHENTIK_ENABLED = flag("VITE_AUTHENTIK_ENABLED", false);
export const LEGACY_AUTH_ENABLED = flag("VITE_LEGACY_AUTH_ENABLED", true);
export const SSO_GOOGLE_ENABLED = flag("VITE_AUTHENTIK_SSO_GOOGLE_ENABLED", false);
export const SSO_MICROSOFT_ENABLED = flag("VITE_AUTHENTIK_SSO_MICROSOFT_ENABLED", false);

export const oidcSettings = {
  authority: import.meta.env.VITE_AUTHENTIK_AUTHORITY || "http://localhost:9000/application/o/dizidental-hms/",
  client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID || "dizidental-hms-spa",
  redirect_uri:
    import.meta.env.VITE_AUTHENTIK_REDIRECT_URI || "http://localhost:5173/auth/callback",
  post_logout_redirect_uri:
    import.meta.env.VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI || "http://localhost:5173/login",
  response_type: "code",
  scope:
    import.meta.env.VITE_AUTHENTIK_SCOPES || "openid profile email offline_access hms",
  automaticSilentRenew: true,
};
