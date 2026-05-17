# BookTrail

A Vercel-ready web app for tracking books as they move through little free libraries.

## What It Does

- Registers a book with title, author, starting library, location, and note.
- Generates a unique tracking code.
- Builds a printable inside-cover label with a public `/track/CODE` link and QR code.
- Lets future readers look up a code and add a new stop to the book's trail.
- Stores production data through Vercel serverless API routes backed by KV storage.
- Supports email/password accounts for readers, library stewards, and admins.
- Gives admins a role-management panel for promoting users to steward or admin.
- Falls back to browser `localStorage` when KV is not configured, so the UI is still easy to test.

## Project Structure

- `index.html` - single-page app shell.
- `styles.css` - responsive UI and print label styling.
- `app.js` - frontend app logic and API calls.
- `api/books.js` - list, look up, and register books.
- `api/checkins.js` - add reader stops to a book trail.
- `api/auth/*.js` - register, sign in, sign out, and session endpoints.
- `api/admin/users.js` - admin-only role management.
- `api/_store.js` - shared KV storage helpers.
- `vercel.json` - rewrites `/track/:code` to the app.

## Vercel Setup

1. Create a new Vercel project from this folder or connected Git repository.
2. Add a KV/Redis storage integration that exposes REST credentials.
3. Add these environment variables in Vercel:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
STEWARD_INVITE_CODE
ADMIN_INVITE_CODE
```

If Vercel's Upstash Redis integration gives you these names instead, they work too:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The first account created becomes an admin automatically. After that, regular signups become `user` accounts unless they provide the steward or admin invite code.

4. Deploy.

After deployment, labels will point to URLs like:

```text
https://your-domain.vercel.app/track/BT-8F2KQ9
```

## Local Development

The production API expects the KV variables above. For a quick UI-only local run, open `index.html` or serve the folder with any static server. Without KV credentials, the app displays a banner and uses local demo storage.

If you have the Vercel CLI and environment variables configured:

```bash
vercel dev
```

## Next Production Steps

- Add admin moderation for public notes.
- Add password reset and email verification.
- Add rate limiting or CAPTCHA on check-ins.
- Replace the third-party QR image endpoint with self-hosted QR generation.
- Add optional map/location fields once you decide how precise locations should be.
