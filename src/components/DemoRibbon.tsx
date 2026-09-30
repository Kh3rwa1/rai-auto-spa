import { Github } from "lucide-react";
import { BRAND } from "@/lib/brand";

/** Subtle footer note: the product intentionally runs in demo mode. */
export function DemoRibbon() {
  return (
    <div className="border-t border-border bg-background px-4 py-2 text-center text-xs text-muted-foreground">
      <span className="mr-2 rounded-full bg-electric px-2 py-0.5 font-semibold text-electric-foreground">
        Demo
      </span>
      Simulated payments · open owner dashboard ·{" "}
      <a
        href={BRAND.githubUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
      >
        <Github className="h-3 w-3" aria-hidden /> Source on GitHub
      </a>
    </div>
  );
}
