# MM Tracker

Tickets, tasks, projects, scheduling, reporting, and private cloud saving.

## Publish using GitHub Pages

1. Create a repository named `mm-tracker`. GitHub Pages on a free personal account requires a public repository.
2. Upload `index.html`, `supabase-client.js`, `THIRD-PARTY-LICENSES.txt`, and `.nojekyll` to its root. Commit the files.
3. Open Settings → Pages. Choose Deploy from a branch, main, and /(root). Save.
4. Use the published website address displayed by GitHub Pages.

No terminal or build tools are needed to use the tracker.

## Cloud login

The website is configured for the Supabase project identified in `index.html`. Create a tracker login in the website and confirm your email, then sign in. The database must have the compatible private-record schema described below. Signing in to the Supabase dashboard does not create a tracker login.

In Supabase Authentication → URL Configuration, set Site URL to the published website address and add that address to Redirect URLs. This makes confirmation emails return to the website. If a default confirmation redirect cannot open, return to the tracker and sign in after confirming the email.

Changes save automatically to Supabase. The header and Settings show **Saving to Supabase…**, **Saved to Supabase**, or a warning. Wait for **Saved to Supabase** before closing. The same tracker login on another device opens the same records. Each browser keeps a private recovery copy and pending uploads. Clearing browser storage before an upload finishes can lose unsaved changes.

Settings also contains Account, Charge codes, Project management, editable built-in lists, screen visibility, Backup, Restore, Retry/refresh, Reload cloud records, and Sign out. Restore and Reload cloud records require the current account email and password. Activity deletion requires the current password; credentials are verified by Supabase Auth and are not stored in tracker data.

Tasks can be linked to a project, ticket, or custom reference. Scheduling supports 01:00–24:00 entry, status colours, configurable work locations, and automatic weekend TOIL identification. Project governance includes editable phase-specific acceptance criteria, gate skipping, Go-Live countdowns, project health, and planned-versus-actual confirmation.

Use **Companies & processes → Upload company / process Excel** to import Organization Structure, Master Data, Inventory Management, and Procurement mappings. The preview can add companies, departments, organization/master-data items, BPML processes, and decision states together. Re-importing the same code or item creates a new proposal version. The workbook stays in the browser; only normalized rows and source metadata are saved online. Project items can select an imported company and record expected and due dates.

## Bring in existing records once

If earlier records remain under this website’s browser storage key, signing in shows an **Earlier records are still in this browser** notice. For an empty cloud account, choose **Import browser records**, review the destination account, and confirm the import. The original browser records are retained. An existing cloud account is never replaced automatically.

If the records came from a different website address or browser, click Backup in your previous tracker. Sign in here and use Restore to select that JSON backup. Future visits open your cloud records automatically.

Do not upload backups, Excel reports, or the original record-filled HTML to GitHub. This package starts empty and contains no original work records, including inside its report template.

## Storage

Row Level Security restricts records to their owner. The website contains only a publishable key. Revision checks and idempotent retries prevent overwriting newer records from another device. If records conflict, download a backup before choosing Reload cloud records.

If a Free plan project pauses after inactivity, restore it in your Supabase dashboard. Hosting limits and costs follow your GitHub and Supabase account plans. Supabase’s Free plan currently includes a 500 MB database and can pause after one week of inactivity: https://supabase.com/pricing. This change does not require enabling paid features.

## Update an existing installation

1. In the existing Supabase project’s SQL Editor, run `supabase/migrations/20261015010000_support_document_versions_5_to_7.sql` once. This only broadens the document-format constraint; it preserves all rows, ownership policies, revisions, and the save function. It can be reapplied safely.
2. Deploy the updated `index.html` alongside the existing `supabase-client.js`, Excel template and `.nojekyll` through the repository’s current GitHub Pages deployment.
3. Sign in to the tracker. Make an edit, wait for **Saved to Supabase**, and reopen it using the same tracker account on another device.

The previous checked-in SQL accepted only document versions 1–4, while the previous website wrote version 6. This migration accepts versions 1–7. The updated app writes version 7 so older pages cannot silently reinterpret custom areas. It can restore older backups, including version 6. Do not run `cloud-schema.sql` on an initialized database; that file is for a fresh installation.

## Maintain SAP MM areas

Open **SAP Projects → Companies & processes → Manage SAP MM areas**, or **Settings → SAP MM areas**. Area settings belong to the active project and apply to all its companies.

- Add and rename areas, use the arrows to change order, and select **Show** to control sidebar visibility.
- Hiding an area keeps its mappings in cloud records, backups, imports, and reports. All areas can be hidden and shown again later.
- Renaming an area updates its process mappings and matching implementation decisions. Previous names remain accepted in Excel imports.
- Remove is available for unused areas. An area with process mappings must be hidden instead, preserving the records.
- The Add/Edit process dropdown and Excel import preview use the maintained areas, including custom areas such as Invoice Verification.

Click **Save areas** to apply changes. They use the same Supabase autosave and revision protection as the rest of the tracker.

## Development checks

Run `npm ci` followed by `npm test`. The tests exercise the app in a DOM environment and execute the original schema plus compatibility migration in a local PostgreSQL runtime. They cover area maintenance, imports, browser recovery, failed-upload retries, refresh races, preserved records, idempotent saves, revision conflicts, and owner-only access. No production records are used by these tests.

## Dependencies

The client is @supabase/supabase-js 2.117.2, bundled with esbuild 0.28.2. Exact package versions and lockfile are included. Rebuild the vendor bundle with `npm ci` and `npx esbuild cloud-entry.js --bundle --minify --platform=browser --target=es2020 --outfile=supabase-client.js`.

The browser bundle also includes JSZip 3.10.1 under the MIT license to read selected `.xlsx` and `.xlsm` mapping files locally. `cloud-schema.sql` defines the private-record schema for a fresh project; existing projects use the compatibility migration above.

GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
