import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "text-foreground",
        draft: "border-transparent bg-muted text-muted-foreground",
        // Alias generiques (memes teintes que in_progress/professional
        // ci-dessous) pour un usage hors contexte entretiens.
        info: "border-transparent bg-blue-100 text-blue-700",
        warning: "border-transparent bg-amber-100 text-amber-700",
        in_progress: "border-transparent bg-blue-100 text-blue-700",
        completed: "border-transparent bg-green-100 text-green-700",
        cancelled: "border-transparent bg-red-100 text-red-700",
        signed: "border-transparent bg-teal-100 text-teal-700",
        annual: "border-transparent bg-purple-100 text-purple-700",
        professional: "border-transparent bg-amber-100 text-amber-700",
        bilan: "border-transparent bg-cyan-100 text-cyan-700",
        forfait: "border-transparent bg-indigo-100 text-indigo-700",
        fin_carriere: "border-transparent bg-rose-100 text-rose-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
