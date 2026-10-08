"use client";

import { Suspense, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LoginBackdrop } from "@/components/login/LoginBackdrop";
import {
  PasswordInput,
  loginIconClass,
  loginInputClass,
} from "@/components/login/PasswordInput";

function mensajeError(code?: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Credenciales incorrectas o usuario no encontrado.";
    case "auth/user-disabled":
      return "Tu usuario está desactivado. Contacta a un administrador.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisa tu red e inténtalo de nuevo.";
    default:
      return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
}

/** Mensajes cuando la app cerró la sesión (AuthContext → `/login?motivo=`). */
const MOTIVOS: Record<string, string> = {
  desactivado: "Tu acceso está desactivado. Habla con un administrador.",
  "sin-perfil": "Tu usuario no tiene perfil en el sistema.",
  "temporal-vencida":
    "Tu contraseña temporal venció. Pide a un administrador que la restablezca.",
};

function AvisoError({ texto }: { texto: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text"
    >
      <CircleAlert className="mt-px size-[17px] shrink-0" />
      <span>{texto}</span>
    </div>
  );
}

function LoginForm() {
  const motivo = MOTIVOS[useSearchParams().get("motivo") ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Bienvenido a PayoutMetrics");
      router.push("/");
    } catch (err) {
      console.error(err);
      setError(mensajeError(err instanceof FirebaseError ? err.code : undefined));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      {(error || motivo) && <AvisoError texto={error || motivo} />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <div className="relative">
          <Mail className={loginIconClass} aria-hidden />
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="usuario@empresa.com"
            className={loginInputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          placeholder="••••••••"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="mt-1.5 h-12 w-full gap-2 rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          <>
            Ingresar al panel
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-login-bg px-4 py-12 text-foreground max-sm:justify-end max-sm:px-5 max-sm:pb-7 max-sm:pt-0">
      <LoginBackdrop />

      {/* Viñeta: desktop radial, móvil vertical */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,var(--login-vignette-a)_0%,var(--login-vignette-b)_70%,var(--login-bg)_100%)] max-sm:bg-[linear-gradient(180deg,var(--login-vignette-a)_0%,var(--login-vignette-b)_42%,var(--login-bg)_60%)]"
      />

      <div className="relative z-10 flex w-full max-w-[410px] flex-col items-center gap-[22px] max-sm:items-stretch max-sm:gap-5">
        {/* Marca */}
        <div className="flex animate-login-enter flex-col items-center gap-2.5 text-center motion-reduce:animate-none max-sm:flex-row max-sm:gap-3 max-sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-14 max-sm:w-11" />
          <div className="flex flex-col max-sm:leading-tight">
            <span className="text-[30px] font-extrabold tracking-[-0.03em] max-sm:text-[22px]">
              PayoutMetrics
            </span>
            <span className="text-sm text-muted-foreground max-sm:text-[13px]">
              Plataforma de auditoría y rendimiento
            </span>
          </div>
        </div>

        {/* Tarjeta de vidrio */}
        <div className="flex w-full animate-login-enter flex-col gap-[22px] rounded-[18px] border border-login-glass-border bg-login-glass px-7 py-[30px] shadow-[var(--login-glass-shadow)] backdrop-blur-[16px] [animation-delay:120ms] motion-reduce:animate-none max-sm:gap-5 max-sm:px-5 max-sm:py-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-tight max-sm:text-[21px]">
              Inicia sesión
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Usa tu correo corporativo para entrar al panel.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Desarrollado para JuegaEnLinea · v1.0 © 2026
        </p>
      </div>
    </div>
  );
}
