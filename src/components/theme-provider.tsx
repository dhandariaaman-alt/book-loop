"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// The whole site uses the light, pastel landing-page look.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
