import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons respond on press (scale 0.97, 160 ms, strong ease-out) and animate only
 * transform and colors. Hover styles are gated to fine pointers.
 */
const buttonVariants = cva(
  [
    "pressable inline-flex shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control)",
    "font-medium whitespace-nowrap select-none outline-none",
    "transition-[transform,background-color,color] duration-150 ease-(--ease-out-strong)",
    "disabled:pointer-events-none disabled:opacity-45 data-disabled:pointer-events-none data-disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-signal text-signal-ink [@media(hover:hover)]:hover:bg-signal/88",
        secondary: "bg-surface text-ink [@media(hover:hover)]:hover:bg-separator",
        ghost: "text-ink [@media(hover:hover)]:hover:bg-surface",
        quiet: "px-0! text-signal [@media(hover:hover)]:hover:underline underline-offset-4",
        destructive: "bg-surface text-danger [@media(hover:hover)]:hover:bg-separator",
      },
      size: {
        sm: "h-8 px-3 text-meta",
        md: "h-9 px-4 text-ui",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
