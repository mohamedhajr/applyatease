import { Button } from "@base-ui/react/button";
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
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Schema } from "effect";
import {
  ArrowRight,
  Briefcase,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  Sprout,
} from "lucide-react";
import { useState } from "react";

type Platform =
  | { readonly kind: "web" }
  | { readonly kind: "desktop"; readonly bridge: DesktopBridge };
type AppContext = { platform: Platform; apiBaseUrl: string };

const rootRoute = createRootRouteWithContext<AppContext>()({
  component: Shell,
});
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Overview,
});
const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/jobs",
  component: Jobs,
});
const applicationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/applications",
  component: Applications,
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: Profile,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Preferences,
});

function makeRouter(context: AppContext) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      overviewRoute,
      jobsRoute,
      applicationsRoute,
      profileRoute,
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/jobs", label: "Saved jobs", icon: Search },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/profile", label: "Your profile", icon: FileText },
] as const;

function Shell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="Apply at Ease home">
          <span className="brand-mark">
            <Sprout aria-hidden="true" size={22} />
          </span>
          <span>
            apply<span className="brand-light">atease</span>
          </span>
        </Link>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="nav-link"
              activeProps={{
                className: "nav-link is-active",
                "aria-current": "page",
              }}
              activeOptions={{ exact: true }}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            to="/settings"
            className="nav-link"
            activeProps={{
              className: "nav-link is-active",
              "aria-current": "page",
            }}
          >
            <Settings size={18} aria-hidden="true" />
            Settings
          </Link>
          <p>
            A little more ease.
            <br />A step closer to what’s next.
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Your next chapter</span>
          <span className="private-label">
            <span aria-hidden="true" />
            Your decisions. Your pace.
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer>You review every application before it’s sent.</footer>
      </div>
    </div>
  );
}

function Overview() {
  return (
    <div className="page overview">
      <div className="page-heading">
        <p className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</p>
        <h1>
          Your next move,
          <br />
          <span>with a little more ease.</span>
        </h1>
        <p className="lead">
          A place to bring your experience, opportunities and applications
          together.
        </p>
      </div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-art" aria-hidden="true">
          <Sprout size={62} strokeWidth={1.2} />
        </div>
        <div>
          <p className="eyebrow">A FRESH START</p>
          <h2 id="welcome-title">Your workspace starts here</h2>
          <p>
            Get familiar with your space. Your career information belongs in
            your profile, and every application stays yours to review.
          </p>
          <Link to="/profile" className="text-link">
            Explore your profile <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className="journey" aria-labelledby="journey-title">
        <div className="section-heading">
          <h2 id="journey-title">A clearer path forward</h2>
          <span>One step at a time</span>
        </div>
        <div className="journey-grid">
          <Link to="/profile" className="journey-step">
            <span className="step-number">01</span>
            <FileText size={21} aria-hidden="true" />
            <h3>Start with your story</h3>
            <p>Your experience and preferences set the direction.</p>
            <span className="text-link">
              Your profile <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
          <Link to="/jobs" className="journey-step">
            <span className="step-number">02</span>
            <Search size={21} aria-hidden="true" />
            <h3>Find your next opportunity</h3>
            <p>Keep the roles that matter to you in one place.</p>
            <span className="text-link">
              Saved jobs <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
          <Link to="/applications" className="journey-step">
            <span className="step-number">03</span>
            <Briefcase size={21} aria-hidden="true" />
            <h3>Apply with intention</h3>
            <p>Review your materials and follow each application.</p>
            <span className="text-link">
              Applications <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>
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
    <div className="page">
      <div className="page-heading compact">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
      </div>
      <section className="empty-state">
        <Sprout size={36} strokeWidth={1.4} aria-hidden="true" />
        <h2>{message}</h2>
        <p>{detail}</p>
        <Link to="/" className="text-link">
          Back to overview <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
function Jobs() {
  return (
    <EmptyPage
      title="Saved jobs"
      description="Keep your next opportunities within reach."
      message="A place for your shortlist"
      detail="Job discovery and saving will be available here."
    />
  );
}
function Applications() {
  return (
    <EmptyPage
      title="Applications"
      description="A clear view of every step you take."
      message="Your applications, together"
      detail="Application preparation and tracking will be available here. Nothing has been submitted."
    />
  );
}
function Profile() {
  return (
    <EmptyPage
      title="Your profile"
      description="Your experience is the starting point."
      message="Make space for your story"
      detail="CV import and career preferences will be available here."
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
    <div className="page">
      <div className="page-heading compact">
        <p className="eyebrow">MAKE IT YOURS</p>
        <h1>Settings</h1>
        <p className="lead">Your app and connection.</p>
      </div>
      <section className="settings-panel" aria-label="Application settings">
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
            className="button"
            onClick={() => void connection.refetch()}
            disabled={connection.isFetching}
          >
            Retry connection
          </Button>
        </div>
        {runtime.isError && (
          <p role="alert" className="runtime-error">
            The desktop service is unavailable. Restart the app to try again.
          </p>
        )}
      </section>
    </div>
  );
}
