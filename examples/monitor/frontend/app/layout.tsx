import type { Metadata } from "next";
import { Providers } from "./providers";
import { AppHeader } from "@/components/layout/app-header/app-header";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Saga Monitor",
  description: "Real-time saga orchestration monitoring dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppHeader />
          <main className="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
