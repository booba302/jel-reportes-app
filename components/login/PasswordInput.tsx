"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const loginInputClass =
  "h-12 rounded-[10px] border-input bg-login-input-bg pl-[42px] text-base sm:h-[46px] sm:text-sm dark:bg-login-input-bg focus-visible:border-login-focus focus-visible:ring-[3px] focus-visible:ring-login-focus-ring";

export const loginIconClass =
  "pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-muted-foreground";

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className={loginIconClass} aria-hidden />
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(loginInputClass, "pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-login-focus-ring sm:size-[38px]"
      >
        {visible ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
      </button>
    </div>
  );
}
