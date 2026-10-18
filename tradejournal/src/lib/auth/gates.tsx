import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { signInGoogle, signOut } from "./client";
import { resolveSignInGateState } from "./sign-in-gate";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function SignInGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const state = resolveSignInGateState({ isPending, hasUser: user !== null });
  if (state === "pending") return null;
  if (state === "signed_in") return <>{children}</>;
  return <>{fallback ?? <SignInButtons />}</>;
}

export function SignInButtons() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <button
        type="button"
        onClick={() => signInGoogle("/")}
        className="w-full cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
      >
        Продолжить с Google
      </button>
    </div>
  );
}

export function UserButton({ menu }: { menu?: ReactNode }) {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Аккаунт";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Профиль"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-foreground hover:bg-secondary"
      >
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open ? (
        <div
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-menu-close]")) setOpen(false);
          }}
          className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-xl"
        >
          <div className="truncate px-2 py-1.5 text-sm font-medium">{label}</div>
          {user.primaryEmail && user.primaryEmail !== label ? (
            <div className="truncate px-2 pb-2 text-xs text-muted-foreground">
              {user.primaryEmail}
            </div>
          ) : null}
          {menu ? <div className="my-1 grid gap-0.5 border-t border-border pt-1">{menu}</div> : null}
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().catch(() => setSigningOut(false));
            }}
            className="mt-1 flex h-10 w-full items-center rounded-md px-2 text-left text-sm text-danger hover:bg-muted disabled:cursor-wait"
          >
            {signingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
