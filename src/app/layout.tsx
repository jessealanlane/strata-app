import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StrataVote – BCS Southport",
  description: "Mobile-first voting and updates for Body Corporate committees"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

