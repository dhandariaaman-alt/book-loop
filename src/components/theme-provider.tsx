"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Pages that always use the light theme, whatever the visitor's setting.
const LIGHT_ONLY = new Set(["/"]);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={LIGHT_ONLY.has(pathname) ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
