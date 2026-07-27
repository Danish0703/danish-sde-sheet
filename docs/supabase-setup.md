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

5. Start the app, open `/sheet`, and choose **Sign in to sync**.

## Setting up Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project or select an existing one.
2. Navigate to **APIs & Services → Credentials** and click **Create Credentials → OAuth client ID**.
3. Select Application Type **Web application**.
4. Add your Supabase Callback URL under **Authorized redirect URIs**:
   ```text
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
5. Copy the generated **Client ID** and **Client Secret**.
6. Open your **Supabase Dashboard → Authentication → Providers → Google**.
7. Toggle **Enable Google provider**, paste your **Client ID** and **Client Secret**, and click **Save**.

## What is stored

- Solved/unsolved status for each question.
- Review interval, next review date, and review history.
- The data is protected with Supabase Row Level Security: each authenticated user can only access their own rows.

The sheet continues working offline before sign-in; signing in hydrates the tracker from the cloud copy.
