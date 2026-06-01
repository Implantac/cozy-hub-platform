interface EmptyStateProps {
  text: string;
  variant?: "default" | "dashed";
}

export function EmptyState({ text, variant = "default" }: EmptyStateProps) {
  if (variant === "dashed") {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        {text}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
