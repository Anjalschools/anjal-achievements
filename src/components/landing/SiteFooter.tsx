"use client";

import { Instagram, Mail, Twitter, Youtube } from "lucide-react";

const SnapchatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003 1.847h2.048c1.509 0 2.81.753 3.59 2.006.896 1.451.89 3.333-.01 4.773-.857 1.36-2.02 2.24-3.58 2.24h-2.05v2.894c0 3.06-2.474 5.544-5.52 5.544-3.047 0-5.521-2.484-5.521-5.544v-2.894H4.752c-1.56 0-2.723-.88-3.58-2.24-.9-1.44-.906-3.322-.01-4.773.78-1.253 2.081-2.006 3.59-2.006h2.048v-1.847c0-1.628-.23-3.654.299-4.847C8.859 1.069 11.216.793 12.206.793zm-5.95 5.847v1.847H4.752c-1.004 0-1.627.842-1.627 1.5 0 .659.623 1.5 1.627 1.5h1.504v9.544c0 2.203 1.78 3.99 3.97 3.99 2.19 0 3.97-1.787 3.97-3.99v-9.544h1.504c1.004 0 1.627-.841 1.627-1.5 0-.658-.623-1.5-1.627-1.5h-1.504V6.64c-.01-1.582.02-3.267-.29-4.23-.33-1.01-1.88-1.29-2.96-1.29-1.08 0-2.63.28-2.96 1.29-.31.963-.28 2.648-.29 4.23z" />
  </svg>
);

type SocialEntry =
  | {
      label: string;
      href: string;
      kind: "lucide";
      Icon: typeof Twitter;
    }
  | {
      label: string;
      href: string;
      kind: "snapchat";
    };

const social: SocialEntry[] = [
  {
    label: "X (تويتر)",
    href: "https://x.com/alanjal_schools?s=20",
    kind: "lucide",
    Icon: Twitter,
  },
  {
    label: "إنستقرام",
    href: "https://www.instagram.com/schoolanjal1/?utm_source=qr",
    kind: "lucide",
    Icon: Instagram,
  },
  {
    label: "سناب شات",
    href: "https://www.snapchat.com/@alanjal_schools",
    kind: "snapchat",
  },
  {
    label: "يوتيوب",
    href: "https://www.youtube.com/channel/UC2as75i57nQMG09ZIRDlxiA",
    kind: "lucide",
    Icon: Youtube,
  },
  {
    label: "البريد الإلكتروني",
    href: "mailto:info@al-anjal.sch.sa",
    kind: "lucide",
    Icon: Mail,
  },
];

const iconBtn =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/90 shadow-sm transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/12 hover:text-white";

const SiteFooter = () => {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-[#0a1628] to-[#0f172a] text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-5 px-4 py-8 text-center sm:gap-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {social.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.href.startsWith("mailto:") ? undefined : "_blank"}
              rel={item.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
              className={iconBtn}
              aria-label={item.label}
            >
              {item.kind === "lucide" ? (
                <item.Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <SnapchatIcon className="h-4 w-4" />
              )}
            </a>
          ))}
        </div>

        <p className="max-w-xl text-sm leading-relaxed text-white/75 sm:text-[0.95rem]">
          جميع الحقوق محفوظة © قسم الحاسب الآلي بمدارس الأنجال الأهلية
        </p>
      </div>
    </footer>
  );
};

export default SiteFooter;
