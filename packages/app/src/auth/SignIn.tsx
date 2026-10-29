import { AuthCapabilities } from "@applyatease/contracts/auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
  Mail,
  Sprout,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import { SaveStatus } from "../onboarding/ProfileReview.tsx";
import { claimOnboardingProfile } from "../onboarding/storage.ts";
import { useAuth } from "./AuthProvider.tsx";
import "./auth.css";

function desktopRequest() {
  const params = new URLSearchParams(window.location.search);
  const client_id = params.get("client_id");
  const state = params.get("state");
  const code_challenge = params.get("code_challenge");
  if (
    client_id !== "electron" ||
    !state ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(state) ||
    !code_challenge ||
    !/^[a-zA-Z0-9_-]{43}$/.test(code_challenge)
  )
    return undefined;
  return { client_id, state, code_challenge };
}

export function SignIn() {
  const auth = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [returned, setReturned] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).has("error")
      ? "Sign-in wasn’t completed. Please try again or choose another method."
      : "",
  );
  const [cooldown, setCooldown] = useState(0);
  const [request] = useState(desktopRequest);
  const completing = useRef(false);
  const capabilities = useQuery({
    queryKey: ["auth-options", auth.apiBaseUrl],
    queryFn: async ({ signal }) => {
      if (auth.desktop)
        return Schema.decodeSync(AuthCapabilities)(
          await auth.desktop.getAuthCapabilities(),
        );
      const response = await fetch(`${auth.apiBaseUrl}/auth-options`, {
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Sign-in is unavailable.");
      return Schema.decodeUnknownSync(AuthCapabilities)(await response.json());
    },
  });
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const returnToDesktop = useCallback(() => {
    auth.client.ensureElectronRedirect();
    setReturned(true);
  }, [auth.client]);
  const finish = useCallback(
    async (choice?: "new" | "saved") => {
      if (auth.status !== "ready" || !auth.user || completing.current) return;
      completing.current = true;
      setBusy(true);
      setError("");
      try {
        if (request && !auth.desktop) {
          const result = await auth.client.electron.transferUser({
            fetchOptions: { query: request },
          });
          if (result.error)
            throw new Error(
              "Could not return to the desktop app. Please restart sign-in from the app.",
            );
          returnToDesktop();
          return;
        }
        if (sessionStorage.getItem("applyatease.claim-profile")) {
          const result = await claimOnboardingProfile(auth.user.id, choice);
          if (result === "conflict") {
            setConflict(true);
            return;
          }
          sessionStorage.removeItem("applyatease.claim-profile");
          auth.reloadProfile();
        }
        await navigate({ to: "/profile", replace: true });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not finish sign-in. Please retry.",
        );
      } finally {
        completing.current = false;
        setBusy(false);
      }
    },
    [auth, request, navigate, returnToDesktop],
  );
  const finishOnSignIn = useEffectEvent(() => {
    if (!request) void finish();
  });
  const userId = auth.user?.id;
  useEffect(() => {
    let active = true;
    if (auth.status === "ready" && userId) {
      queueMicrotask(() => {
        if (active) finishOnSignIn();
      });
    }
    return () => {
      active = false;
    };
  }, [auth.status, userId]);
  useEffect(() => {
    if (
      !auth.user &&
      profile.status === "saved" &&
      profile.data?.profile.confirmedAt
    )
      sessionStorage.setItem("applyatease.claim-profile", "true");
  }, [auth.user, profile.status, profile.data?.profile.confirmedAt]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign-in could not be completed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const saved = profile.status === "saved";
  const disabled = busy || auth.status !== "ready" || !saved;
  const configured =
    capabilities.data && Object.values(capabilities.data).some(Boolean);
  async function sendCode() {
    const result = await auth.client.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    if (result.error)
      throw new Error(
        result.error.status === 429
          ? "Too many requests. Wait a minute before trying again."
          : "Your code could not be sent. Check your email address and try again.",
      );
    setSent(true);
    setCode("");
    setCooldown(60);
  }
  async function social(provider: "google" | "apple") {
    const callbackURL = new URL("/sign-in", window.location.href);
    if (request)
      for (const [key, value] of Object.entries(request))
        callbackURL.searchParams.set(key, value);
    const errorURL = new URL(callbackURL);
    errorURL.searchParams.set("error", "provider");
    const result = await auth.client.signIn.social({
      provider,
      callbackURL: callbackURL.href,
      errorCallbackURL: errorURL.href,
      fetchOptions: request ? { query: request } : {},
    });
    if (result.error)
      throw new Error("This sign-in method is unavailable. Please try again.");
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" className="brand" aria-label="Apply at Ease home">
          <span className="brand-mark">
            <Sprout size={20} aria-hidden="true" />
          </span>
          <span className="brand-name">
            apply<span>atease</span>
          </span>
        </Link>
        <span className="auth-header-label">
          <LockKeyhole size={14} aria-hidden="true" /> Your next move, on your
          terms
        </span>
      </header>
      <main className="auth-layout">
        <aside className="auth-story" aria-label="Your workspace">
          <span className="auth-eyebrow">
            A little clarity. A better next move.
          </span>
          <h2>
            A workspace for
            <br />
            what comes next.
          </h2>
          <p>
            Keep your experience, opportunities and decisions together. Stay in
            control of every application.
          </p>
          <ol className="auth-steps">
            <li>
              <span>
                <Check size={15} />
              </span>
              <div>
                <strong>Make it yours</strong>
                <p>Your experience and preferences.</p>
              </div>
            </li>
            <li aria-current="step">
              <span>02</span>
              <div>
                <strong>Sign in to your workspace</strong>
                <p>One simple step to continue.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Review your next move</strong>
                <p>Every decision stays with you.</p>
              </div>
            </li>
          </ol>
          <div className="auth-privacy">
            <LockKeyhole size={18} aria-hidden="true" />
            <p>
              Your profile is stored on this device. Every application needs
              your approval before it’s sent.
            </p>
          </div>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <span className="auth-card-icon">
            <Mail size={23} aria-hidden="true" />
          </span>
          <p className="auth-eyebrow">Your workspace awaits</p>
          <h1 id="auth-title">
            {returned
              ? "You’re signed in"
              : auth.user && request
                ? "Continue to the desktop app"
                : conflict
                  ? "Choose your profile"
                  : sent
                    ? "Check your inbox"
                    : waiting
                      ? "Continue in your browser"
                      : "Your next chapter starts here"}
          </h1>
          <p className="auth-description">
            {returned
              ? "Return to Apply at Ease to continue with your profile."
              : conflict
                ? "This account already has a profile on this device. Choose which one to keep."
                : sent
                  ? `Enter the 6-digit code sent to ${email.trim()}. It expires in 5 minutes.`
                  : waiting
                    ? "Finish signing in there, then return to this window. Your profile is saved."
                    : "Sign in or create an account. No password to remember."}
          </p>
          {auth.user ? (
            <div className="auth-actions">
              {conflict ? (
                <>
                  <Button
                    size="lg"
                    disabled={disabled}
                    onClick={() => void finish("new")}
                  >
                    Use the profile I just created
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => void finish("saved")}
                  >
                    Keep my existing profile
                  </Button>
                  <p className="auth-note">
                    The other local profile will be replaced. Your original CV
                    stays with the profile you keep.
                  </p>
                </>
              ) : (
                <Button
                  size="lg"
                  disabled={disabled}
                  onClick={() => void finish()}
                >
                  {busy
                    ? "Finishing sign-in…"
                    : returned
                      ? "Open Apply at Ease"
                      : "Continue"}
                  <ArrowRight />
                </Button>
              )}
              <p className="auth-note">Signed in as {auth.user.email}</p>
              <Button
                variant="link"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const claim = sessionStorage.getItem(
                      "applyatease.claim-profile",
                    );
                    await auth.signOut();
                    if (claim)
                      sessionStorage.setItem(
                        "applyatease.claim-profile",
                        claim,
                      );
                    setConflict(false);
                    setReturned(false);
                  })
                }
              >
                Use a different account
              </Button>
            </div>
          ) : auth.desktop ? (
            <div className="auth-actions">
              <Button
                size="lg"
                disabled={disabled || !configured}
                onClick={() =>
                  void run(async () => {
                    await auth.desktop?.requestAuth();
                    setWaiting(true);
                  })
                }
              >
                {waiting ? "Reopen sign-in" : "Continue in your browser"}
                <ExternalLink />
              </Button>
              <p className="auth-note">
                Choose email, Google or Apple in your browser.
              </p>
              {waiting && (
                <Button variant="link" onClick={() => setWaiting(false)}>
                  Cancel
                </Button>
              )}
            </div>
          ) : sent ? (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const result = await auth.client.signIn.emailOtp({
                    email: email.trim(),
                    otp: code,
                    fetchOptions: request ? { query: request } : {},
                  });
                  if (result.error)
                    throw new Error(
                      "That code is invalid or expired. Check it or request a new one.",
                    );
                  await auth.refresh();
                });
              }}
            >
              <label htmlFor="sign-in-code">Verification code</label>
              <Input
                id="sign-in-code"
                className="auth-code"
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                disabled={busy}
              />
              <Button
                type="submit"
                size="lg"
                disabled={disabled || code.length !== 6}
              >
                {busy ? "Checking code…" : "Verify & continue"}
                <ArrowRight />
              </Button>
              <Button
                variant="link"
                disabled={busy || cooldown > 0}
                onClick={() => void run(sendCode)}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                }}
              >
                <ArrowLeft /> Use a different email
              </Button>
            </form>
          ) : (
            <>
              <div className="auth-social">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={disabled || !capabilities.data?.google}
                  onClick={() => void run(() => social("google"))}
                >
                  <span className="provider-mark" aria-hidden="true">
                    G
                  </span>
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={disabled || !capabilities.data?.apple}
                  onClick={() => void run(() => social("apple"))}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M17.1 12.3c0-2 1.7-3 1.8-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.3.7-2.9.7-.6 0-1.5-.7-2.5-.7-1.3 0-2.4.7-3.1 1.8-1.3 2.2-.3 5.5 1 7.3.6.9 1.3 1.9 2.3 1.9.9 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.6-.9 2.2-1.8c.7-1 1-2 1-2.1-.1 0-1.9-.8-1.9-2.4ZM15.2 6.4c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.3 1.1-.5.5-1 1.5-.9 2.3.9.1 1.8-.4 2.4-1Z" />
                  </svg>
                  Continue with Apple
                </Button>
              </div>
              <div className="auth-divider">
                <span>or use your email</span>
              </div>
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(sendCode);
                }}
              >
                <label htmlFor="sign-in-email">Email address</label>
                <Input
                  id="sign-in-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy || !capabilities.data?.email}
                />
                <Button
                  size="lg"
                  type="submit"
                  disabled={disabled || !capabilities.data?.email}
                >
                  {busy ? "Sending your code…" : "Continue with email"}
                  <ArrowRight />
                </Button>
              </form>
            </>
          )}
          {auth.notice && (
            <p className="auth-error" role="alert">
              {auth.notice}
            </p>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {auth.status === "error" && (
            <div className="auth-notice" role="alert">
              Your session could not be checked.{" "}
              <Button
                variant="link"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await auth.refresh();
                  })
                }
              >
                Retry
              </Button>
            </div>
          )}
          {capabilities.isPending && (
            <p className="auth-note" role="status">
              Loading sign-in options…
            </p>
          )}
          {capabilities.isError && (
            <div className="auth-notice" role="alert">
              Sign-in is temporarily unavailable.{" "}
              <Button
                variant="link"
                onClick={() => void capabilities.refetch()}
              >
                Retry
              </Button>
            </div>
          )}
          {capabilities.data && !configured && (
            <p className="auth-notice" role="status">
              Sign-in hasn’t been configured for this installation yet.
              {profile.data && profile.data.revision > 0 && !request
                ? " Your onboarding draft is saved on this device."
                : " Try again after a sign-in method is enabled."}
            </p>
          )}
          {configured &&
            Object.values(capabilities.data).some((enabled) => !enabled) && (
              <p className="auth-note">
                Unavailable methods are not configured for this installation.
              </p>
            )}
          {!saved && <SaveStatus detailed />}
          {!request && !auth.user && (
            <Link to="/onboarding" className="auth-back">
              <ArrowLeft size={14} /> Back to your profile
            </Link>
          )}
        </section>
      </main>
      <footer className="auth-footer">
        A thoughtful next step. At your own pace.
      </footer>
    </div>
  );
}
