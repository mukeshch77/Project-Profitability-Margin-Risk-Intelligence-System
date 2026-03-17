import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Profitability Risk Dashboard",
  description: "Margin risk intelligence with explainable alerts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="main-shell">{children}</div>
      </body>
    </html>
  );
}
