# User management and screen visibility

Open **Settings → Account → User management** while signed in as the Owner.

## Approve a new account

1. On the sign-in page, a visitor chooses **Request access**, enters their name, email and a short reason, and submits. No password or Auth account is created at this point.
2. In **Access requests**, select the person. Choose a preset or set individual feature permissions.
3. Choose **Approve & send invite**, or reject the request. Approval sends a Supabase invitation to the requested email.
4. The recipient follows that email and sets their password before using their permitted workspace.

An invitation can create the approved Auth account immediately, before its recipient opens the email. Unapproved registrations are rejected by a database trigger, including registrations submitted outside the website. A failed email attempt keeps the approval and displays a retry action. Delivery uses the project's existing Supabase email configuration and rate limits; production recipient delivery is not tested by automated checks. The production website URL must be allowed in Supabase Auth redirect settings.

## Control access

Select someone in **User accounts**, choose permissions and save.

| Mode | Behavior |
| --- | --- |
| Hidden | Removes the feature and blocks its workspace data. |
| Disabled | Keeps its navigation entry locked and blocks its workspace data. |
| View only | Allows viewing but blocks saved changes. |
| Enabled | Uses the separate Create, Edit, Delete, Run/use and Export switches. |

There are 29 permission entries: 13 main screens, nine Studio tools, three Project tools, and Focus mode, Break Terrarium, Presentation break and personal settings. Parent restrictions also apply to child tools. Basic personal settings remain readable. Validation can run an existing saved template without permission to change the template.

Full workspace backups and Excel reports require Export permission for every visible feature. Per-feature exports follow that feature's Export permission. These controls govern the website's export actions; someone who can view information can still copy what they have already seen.

Each account continues to own a separate workspace. User management shows account details and deletion counts; it does not open another person's private records. Server-side projected reads and checked writes enforce workspace access, with immediate database suspension checks. The browser refreshes changed permissions within 30 seconds or when returning to the tab, clears its old recovery copy and reloads the permitted records. Other copies someone previously exported or saved outside the website cannot be revoked. Browser-only tools and static source assets are publicly hosted; their interface restrictions do not make the downloaded source confidential.

## Suspend or delete

**Suspend** blocks cloud reads and writes, including requests using an existing session. **Reactivate** restores the assigned permissions.

**Delete account** shows the account's saved ticket, task and project counts. Type that account's email and confirm your own Owner password. The server independently verifies the password and checks that the reviewed account and workspace have not changed. Deletion removes the Auth account and its workspace document permanently, records the action, and invalidates its previous signup approval. The Owner account is protected from suspension and deletion. Passwords are never saved in workspace records or audit history.

**Activity history** shows the latest 300 administration events. Failed invitations remain visible for retry. A failed deletion leaves access blocked until the Owner reviews and retries it.

## Personal screen visibility

Open **Settings → Workspace → Screen visibility**. The 28 choices cover all main screens, Studio tools, Project tools and Focus/Break shortcuts. Keep at least one permitted main screen visible. These are personal display choices and cannot grant access restricted by the Owner. Hiding a screen keeps its saved records.

## Deployment and verification

Apply `supabase/user-management.sql`, `supabase/access-catalog.sql` and `supabase/bootstrap-owner.sql` together in one migration transaction. The bootstrap only accepts a project with exactly one existing confirmed Auth account and assigns that account Owner; it stops instead of guessing if this assumption changes. Do not rerun this initial migration on an initialized user-management database. No real account IDs or service keys belong in source.

Deploy `supabase/functions/workhub-admin/index.ts` as **workhub-admin**, with the gateway JWT check disabled: the function explicitly validates the bearer token with Auth and verifies the current Owner role in the database. Its service-role key comes only from the platform's private environment. CORS permits the published website origin. Publish the frontend after both backend steps succeed.

`access-catalog.js` is the shared feature registry. Keep the generated SQL catalog synchronized when adding features. Database tests execute the actual SQL under anonymous, member and Owner roles. Edge tests cover identity checks, password verification, body limits, CORS and approval ordering. Application tests cover visibility, route restrictions, requests, run-only validation and projected-document compatibility across every feature.
