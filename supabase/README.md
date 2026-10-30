# Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run schema.sql.
3. Enable Email/OTP or magic-link sign-in in Authentication > Providers.
4. Add the first user to store_members using the SQL comment at the bottom of schema.sql.
5. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel Environment Variables.

SUPABASE_SERVICE_ROLE_KEY is server-only. It must never be committed or placed in browser JavaScript.
