import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CraneOps | Fleet command center",
  description: "Tower crane fleet, sites, faults and maintenance management.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
