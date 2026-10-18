import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

export async function signInGoogle(callbackURL = "/") {
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL,
  });
  if (error) throw new Error(error.message ?? "Не удалось войти через Google");
  if (data?.url) window.location.href = data.url;
}

export async function signOut(redirectTo = "/") {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Не удалось выйти");
  window.location.href = redirectTo;
}
