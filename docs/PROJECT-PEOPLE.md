# People & Responsibilities

Open **Projects → People & responsibilities**, or use its card in Project Overview.

## Your first setup

1. Choose **Add person**. Maintain their name, email, department, job title, phone and reporting manager. Email is optional. Departments can use the maintained list or your own wording.
2. Choose **Add activity**, pick one of this project's maintained SAP MM areas and name the activity, such as **Create PR**, **Create PO** or **Perform goods receipt**. The optional process selector copies a name and area from **Companies & processes**. You can also add six editable PR / PO / goods-movement examples.
3. Drag an activity from the tray onto a person. The initial role is **Primary**. Alternatively, select a chip, then **Assign here** on a card. This also works with touch and keyboard.
4. Open the person's name to see every assignment. **Edit** an assignment to maintain **Primary**, **Backup**, **Business owner**, **Key user**, **Tester** or **Approver**, its company / plant / purchasing-organisation scope, and a short note.

An activity can have several people, and a person can have several activities or roles. A repeated drop does not duplicate the same person/activity/role/scope. Scope is free text: include identifiers when similar company or plant names could be confused.

Drag a whole MM area to record broad responsibility for that area. Whole-area ownership and individual activities are maintained separately: it does not silently assign every activity, or clear their unassigned indicators. The area-coverage export makes this distinction explicit. These records document business responsibility; they do not grant SAP authorisations or send messages.

## Chart and contact list

- Drag a person's dotted handle to move their card. Arrow keys move the focused handle; hold Shift for a larger move. One completed move is saved, rather than saving every animation frame.
- **Reports to** controls the hierarchy. Moving a card does not change that relationship or its responsibilities. Reporting loops and managers from other projects are rejected.
- **Auto arrange** places people by reporting level. It asks before replacing your saved positions. **Fit everyone**, zoom and scrolling help navigate larger charts.
- Use **People list** on a phone. The activity tray can collapse; selecting an activity on a phone closes the tray so you can choose a person comfortably.
- Search names, contact details, departments, activities, roles and scope. The arrow beside an MM area or activity shows the people explicitly assigned to it. Search, zoom, layout switching and filters do not save records.
- Copy a person's email directly, or open person details for all responsibilities and notes. The picture and chart cards preview up to two assignments; the details view and Excel include every assignment.

Renaming or hiding an MM area preserves its links because assignments use stable IDs. An area with responsibility activities cannot be removed until those activities are moved or deleted; hiding remains available. Process names copied from company mappings are snapshots: later edits to those source mappings do not replace your activity wording.

Removing a person removes their assignments and releases their direct reports to no manager. Activity definitions stay available to reassign. Deleting an activity removes its assignments after confirmation. Deleting a project also removes that project's contacts, activities and assignments. Backups include these records.

## Reuse a project setup

In an empty People & Responsibilities workspace, choose **Reuse a project setup**. Select a project with people and map each used source MM area to an area in the destination project. The copy receives independent IDs, reporting relationships and assignments. Later changes do not alter the source project. Duplicate activity/area mappings are rejected instead of silently combining them.

## Exports

**Picture** offers the full chart, the current filtered view or a selected person. Email details are hidden by default and can be included explicitly. PNG draws locally using the browser canvas, including reporting connectors and up to two assignment previews per person. Very large charts are scaled to browser-safe dimensions; choose a smaller selection for larger text. It does not crop to the current scroll position or upload an image.

**Excel** exports the complete current project, independent of the screen filters:

| Sheet | Contents |
| --- | --- |
| People | Contact details, reporting manager and assignment count |
| Responsibility Assignments | One row per assignment with MM area, activity, person, role, scope and notes |
| Unassigned Activities | Specific activities without an explicit assignment |
| Area Coverage | Primary and other contacts by MM area, including hidden areas and coverage notes |

Headers are frozen, columns are sized and filters are included. Identifiers and user text are stored as spreadsheet strings, including values beginning with `=`; they are not executed as formulas. Exports use a validated snapshot and are cancelled if the account or active project changes before download. Exports include contact details, so review the contents before sharing.

## Storage, boundaries and code map

Data is saved under `workhub.projectPeople` in the existing private Supabase account document. No new database table, permission change, Google Drive connection, service key or dependency is needed. The normal autosave queue, conflict checks and backups still apply. Restored documents are validated for missing references, invalid emails, reporting loops and duplicate assignments. Open editors reject stale records and account/project changes. Screen privacy hides the workspace and editors and blocks exports.

- `project-people-engine.js`: pure validation, stable references, assignment rules, layout, copying and export rows. Limits: 100 people and 300 activities per project; 1,000 people, 5,000 activities and 10,000 assignments per account, within the existing document-size limit.
- `project-people.js`: forms, delegated drag/drop/pointer events, account guards and accessible controls.
- `project-people-files.js`: local canvas PNG and the existing text-safe Excel writer.
- `project-people.css`: colours, spacing, cards, responsive layouts and animations. Reduced-motion settings disable movement effects.
- `studio.js` coordinates upgrade/validation/preparation and module mounting; `app.js` supplies Projects navigation and the shared save path.

To change a label, edit the interface module. To change colours or spacing, edit the CSS. Keep validation, roles and limits in the engine so imports and the interface enforce the same rules.
