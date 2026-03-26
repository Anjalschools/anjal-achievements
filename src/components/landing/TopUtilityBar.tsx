"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocale } from "@/lib/i18n";

const TopUtilityBar = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState<string>("");

  useEffect(() => {
    const setHash = () => setActiveHash(window.location.hash || "");
    setHash();
    window.addEventListener("hashchange", setHash);
    return () => window.removeEventListener("hashchange", setHash);
  }, []);

  const links = [
    {
      id: "vision-mission",
      label: isAr ? "رؤيتنا ورسالتنا" : "Vision & Mission",
      href: "/#vision-mission",
    },
    {
      id: "why-share",
      label: isAr ? "لماذا تشارك إنجازك؟" : "Why Share Your Achievement?",
      href: "/#why-share",
    },
    {
      id: "achievement-fields",
      label: isAr ? "مجالات الإنجاز" : "Achievement Fields",
      href: "/#achievement-fields",
    },
    {
      id: "award-ceremony",
      label: isAr ? "حفل التكريم" : "Award Ceremony",
      href: "/#award-ceremony",
    },
  ];

  return (
    <div className="bg-slate-900 py-2 text-xs text-white sm:text-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-end gap-3 overflow-x-auto whitespace-nowrap sm:gap-4 md:gap-6">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`whitespace-nowrap font-medium transition-colors duration-200 hover:text-secondary ${
                pathname === "/" && activeHash === `#${link.id}` ? "text-secondary" : "text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopUtilityBar;
