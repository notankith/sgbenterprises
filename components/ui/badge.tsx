import { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  className?: string;
  dot?: boolean;
};

export function Badge({ children, className = '', dot }: BadgeProps) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium leading-none select-none whitespace-nowrap ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 mr-1.5 shrink-0" />}
      {children}
    </span>
  );
}
