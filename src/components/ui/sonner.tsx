import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      richColors
      closeButton
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast section-card group-[.toaster]:bg-card/85 group-[.toaster]:text-foreground group-[.toaster]:border-border/70 group-[.toaster]:shadow-elevated group-[.toaster]:backdrop-blur-xl",
          title: "group-[.toast]:font-medium group-[.toast]:tracking-tight",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-xs",
          success: "group-[.toaster]:border-success/30",
          error: "group-[.toaster]:border-destructive/40",
          warning: "group-[.toaster]:border-warning/40",
          info: "group-[.toaster]:border-primary/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
