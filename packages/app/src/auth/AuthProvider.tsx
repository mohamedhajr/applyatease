import { AuthUser } from "@applyatease/contracts/auth";
import type { DesktopBridge } from "@applyatease/contracts/desktop";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Schema } from "effect";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { electronProxyClient } from "@better-auth/electron/proxy";
import { desktopAuthScheme } from "@applyatease/contracts/auth";

function makeClient(apiBaseUrl: string) {
  return createAuthClient({
    baseURL: new URL(`${apiBaseUrl}/auth`, window.location.href).href,
    plugins: [
      emailOTPClient(),
      electronProxyClient({ protocol: desktopAuthScheme }),
    ],
    fetchOptions: { credentials: "include", timeout: 15000 },
  });
}
type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "ready" | "error";
  client: ReturnType<typeof makeClient>;
  desktop: DesktopBridge | undefined;
  apiBaseUrl: string;
  notice: string;
  profileRevision: number;
  reloadProfile: () => void;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  apiBaseUrl,
  desktop,
}: {
  children: ReactNode;
  apiBaseUrl: string;
  desktop?: DesktopBridge | undefined;
}) {
  const [client] = useState(() => makeClient(apiBaseUrl));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [profileRevision, setProfileRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      let value: unknown;
      if (desktop) value = await desktop.getAuthUser();
      else {
        const response = await fetch(`${apiBaseUrl}/session`, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) value = null;
        else {
          if (!response.ok)
            throw new Error("Your session could not be checked.");
          const body: unknown = await response.json();
          value =
            body && typeof body === "object" && "user" in body
              ? body.user
              : undefined;
        }
      }
      const current = Schema.decodeUnknownSync(Schema.NullOr(AuthUser))(value);
      if (request === generation.current) {
        setUser(current);
        setStatus("ready");
      }
      return current;
    } catch {
      if (request === generation.current) setStatus("error");
      throw new Error("Your session could not be checked. Please retry.");
    }
  }, [apiBaseUrl, desktop]);
  useEffect(() => {
    const check = () => {
      void refresh().catch(() => {});
    };
    check();
    window.addEventListener("focus", check);
    const unsubscribe = desktop?.onAuthChanged((error) => {
      setNotice(error ?? "");
      check();
    });
    return () => {
      window.removeEventListener("focus", check);
      unsubscribe?.();
    };
  }, [refresh, desktop]);
  async function signOut() {
    ++generation.current;
    if (desktop) await desktop.signOut();
    else {
      const result = await client.signOut();
      if (result.error) throw new Error("Sign-out failed. Please retry.");
    }
    ++generation.current;
    sessionStorage.removeItem("applyatease.claim-profile");
    setUser(null);
    setStatus("ready");
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        client,
        apiBaseUrl,
        desktop,
        refresh,
        signOut,
        profileRevision,
        notice,
        reloadProfile: () => setProfileRevision((n) => n + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
