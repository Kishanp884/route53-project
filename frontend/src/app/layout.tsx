import type { Metadata } from "next";
import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Route 53 Console (Clone)",
  description: "A functional clone of the Amazon Route 53 console - hosted zones and DNS records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
