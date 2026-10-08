"use client";

import { useState } from "react";
import { updatePassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, updateDoc } from "firebase/firestore";
import { Check, CircleAlert, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginBackdrop } from "@/components/login/LoginBackdrop";
import { loginIconClass, loginInputClass } from "@/components/login/PasswordInput";
import { sinTildes } from "@/components/usuarios/tipos";
import { useAuth } from "../context/AuthContext";

/** 0–4 según largo y variedad (§22.11). */
function puntaje(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 10) score++;
  if (/[a-zñáéíóú]/i.test(p) && /\d/.test(p)) score++;
  if (/[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.max(p ? 1 : 0, score);
}

const NIVELES = [
  { label: "", clase: "", texto: "" },
  { label: "Débil", clase: "bg-danger", texto: "text-danger-text" },
  { label: "Aceptable", clase: "bg-warning", texto: "text-warning-text" },
  { label: "Buena", clase: "bg-success", texto: "text-success-text" },
  { label: "Fuerte", clase: "bg-success", texto: "text-success-text" },
];

/** ¿La contraseña contiene el nombre (cualquier palabra de 3+ letras) o la parte del correo antes de la @? */
function contieneDatos(p: string, nombre: string, email: string) {
  const q = sinTildes(p);
  if (!q) return false;
  const partes = [
    ...sinTildes(nombre).split(/\s+/),
    sinTildes(email.split("@")[0] ?? ""),
  ].filter((x) => x.length >= 3);
  return partes.some((x) => q.includes(x));
}

function Requisito({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 text-[13px]", ok ? "text-foreground" : "text-muted-foreground")}>
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          ok ? "border-success bg-success text-white" : "border-input",
        )}
        aria-hidden
      >
        {ok && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
      <span className="sr-only">{ok ? "(cumplido)" : "(pendiente)"}</span>
    </li>
  );
}

export default function CambiarCredencialesPage() {
  const { user, userData, logout } = useAuth();
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const email = userData?.email || user?.email || "";
  const nombre = userData?.nombre || "";
  const score = puntaje(nueva);
  const req = {
    largo: nueva.length >= 10,
    mezcla: /\p{L}/u.test(nueva) && /\d/.test(nueva),
    sinDatos: nueva.length > 0 && !contieneDatos(nueva, nombre, email),
    coinciden: nueva.length > 0 && nueva === repetida,
  };
  const listo = req.largo && req.mezcla && req.sinDatos && req.coinciden;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo || !user) return;
    setGuardando(true);
    setError("");
    try {
      await updatePassword(user, nueva);
      await updateDoc(doc(db, "usuarios", user.uid), {
        debeCambiarPassword: false,
        tempPassExpira: null,
      });
      // Solo registra el cambio en auditoria_usuarios; si falla no bloquea la entrada.
      await apiFetch("/api/usuarios/yo/cambio-password", { method: "POST" }).catch((err) =>
        console.error("No se pudo registrar el cambio de contraseña:", err),
      );
      toast.success("Contraseña actualizada. Bienvenido a PayoutMetrics.");
      // AuthContext ve la bandera apagada (onSnapshot) y lleva al inicio.
    } catch (err) {
      console.error(err);
      setError(
        err instanceof FirebaseError && err.code === "auth/requires-recent-login"
          ? "Tu sesión expiró. Vuelve a iniciar sesión con la contraseña temporal."
          : err instanceof FirebaseError && err.code === "auth/password-does-not-meet-requirements"
            ? "La contraseña no cumple la política de seguridad. Prueba con una más larga."
            : "No se pudo guardar la contraseña. Inténtalo de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const nivel = NIVELES[score];
  const tipo = visible ? "text" : "password";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-login-bg px-4 py-12 text-foreground max-sm:px-5">
      <LoginBackdrop />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,var(--login-vignette-a)_0%,var(--login-vignette-b)_70%,var(--login-bg)_100%)] max-sm:bg-[linear-gradient(180deg,var(--login-vignette-a)_0%,var(--login-vignette-b)_42%,var(--login-bg)_60%)]"
      />

      <div className="relative z-10 flex w-full max-w-[430px] flex-col items-center gap-[22px]">
        <div className="flex animate-login-enter items-center gap-2.5 motion-reduce:animate-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-auto w-9" />
          <span className="text-[22px] font-extrabold tracking-[-0.03em]">PayoutMetrics</span>
        </div>

        <div className="flex w-full animate-login-enter flex-col gap-5 rounded-[18px] border border-login-glass-border bg-login-glass px-7 py-[30px] shadow-[var(--login-glass-shadow)] backdrop-blur-[16px] [animation-delay:120ms] motion-reduce:animate-none max-sm:px-5 max-sm:py-6">
          <span className="flex w-fit max-w-full items-center gap-2 rounded-full border border-login-glass-border bg-login-input-bg py-1 pl-1 pr-3 text-[13px]">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {(nombre || email).charAt(0).toUpperCase()}
            </span>
            <span className="truncate">{email}</span>
          </span>

          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-tight">Elige tu contraseña</h1>
            <p className="text-[13px] text-muted-foreground">
              Entraste con una contraseña temporal. Crea una propia para continuar; la temporal deja
              de funcionar.
            </p>
          </div>

          <form onSubmit={guardar} className="flex flex-col gap-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-3 text-[13px] text-danger-text"
              >
                <CircleAlert className="mt-px size-[17px] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="nueva">Nueva contraseña</Label>
              <div className="relative">
                <Lock className={loginIconClass} aria-hidden />
                <Input
                  id="nueva"
                  type={tipo}
                  autoComplete="new-password"
                  value={nueva}
                  onChange={(e) => {
                    setNueva(e.target.value);
                    setError("");
                  }}
                  aria-describedby="medidor requisitos"
                  className={cn(loginInputClass, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                  aria-pressed={visible}
                  className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-login-focus-ring sm:size-[38px]"
                >
                  {visible ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                </button>
              </div>
              <div id="medidor" className="flex items-center gap-2.5" aria-live="polite">
                <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn("h-1 rounded-full", i <= score ? nivel.clase : "bg-track")}
                    />
                  ))}
                </div>
                <span className={cn("w-[68px] text-right text-xs font-medium", nivel.texto)}>
                  {nivel.label}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="repetida">Repite la contraseña</Label>
              <div className="relative">
                <Lock className={loginIconClass} aria-hidden />
                <Input
                  id="repetida"
                  type={tipo}
                  autoComplete="new-password"
                  value={repetida}
                  onChange={(e) => {
                    setRepetida(e.target.value);
                    setError("");
                  }}
                  className={loginInputClass}
                />
              </div>
            </div>

            <ul id="requisitos" className="flex flex-col gap-1.5">
              <Requisito ok={req.largo}>Al menos 10 caracteres</Requisito>
              <Requisito ok={req.mezcla}>Letras y números</Requisito>
              <Requisito ok={req.sinDatos}>No contiene tu nombre ni tu correo</Requisito>
              <Requisito ok={req.coinciden}>Las dos contraseñas coinciden</Requisito>
            </ul>

            <Button
              type="submit"
              disabled={!listo || guardando}
              aria-busy={guardando}
              className="mt-1 h-12 w-full gap-2 rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {guardando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar y entrar"
              )}
            </Button>

            <button
              type="button"
              onClick={logout}
              className="self-center text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Cerrar sesión y salir
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
