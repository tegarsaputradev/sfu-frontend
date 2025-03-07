import React, { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }
>(({ children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className="px-4 py-1 border rounded-md hover:cursor-pointer"
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";
