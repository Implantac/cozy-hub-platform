import * as React from "react";

import { cn } from "@/lib/utils";
import { badgeVariants, type BadgeVariantProps } from "./badge-variants";

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & BadgeVariantProps;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
