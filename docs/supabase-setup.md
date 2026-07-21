# Supabase activation

The app code, auth flow, Row Level Security policies, and cloud progress schema are ready. Activate the project with these steps.

1. In Supabase, open **Project Settings → API** and copy the **Project URL** (it looks like `https://your-ref.supabase.co`).
2. Add it to `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
   ```

   The publishable key is already kept in the local environment file and should never be committed.
3. Open **SQL Editor** in the Supabase dashboard and run [`supabase/schema.sql`](../supabase/schema.sql) once.
4. Under **Authentication → URL Configuration**, add these redirect URLs:

   ```text
   http://localhost:3001/auth/callback
   https://your-production-domain.com/auth/callback
   ```

5. Start the app, open `/sheet`, and choose **Sign in to sync**. Supabase sends a passwordless magic link.

## What is stored

- Solved/unsolved status for each question.
- Review interval, next review date, and review history.
- The data is protected with Supabase Row Level Security: each authenticated user can only access their own rows.

The sheet continues working offline before sign-in; signing in hydrates the tracker from the cloud copy.
