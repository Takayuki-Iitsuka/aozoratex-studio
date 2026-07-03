import React from "react";

interface StepCardProps {
  stepLabel?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function StepCard({
  stepLabel,
  title,
  description,
  icon,
  headerAction,
  children,
}: StepCardProps) {
  return (
    <section className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          {stepLabel && (
            <div className="text-xs font-semibold text-purple-400 uppercase tracking-widest">
              {stepLabel}
            </div>
          )}
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {description && <p className="text-zinc-400 text-xs leading-normal">{description}</p>}
        </div>
        {headerAction && <div className="self-start sm:self-auto">{headerAction}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
