"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function Formulario() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, recordar }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo iniciar sesión.");
      // Recarga completa para que el menú y los permisos se carguen con tu rol.
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setCargando(false);
    }
  }

  const campo =
    "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-peri text-sm font-bold text-white">
          KFC
        </div>
        <div>
          <p className="font-display text-base font-semibold text-ink-900">Panel Operativo</p>
          <p className="text-xs text-ink-500">Ambit · Delivery</p>
        </div>
      </div>

      <h1 className="font-display mt-7 text-xl font-semibold text-ink-900">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-ink-500">Entra con tu correo y tu contraseña.</p>

      <label className="mt-6 block text-xs font-medium text-ink-500" htmlFor="email">
        Correo
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${campo} mt-1`}
        placeholder="nombre@empresa.com"
      />

      <label className="mt-4 block text-xs font-medium text-ink-500" htmlFor="password">
        Contraseña
      </label>
      <div className="relative mt-1">
        <input
          id="password"
          name="password"
          type={ver ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${campo} pr-16`}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute inset-y-0 right-3 text-xs font-medium text-brand-600 hover:underline"
        >
          {ver ? "Ocultar" : "Ver"}
        </button>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={recordar}
          onChange={(e) => setRecordar(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
        />
        Mantener sesión iniciada
      </label>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="mt-6 w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cargando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </div>
  );
}
