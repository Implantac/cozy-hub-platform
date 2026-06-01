import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-secondary/60 animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
