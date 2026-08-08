import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/pomp-logo.png", type: "image/png" }],
    apple: [{ url: "/pomp-logo.png" }],
  },
};

export default function PompLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
