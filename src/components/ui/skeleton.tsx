import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-secondary/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_linear_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
