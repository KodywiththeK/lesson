import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "마디마디 플랫폼 관리",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
