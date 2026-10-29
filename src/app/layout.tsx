import type { Metadata, Viewport } from "next";
import { Inter, Kaushan_Script, Montserrat } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgeGate } from "@/components/site/age-gate";
import { getLocale } from "@/lib/i18n/server";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const script = Kaushan_Script({ variable: "--font-script", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Poppsie – Escort & Community 18+", template: "%s · Poppsie" },
  description: "Die diskrete Community für Erwachsene in der Schweiz: verifizierte Escorts, Clubs und Studios, echte Berichte und direkte Buchung.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#141619", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const ageOk = (await cookies()).get("pp_age")?.value === "1";
  return (
    <html lang={locale} className="dark">
      <body className={`${inter.variable} ${montserrat.variable} ${script.variable} min-h-dvh`}>
        <TooltipProvider>
          {children}
          {!ageOk && <AgeGate />}
          <Toaster position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
