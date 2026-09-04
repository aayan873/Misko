import type { Metadata } from "next";

export const metadata: Metadata = { title: "Spot the Mistake" };

export default function SpotTheMistakeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
