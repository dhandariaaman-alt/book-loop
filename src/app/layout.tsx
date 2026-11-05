import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { PageBackdrop } from "@/components/page-backdrop";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BookLoop: share books with your neighbours", template: "%s · BookLoop" },
  description: "Borrow, exchange, give away and donate books within your local community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <PageBackdrop />
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">
            Skip to content
          </a>
          <Navbar />
          <main id="main">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">
            © {new Date().getFullYear()} BookLoop · Every book deserves another reader.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
