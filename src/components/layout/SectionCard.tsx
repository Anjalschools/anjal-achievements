import { ReactNode } from "react";

type SectionCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
};

const SectionCard = ({
  children,
  className = "",
  padding = "md",
}: SectionCardProps) => {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export default SectionCard;
