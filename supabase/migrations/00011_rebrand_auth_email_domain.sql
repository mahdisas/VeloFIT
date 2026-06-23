-- =============================================================================
-- 00011 — Rebrand the synthesized staff-login email domain (.fitx → .velofit).
--
-- Staff sign in with a username; the app turns it into
-- <username>@<slug>.<STAFF_EMAIL_DOMAIN>. That domain constant changed from
-- "fitx" to "velofit" (src/lib/auth.ts), so existing auth.users emails must be
-- migrated IN THE SAME DEPLOY — otherwise username logins compute the new domain
-- and no longer match the stored account. Username + password are unchanged;
-- only the internal, never-shown email domain moves.
--
-- Safe: rewrites ONLY the trailing ".fitx" suffix (uniqueness preserved). Runs
-- in the Supabase SQL Editor (admin) since it touches the auth schema. Staff who
-- log in with a real "@"-email are unaffected. No-op if you have no .fitx users.
-- =============================================================================

update auth.users
set email = left(email, length(email) - length('.fitx')) || '.velofit',
    updated_at = now()
where email like '%.fitx';

-- Keep the email-provider identity record in sync with auth.users.email.
update auth.identities
set identity_data = jsonb_set(
      identity_data,
      '{email}',
      to_jsonb(left(identity_data->>'email', length(identity_data->>'email') - length('.fitx')) || '.velofit')
    )
where provider = 'email'
  and identity_data->>'email' like '%.fitx';
