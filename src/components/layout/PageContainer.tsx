import { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

const PageContainer = ({ children, className = "" }: PageContainerProps) => {
  return (
    <div className={`mx-auto max-w-7xl px-4 md:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer;
