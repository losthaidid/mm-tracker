# Google Drive file storage and QR downloads

The site remains on GitHub Pages. It uses Google Identity Services' browser token model and Drive REST; it does not use the ChatGPT Drive connection, a proxy, a service account or a client secret.

## One-time personal setup

1. Create or choose a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Under **Google Auth Platform**, configure Branding with an app name, support email and developer contact email.
4. Choose an External audience, keep publishing status Testing, and add your Google email as a test user. An eligible Workspace organization may choose Internal instead.
5. Under Data access, select only `https://www.googleapis.com/auth/drive.file`.
6. Under Clients, create **Web application**. Set the Authorized JavaScript origin to **`https://losthaidid.github.io`**, without `/mm-tracker`. The popup token model does not need a redirect URI.
7. Open WorkHub → Settings → Backups & sync → **Google Drive setup**. Paste the **Client ID**, save, click Connect Google Drive, then Choose Google account and approve access.
8. Open **Files**, upload a small original file, Refresh Drive, and test the personal QR on your phone while signed into the owning Google account.

The setup guide also appears inside the app. Never enter the client secret, Google password or an access token. Google's public production publishing/branding requirements may require domain verification; use Testing and a listed test account first. Google Workspace administrator policies can block consent or public sharing.

Homepage: `https://losthaidid.github.io/mm-tracker/` · privacy: `https://losthaidid.github.io/mm-tracker/privacy.html`.

## Using files

- Files → Upload file accepts one original file up to 50 MiB. No spreadsheet or document conversion takes place. Link it to a Task, Ticket, Project item, Process or Waiting-on record if desired.
- The app creates an owned, private **My WorkHub files** folder on first upload. Do not share the folder if its files should stay private.
- Process Hub → Export process → Prepare file keeps the local download and adds **Save to Drive & QR**. PDF handouts continue to exclude private presenter notes; Full reference is explicit.
- Handover packs → Preview → Download PDF or Save to Drive & QR creates an immutable dated export. Each save creates a separate file; existing QR links keep pointing at their original snapshot.
- Files → Download / QR offers the provider's returned download link (or viewing link if no direct download is available), Copy link and Prepare QR image → Download QR image. QR generation is local and preserves URL resource keys.
- Personal QR uses current Google permissions; it does not grant access. A phone may require the same Google login. Google may show a preview or download confirmation.
- A sharing QR requires checking the per-file review box and explicitly enabling read/download access for anyone with that file's link. Other files and folder permissions are unchanged. Existing public access is preserved and described; the app does not claim to have created an existing permission.
- Disable sharing added here removes only its recorded public reader permission after a second review. Other users, inherited permissions and downloaded copies are preserved. There is no automatic link expiry.

## File previews and gallery

Files has Table and Gallery views, a file-name search, source filtering and pagination. The layout choice is saved locally per WorkHub account. Gallery shows 12 cards per page; Table shows 50 rows. Each card retains the exact file name, size, saved date and linked work, with the existing Drive and Download / QR actions.

Use **Preview** for PDF, PNG, JPEG, WebP and GIF files up to 25 MiB. Connect the owning Google account first. PDFs render one page at a time with previous/next, a page number and Fit/Larger controls; images show their original contents. Larger or unsupported files keep the Open in Drive option. Password-protected PDFs open in Drive instead. SVG and HTML are not embedded. The preview limits image dimensions to 32 million pixels and PDFs to 1,000 pages.

Gallery thumbnails are optional: click **Load thumbnails**. Only eligible files up to 8 MiB on the current page are fetched, with at most two reads at once. PDFs use the first page. Failed or unsupported thumbnails retain a file-type placeholder. Browsing the library, changing layouts and filtering do not fetch file contents or save workspace records.

Preview bytes and generated thumbnail images stay in tab memory, with no third-party preview service. Closing the viewer or changing accounts/permissions cancels pending reads and releases its content; changing the library page/filter releases thumbnails. The renderer is the existing locally hosted PDF.js library, loaded only when needed. The app does not alter original file bytes, worksheet values, Drive permissions or QR links to create a preview.

Files export permission is required to fetch preview bytes. The Drive API checks app/file ownership, download restrictions, advertised and streamed byte limits, cancellation and the current account before delivering media. Preview failure offers Retry and the existing Drive link.

## Persistence, recovery and limits

Only metadata, file/source IDs and provider-returned links enter `workhub.driveFiles`; file bytes and Google bearer tokens do not. The library supports 2,000 entries / 3 MiB of metadata within the existing document limit. Existing backups and storage reporting include metadata; restoring a backup does not upload, delete or change Drive files.

Connections live in tab memory, expire periodically, and are cleared on WorkHub sign-out/account changes. Reconnect deliberately when needed. Disconnect also requests revocation of the app's Google grant. Signing in as another Google account never reassigns files in the library.

Drive writes are not blindly retried. Uploads allocate a stable file ID first and check that ID after an uncertain response. Metadata is registered only after Drive confirms the expected ID, byte size, app ownership and file ownership. Refresh Drive can recover an uploaded file if workspace sync failed. It discovers only this WorkHub account's app-owned files; it does not index an entire Drive. Missing or trashed files remain listed to preserve record references; Open in Drive reveals their availability. No remote file deletion or automatic migration of old embedded content is performed.

The Google client ID can be stored per WorkHub account; this public ID is not a credential. Changing clients may make files created by the previous client inaccessible under `drive.file`. Their stored links remain available subject to Google permissions.

## Access controls

New `files` and `handover` features are registered in the shared client/server access catalog. Owners can use them; existing Members need an Owner grant. Files CRUD and export actions remain independent. Generating or saving a source export also requires that source's export permission. Handover packs include only exportable sources and recheck access before publishing bytes. Files metadata is removed from server projections for Members denied Files access, and checked saves preserve blocked metadata.

Deploy `supabase/drive-handover-access.sql` as catalog DML only. It changes no schema, RLS policy, existing document or Member permission.

## Validation boundary

The automated suite uses synthetic OAuth/Drive responses and tests byte preservation, uncertain-upload recovery, account switches, file-level sharing, QR decoding and access projection. Live OAuth consent, actual uploads and organization-specific sharing must be verified after the operator supplies their Google Web client ID. Do not claim those external steps are complete before that verification.
