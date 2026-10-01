# MM Tracker

Tickets, tasks, projects, scheduling, reporting, and private cloud saving.

## Publish using GitHub Pages

1. Create a repository named `mm-tracker`. GitHub Pages on a free personal account requires a public repository.
2. Upload `index.html`, `supabase-client.js`, `THIRD-PARTY-LICENSES.txt`, and `.nojekyll` to its root. Commit the files.
3. Open Settings → Pages. Choose Deploy from a branch, main, and /(root). Save.
4. Use the published website address displayed by GitHub Pages.

No terminal or build tools are needed to use the tracker.

## Cloud login

The existing Supabase project is connected and its private-record schema is installed and tested. Create a tracker login in the website and confirm your email, then sign in. Signing in to the Supabase dashboard does not create a tracker login.

In Supabase Authentication → URL Configuration, set Site URL to the published website address and add that address to Redirect URLs. This makes confirmation emails return to the website. If a default confirmation redirect cannot open, return to the tracker and sign in after confirming the email.

Changes save online automatically. Wait for Saved online before closing. The same tracker login on another device opens the same records. Each browser keeps a private recovery copy and pending uploads. Clearing browser storage before an upload finishes can lose unsaved changes.

## Bring in existing records once

Click Backup in your previous tracker. Sign in here and use Restore to select that JSON backup. Future visits open your cloud records automatically.

Do not upload backups, Excel reports, or the original record-filled HTML to GitHub. This package starts empty and contains no original work records, including inside its report template.

## Storage

Row Level Security restricts records to their owner. The website contains only a publishable key. Revision checks and idempotent retries prevent overwriting newer records from another device. If records conflict, download a backup before choosing Reload cloud records.

The existing paused Supabase project was restored. If a free project pauses after inactivity, restore it in your Supabase dashboard. Hosting limits and costs follow your GitHub and Supabase account plans.

## Dependencies

The client is @supabase/supabase-js 2.117.2, bundled with esbuild 0.28.2. Exact package versions and lockfile are included. Rebuild the vendor bundle with `npm ci` and `npx esbuild cloud-entry.js --bundle --minify --platform=browser --target=es2020 --outfile=supabase-client.js`.

`cloud-schema.sql` documents the installed private-record schema; do not rerun it on an initialized project.

GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
