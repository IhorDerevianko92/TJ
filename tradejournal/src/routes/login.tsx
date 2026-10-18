import { useState, type FormEvent } from "react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled, signInGoogle } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="h-40 w-full max-w-sm animate-pulse rounded-xl bg-card" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: "/",
        });
        if (err) throw new Error(err.message ?? "Не удалось создать аккаунт");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (err) throw new Error(err.message ?? "Неверный email или пароль");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-next">
          Журнал сделок
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {mode === "in" ? "Вход" : "Регистрация"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Один аккаунт — один журнал на всех устройствах.
        </p>

        {authEnabled ? (
          <>
            <form onSubmit={onSubmit} className="mt-5 grid gap-3">
              {mode === "up" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Имя</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="email">Почта</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy} className="w-full">
                {busy
                  ? "Секунда…"
                  : mode === "in"
                    ? "Войти"
                    : "Создать аккаунт"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
              }}
            >
              {mode === "in" ? "Нет аккаунта — зарегистрироваться" : "Уже есть аккаунт — войти"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              или
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => signInGoogle("/")}
            >
              Продолжить с Google
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Вход выключен.</p>
        )}
      </div>
    </main>
  );
}
