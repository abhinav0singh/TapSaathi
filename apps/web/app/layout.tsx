import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/*
  Inter for Latin, Noto Sans Devanagari for Hindi. Regular, medium and semibold only: the screens
  stay calm and let spacing, not weight, carry the hierarchy.
*/
const latin = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Sahara | Heat safety that keeps moving",
    template: "%s | Sahara",
  },
  description: "AWS-native heat-risk detection, rider guidance, safe reassignment, and supervisor escalation for delivery operations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Riders on bright screens often browse in a mobile browser: let them zoom.
  maximumScale: 5,
  themeColor: "#f2f2f7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", latin.variable, devanagari.variable)}>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
