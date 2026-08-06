import Link from "next/link";
import { FaTelegramPlane } from "react-icons/fa";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";

const socialLinks = [
  {
    href: "https://x.com/PermaTell",
    label: "PermaTell on X",
    icon: FaXTwitter,
  },
  {
    href: "https://t.me/pgsverify",
    label: "Protocol Growth Studio on Telegram",
    icon: FaTelegramPlane,
  },
  {
    href: "https://discord.com/invite/ESn8edRJ5s",
    label: "PermaTell on Discord",
    icon: FaDiscord,
  },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-12 border-t border-gray-800/90 bg-black/30">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 text-sm text-gray-500 sm:px-6 lg:px-8">
        <nav aria-label="Community links" className="flex items-center gap-3">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-900/70 text-gray-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <p className="text-center">
          PermaTell is a product of Protocol Growth Studio · 2026
        </p>
        <div className="flex w-full items-center justify-between gap-4 border-t border-gray-800/70 pt-4 text-xs">
          <Link href="/disclaimer" className="transition-colors hover:text-white">
            Disclaimer
          </Link>
          <span>Alpha Version</span>
        </div>
      </div>
    </footer>
  );
}
