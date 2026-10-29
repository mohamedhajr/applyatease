import thirdPartyNotices from "../../../THIRD_PARTY_NOTICES.txt?url";
import { Button } from "./components/ui/button.tsx";
import { AuthProvider, useAuth } from "./auth/AuthProvider.tsx";
import { SignIn } from "./auth/SignIn.tsx";
import { profileKey } from "./onboarding/storage.ts";
import type { DesktopBridge } from "@applyatease/contracts/desktop";
import { Health } from "@applyatease/contracts/health";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  createBrowserHistory,
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Navigate,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { Schema } from "effect";
import {
  Archive,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  Flag,
  Inbox,
  Settings,
  Sprout,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Onboarding } from "./onboarding/Onboarding.tsx";
import { ProfilePage } from "./profile/ProfilePage.tsx";
import { ProfileProvider, useProfile } from "./onboarding/ProfileProvider.tsx";
import { OpportunityWorkspace } from "./workspace/OpportunityWorkspace.tsx";

type Platform =
  | { readonly kind: "web" }
  | { readonly kind: "desktop"; readonly bridge: DesktopBridge };
type AppContext = { platform: Platform; apiBaseUrl: string };
const rootRoute = createRootRouteWithContext<AppContext>()({
  component: Shell,
});
const opportunitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <OpportunityWorkspace view="all" />,
});
const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jobs",
  component: () => <OpportunityWorkspace view="saved" />,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: () => <OpportunityWorkspace view="review" />,
});
const archiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/archive",
  component: () => <OpportunityWorkspace view="archived" />,
});
const applicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications",
  component: Applications,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: ProfilePage,
});
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: Onboarding,
});
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignIn,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Preferences,
});

function makeRouter(context: AppContext) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      opportunitiesRoute,
      jobsRoute,
      reviewRoute,
      archiveRoute,
      applicationsRoute,
      profileRoute,
      onboardingRoute,
      signInRoute,
      settingsRoute,
    ]),
    history:
      context.platform.kind === "desktop"
        ? createHashHistory()
        : createBrowserHistory(),
    context,
  });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
export function App({
  platform,
  apiBaseUrl = "/api",
}: {
  platform: Platform;
  apiBaseUrl?: string;
}) {
  const [router] = useState(() => makeRouter({ platform, apiBaseUrl }));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        apiBaseUrl={apiBaseUrl}
        desktop={platform.kind === "desktop" ? platform.bridge : undefined}
      >
        <AccountProfile>
          <RouterProvider router={router} />
        </AccountProfile>
      </AuthProvider>
    </QueryClientProvider>
  );
}
function AccountProfile({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading")
    return (
      <div className="auth-loading" role="status">
        Opening your workspace…
      </div>
    );
  const key = profileKey(auth.user?.id);
  return (
    <ProfileProvider key={`${key}:${auth.profileRevision}`} storageKey={key}>
      {children}
    </ProfileProvider>
  );
}
const navigation = [
  { to: "/", label: "All opportunities", icon: Inbox },
  { to: "/jobs", label: "Saved jobs", icon: Bookmark },
  { to: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { to: "/profile", label: "Your profile", icon: FileText },
] as const;
const views = [
  { to: "/review", label: "Needs review", icon: Flag },
  { to: "/archive", label: "Archived", icon: Archive },
] as const;
function Shell() {
  const main = useRef<HTMLElement>(null);
  const auth = useAuth();
  const profile = useProfile();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  if (pathname === "/sign-in") return <Outlet />;
  if (auth.status === "error" && auth.user)
    return (
      <div className="auth-loading">
        <p role="alert">Your session could not be verified.</p>
        <Button onClick={() => void auth.refresh().catch(() => {})}>
          Retry
        </Button>
      </div>
    );
  if (pathname === "/onboarding") return <Outlet />;
  if (!auth.user && profile.data?.profile.confirmedAt)
    return <Navigate to="/sign-in" replace />;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <Link to="/" className="brand" aria-label="Apply at Ease home">
          <span className="brand-mark">
            <Sprout size={20} aria-hidden="true" />
          </span>
          <span className="brand-name">
            apply<span>atease</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <p className="nav-caption">Workspace</p>
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className="nav-link"
              activeProps={{
                className: "nav-link is-active",
                "aria-current": "page",
              }}
              activeOptions={{ exact: true }}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <nav className="saved-views" aria-label="Opportunity views">
          <p className="nav-caption">Views</p>
          {views.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className="nav-link"
              activeProps={{
                className: "nav-link is-active",
                "aria-current": "page",
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="approval-note">
            <span className="approval-symbol">
              <Flag size={15} aria-hidden="true" />
            </span>
            <strong>You’re in control</strong>
            <p>Every application is yours to review before it’s sent.</p>
          </div>
          <Link
            to="/settings"
            title="Settings"
            aria-label="Settings"
            className="nav-link"
            activeProps={{
              className: "nav-link is-active",
              "aria-current": "page",
            }}
          >
            <Settings size={17} aria-hidden="true" />
            <span>Settings</span>
          </Link>
          <div className="workspace-label">
            <span className="workspace-avatar">A</span>
            <span>
              {auth.user?.name || "Personal workspace"}
              <small>{auth.user?.email || "Apply at Ease"}</small>
            </span>
          </div>
        </div>
      </aside>
      <main ref={main} id="main" tabIndex={-1} className="workspace-main">
        <Outlet />
      </main>
    </div>
  );
}
function EmptyPage({
  title,
  description,
  message,
  detail,
}: {
  title: string;
  description: string;
  message: string;
  detail: string;
}) {
  return (
    <section className="page-panel">
      <header className="panel-header">
        <h1>{title}</h1>
      </header>
      <div className="page">
        <p className="lead">{description}</p>
        <div className="empty-state">
          <span className="empty-symbol">
            <FileText size={24} aria-hidden="true" />
          </span>
          <h2>{message}</h2>
          <p>{detail}</p>
          <Link to="/" className="text-link">
            Back to opportunities <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
function Applications() {
  return (
    <EmptyPage
      title="Applications"
      description="Your materials, reviews and progress, in one place."
      message="Your applications start here"
      detail="Application preparation and tracking will be available here. Nothing has been submitted."
    />
  );
}
function Preferences() {
  const { platform, apiBaseUrl } = rootRoute.useRouteContext();
  const connection = useQuery({
    queryKey: ["health", apiBaseUrl],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${apiBaseUrl}/health/ready`, { signal });
      if (!response.ok) throw new Error("Service unavailable");
      return Schema.decodeUnknownSync(Health)(await response.json());
    },
  });
  const runtime = useQuery({
    queryKey: ["desktop-runtime"],
    enabled: platform.kind === "desktop",
    queryFn: () =>
      platform.kind === "desktop"
        ? platform.bridge.getRuntime()
        : Promise.resolve(null),
  });
  return (
    <section className="page-panel">
      <header className="panel-header">
        <h1>Settings</h1>
      </header>
      <div className="page">
        <div className="page-heading compact">
          <p className="lead">Your app and connection.</p>
        </div>
        <section className="settings-panel" aria-label="Application settings">
          <AccountSettings />
          <div className="setting-row">
            <div>
              <h2>Application</h2>
              <p>{platform.kind === "desktop" ? "Desktop app" : "Web app"}</p>
            </div>
            {runtime.data && (
              <span className="setting-value">
                Version {runtime.data.appVersion}
              </span>
            )}
          </div>
          <div className="setting-row">
            <div>
              <h2>Connection</h2>
              <p role="status">
                {connection.isPending
                  ? "Checking connection…"
                  : connection.data?.status === "ok"
                    ? "Connected"
                    : "Service unavailable. Please try again."}
              </p>
            </div>
            <Button
              variant="outline"
              className="button"
              onClick={() => void connection.refetch()}
              disabled={connection.isFetching}
            >
              Retry connection
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <h2>Open-source components</h2>
              <p>Licenses for included interface components and fonts.</p>
            </div>
            <a
              className="text-link"
              href={thirdPartyNotices}
              download="THIRD_PARTY_NOTICES.txt"
            >
              Third-party notices
            </a>
          </div>
          {runtime.isError && (
            <p role="alert" className="runtime-error">
              The desktop service is unavailable. Restart the app to try again.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function AccountSettings() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="setting-row">
      <div>
        <h2>Account</h2>
        <p>
          {auth.user
            ? auth.user.email
            : "Sign in after completing your profile."}
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      {auth.user ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void auth
              .signOut()
              .catch(() =>
                setError("Sign-out could not be completed. Please retry."),
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      ) : (
        <Link to="/onboarding" className="button">
          Set up your profile
        </Link>
      )}
    </div>
  );
}
