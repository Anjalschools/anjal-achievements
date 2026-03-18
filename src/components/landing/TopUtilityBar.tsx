"use client";

const TopUtilityBar = () => {
  const links = [
    { label: "للطلاب", href: "/students" },
    { label: "للمدارس", href: "/schools" },
    { label: "للجان", href: "/committees" },
    { label: "للإدارة التعليمية", href: "/admin" },
  ];

  return (
    <div className="bg-slate-900 text-white py-2 text-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-end items-center gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-secondary transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopUtilityBar;
