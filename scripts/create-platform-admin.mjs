/**
 * Create a platform (super-admin) account for the /admin console.
 *
 * This makes a standalone Supabase auth user (email + password) with NO gym and
 * NO profile — it exists only to operate the platform console. After running it,
 * add the same email to PLATFORM_ADMIN_EMAILS in .env.local and restart the app.
 *
 * Usage:
 *   node scripts/create-platform-admin.mjs <email> <password>
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/create-platform-admin.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Failed to create admin account:", error.message);
  process.exit(1);
}

console.log(`\n✓ Created platform-admin account: ${email}  (id ${data.user.id})\n`);
console.log("Next steps:");
console.log(`  1) Add to .env.local:   PLATFORM_ADMIN_EMAILS=${email}`);
console.log("  2) Restart the dev server");
console.log("  3) Open /admin/login and sign in with this email + password\n");
