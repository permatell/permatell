import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { StoriesProcessProvider } from "@/contexts/StoriesProcessContext";
import { Navbar } from "@/components/ui/nav-bar";
import { StoryPointsProcessProvider } from "@/contexts/StoryPointsProcessContext";
import { AOSyncContextProvider } from "@/contexts/AOSyncContext";
import { DisclaimerPopup } from "@/components/ui/disclaimer-popup";
import { AOProfileProvider } from "@/contexts/AOProfileContext";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "@/lib/debug-polyfill";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PermaTell Dashboard",
  description: "PermaTell is a platform for creating and sharing stories on the Permaweb.",
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/favicon.svg' }
    ]
  },
  openGraph: {
    title: "PermaTell",
    description: "PermaTell is a platform for creating and sharing stories on the Permaweb.",
    images: [
      {
        url: "https://arweave.net/gLzmzrdbGiMkIzyxHP4lrjUzjD3CTle9-VMX_cvgXok",
      },
    ],
    url: "https://permatell.ar.io",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PermaTell",
    description: "PermaTell is a platform for creating and sharing stories on the Permaweb.",
    images: ["https://arweave.net/gLzmzrdbGiMkIzyxHP4lrjUzjD3CTle9-VMX_cvgXok"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <GoogleAnalytics />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black`}
        suppressHydrationWarning={true}
      >
        <div className="fixed inset-0 w-full h-full">
          <div className="absolute w-full h-[800vh] opacity-50">
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-500/30 to-cyan-500/30 blur-3xl animate-blob" />
            <div className="fixed top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-rose-500/30 to-orange-500/30 blur-3xl animate-blob animation-delay-2000" />
            <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-gradient-to-r from-blue-500/30 to-emerald-500/30 blur-3xl animate-blob animation-delay-4000" />
          </div>
        </div>
        <AOSyncContextProvider>
          <WalletProvider>
            <StoryPointsProcessProvider>
              <StoriesProcessProvider>
                <AOProfileProvider>
                  <Navbar />
                  <main>
                    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 relative">
                      {children}
                    </div>
                  </main>
                  <DisclaimerPopup />
                  <Toaster position="top-right" />
                </AOProfileProvider>
              </StoriesProcessProvider>
            </StoryPointsProcessProvider>
          </WalletProvider>
        </AOSyncContextProvider>
      </body>
    </html>
  );
}
