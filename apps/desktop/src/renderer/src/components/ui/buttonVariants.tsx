import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-dark",
        secondary: "bg-background-lighter border border-border text-white hover:bg-background/80",
        outline: "border border-border bg-transparent hover:bg-background-lighter",
        ghost: "hover:bg-background-lighter hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        destructiveOutline:
          "border border-red-800 text-red-400 hover:text-red-300 hover:bg-red-950",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
