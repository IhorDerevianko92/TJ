import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const databaseUrl = env("DATABASE_URL");
const googleId = env("GOOGLE_CLIENT_ID");
const googleSecret = env("GOOGLE_CLIENT_SECRET");
const vercelUrl = env("VERCEL_URL");
const appUrl =
  env("BETTER_AUTH_URL") || (vercelUrl ? `https://${vercelUrl}` : undefined);

export const authConfigured = Boolean(databaseUrl && env("BETTER_AUTH_SECRET"));

const extraOrigins = (env("BETTER_AUTH_TRUSTED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const database = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: /supabase\.(co|com)|neon\.tech|sslmode=require/i.test(databaseUrl)
        ? { rejectUnauthorized: false }
        : undefined,
      max: /[?&]pgbouncer=true|:6543\b/i.test(databaseUrl) ? 1 : 8,
    })
  : undefined;

export const auth = betterAuth({
  baseURL: appUrl,
  secret: env("BETTER_AUTH_SECRET") ?? "change-me-in-production",
  ...(database ? { database } : {}),
  trustedOrigins: [...(appUrl ? [appUrl] : []), ...extraOrigins],
  emailAndPassword: { enabled: true },
  ...(googleId && googleSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleId,
            clientSecret: googleSecret,
          },
        },
      }
    : {}),
  plugins: [tanstackStartCookies()],
});
