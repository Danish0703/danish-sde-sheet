import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Danish SDE Sheet — Pattern-first interview prep",
  description: "A pattern-first DSA practice product for coding interviews.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
