import { cva, type VariantProps } from "class-variance-authority";

/** Styling for `Button`; split from the component so `Button.tsx` can hot-reload. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl text-sm font-bold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:transition-transform",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-glow-sm hover:bg-primary/90 hover:shadow-glow hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-0.5",
        outline:
          "border border-border bg-card/40 backdrop-blur shadow-sm hover:bg-accent/10 hover:text-foreground hover:border-border hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/70 hover:-translate-y-0.5",
        ghost: "hover:bg-accent/10 hover:text-foreground hover:scale-105",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
        premium:
          "bg-gradient-brand text-primary-foreground shadow-glow-sm hover:shadow-glow ring-1 ring-primary/20 hover:-translate-y-0.5 hover:[&_svg]:rotate-3 animate-soft-pulse",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
