import type { Metadata } from "next";
import { Inter, Gantari } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Tipografía de títulos, la misma de la página de Ambit
const gantari = Gantari({ subsets: ["latin"], variable: "--font-gantari", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Panel Operativo KFC | Ambit",
  description: "Dashboard operativo de delivery para KFC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${gantari.variable}`}>
      <body className={inter.className}>
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
