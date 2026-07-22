import { StrictMode } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link as RouterLinkBase } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { initAuthListener } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { ToastBridge } from "@/components/system/toast";
import App from "./App";
import "./index.css";

// Initialize auth listener once at app startup (advanced-init-once rule)
initAuthListener();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Adapter so every Astryx link-rendering component (SideNavItem, Link, etc.)
 * routes through react-router. Astryx passes `href`; react-router's Link needs
 * `to`. Wired globally via <LinkProvider component={RouterLink}>.
 */
type RouterLinkProps = Omit<ComponentPropsWithoutRef<typeof RouterLinkBase>, "to"> & {
  href?: string;
};
function RouterLink({ href = "", ...props }: RouterLinkProps) {
  return <RouterLinkBase to={href} {...props} />;
}

/** Reads persisted theme mode and feeds it to the root Astryx <Theme>. */
function Root() {
  const mode = useThemeStore((s) => s.mode);
  return (
    <Theme theme={neutralTheme} mode={mode}>
      <LinkProvider component={RouterLink}>
        <QueryClientProvider client={queryClient}>
          <ToastBridge />
          <App />
        </QueryClientProvider>
      </LinkProvider>
    </Theme>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>
);
