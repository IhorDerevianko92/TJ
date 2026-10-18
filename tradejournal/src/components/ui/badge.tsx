import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        long: "bg-long-bg text-long",
        short: "bg-short-bg text-short",
        open: "bg-open-bg text-open",
        closed: "bg-muted text-muted-foreground",
        win: "bg-long-bg text-long",
        loss: "bg-short-bg text-short",
        be: "bg-be-bg text-be",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
