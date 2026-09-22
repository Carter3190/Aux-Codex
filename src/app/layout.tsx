import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { getPublicAppUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: "Auxilium | Local help, made human",
    template: "%s | Auxilium",
  },
  description:
    "Find trusted local professionals or grow your independent service business with Auxilium.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
