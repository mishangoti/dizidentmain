import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { setAccessToken } from "./tokenStore";

/** Keeps axios Bearer token in sync with the OIDC user session. */
export default function OidcSessionBridge() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.access_token) {
      setAccessToken(auth.user.access_token);
    }
  }, [auth.isAuthenticated, auth.user]);

  return null;
}
