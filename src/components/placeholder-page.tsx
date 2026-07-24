import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">{phase}</span>
        </div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Icon className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="font-display text-xl font-semibold">Em construção</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
