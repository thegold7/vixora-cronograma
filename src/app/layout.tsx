import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "VIXORA Cronograma 2026",
  description: "Sistema de asignación de actividades para técnicos VIXORA.",
  keywords: ["VIXORA", "cronograma", "técnicos", "asignación"],
  authors: [{ name: "VIXORA" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
