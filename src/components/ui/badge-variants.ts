import { cva, type VariantProps } from "class-variance-authority";

/**
 * Styling for `Badge`, kept apart from the component.
 *
 * shadcn ships variants and component in one file; this project splits them
 * because a module that exports both cannot hot-reload (react-refresh). The
 * split is invisible to consumers, which keep importing `variant` types and
 * `badgeVariants` from `@/components/ui/badge` — that module re-exports them.
 */
export const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
