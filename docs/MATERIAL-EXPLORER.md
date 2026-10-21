# Material Explorer, simulation sandbox and solution workshops

Open **Projects → Solution Studio**. The new quick-action bar offers **Material explorer**, **Discovery interview**, **Design tools** and **Present workshop**. The original process, proposal, agreement and delivery screens remain available.

## Start with the sample

1. Choose **Demo business → Maintenance bearings**.
2. Open **Material explorer**. ERSA starts with quantity and inventory-value updating. The fictional business also includes ROH ingredients, VERP packaging, FERT finished goods and NLAG consumables.
3. Open a behaviour card to see the conditions and an animated explanation. **Watch the numbers** demonstrates a 100-unit receipt followed by a 30-unit issue.
4. Choose **UNBW → Compare** to compare its explicit settings with another profile. **What controls this?** separates material-type/valuation-area controls, material/plant data, PO settings, movement context and account determination.
5. Select **Explore in simulator**. This applies the selected attributes to a local trial and opens **Before & after**, using the identical transaction sequence for both profiles. A previously recorded inventory receipt can fail after switching to consumption; its destination is deliberately not rewritten.
6. In the simulator, try **Both together** to follow physical goods and document effects at the same selected transaction. Accounting panels show the balances and the current transaction's change.

Demo changes remain in memory. **Use as starting point** copies definitions, reference profiles, interview answers and business-rule cards into an empty real workspace. It does not import the sample's workshop notes, business agreements or saved runs.

## Material types and maintained profiles

The catalogue contains **ROH, HAWA, HALB, FERT, ERSA, HIBE, VERP, UNBW, NLAG, DIEN and SERV**. Select **ECC** or **S/4HANA** as the reference context. SERV is shown in the S/4HANA catalogue; DIEN remains relevant to ECC and some S/4HANA service designs. This filter does not emulate a complete SAP release.

Stock-oriented quantity/value defaults for ROH, HAWA, HALB, FERT, ERSA, HIBE and VERP are illustrative presets. Verify the customer's Customizing at the relevant valuation area. The material-type code is never used as the sole posting rule.

**Make a custom copy / Custom profile** lets you maintain the code, description, permitted procurement, quantity/value updates, service flag, relevant views, purpose and configuration notes. Allowed/reference views are separate from actually maintained material/plant views. NLAG can have an Accounting view for a purchase-requisition valuation price without maintaining inventory value; the UNBW reference has no Accounting data.

- **Link to product** records an independent attribute snapshot on the product. It does not overwrite existing proposals.
- **Use for proposal** updates that proposal's default simulation profile to match the explicit attributes and prepares the supported consumption assignment where needed. An agreed design returns to review.
- **Explore in simulator** changes only the local trial. Keep a run explicitly to retain its exact inputs and material attributes.

Editing or removing a maintained catalogue profile does not rewrite previously attached snapshots. A proposal editor exposes its attached quantity/value flags, service flag and procurement permission. Inventory mode derives from those attributes; detach the profile to use the mode selector independently. Changing a flag does not silently complete dependent PO controls.

## Help me choose

The wizard asks about business purpose, inventory quantity, inventory value and procurement route. Its result explains a candidate and lists follow-up checks. It is a starting point for design, not a recommendation verified against the customer's SAP configuration. In-house manufacture and service acceptance need their own specialist process coverage.

## Preparation checklist

Under **Material explorer → Preparation**, record progress for the current proposal: identity and units, type configuration, organisational levels, procurement, relevant purchasing/storage/valuation data, consumption assignment and acceptance testing.

Progress is saved separately from the proposal, so completing checks does not revoke agreement. A profile change makes the prior checklist visibly stale and presents unchecked items to reconfirm. The prior record is retained until the revised checklist is saved.

## Business discovery interview

Use **Discovery interview** to capture the product and how it is bought, stored, consumed, manufactured and sold, together with the pain point. Activity answers form a live preview before **Create draft process**. Empty activity answers do not create invented steps.

The result is an editable current-process draft, linked to the selected product when its company matches. Otherwise a product is created in the chosen project company. Review the base unit, ownership, requirements and acceptance criteria. Manufacturing or sales answers mark the draft as specialist context rather than pretending the PO simulator covers it. Running the interview again creates another draft; existing processes are not overwritten.

## Warehouse and unexpected events

The **Warehouse sandbox** shows the two configured storage locations and the current selected transaction's quantity balances. Enter a quantity and drag a stock card to the other location. **Transfer to…** provides the same action for touch and keyboard users.

The sandbox inserts a **311** after the selected step and recalculates later transactions. It uses the engine's availability and scope checks; failed attempts leave balances unchanged. Stable transaction IDs keep references tied to the original transaction. Transfers do not change total plant quantity/value or create FI postings in the supported scenario.

Complication buttons insert an urgent 50-unit withdrawal, a 10-unit referenced supplier return for damaged goods, or another partial receipt. A damaged-goods example illustrates **122**, not QM inspection/release. A return inserted before any eligible GR fails visibly. PO tolerances, source location and account assignment remain relevant.

## Business rules and three perspectives

Under **Design tools**, keep rule cards with a title, condition, required response, responsible team and proposed implementation: Configuration, Workflow, Manual control or To confirm. Link them to current steps; badges appear on those steps. Removing a step detaches its rule links. Rule edits and removal return agreed proposals for that process to review. These cards document design; they do not execute an approval workflow.

Switch **Business user / SAP consultant / Finance** to produce explanations from the same selected proposal. Copy the text, or select it manually if clipboard access is unavailable. No message is sent.

## Workshop presentation board

**Present workshop** opens a spacious, responsive presentation with five stages:

1. Business need and products.
2. Current and proposed process story, with automatic step highlights.
3. Material attributes and their dependencies.
4. Live consequences, using the production simulator and automatic playback.
5. Questions, decisions and actions captured during the discussion.

Use stage buttons, Previous/Next or the left/right arrow keys when not editing a field. The live slide pauses when you change slide, close the workshop or hide the page. Simulation errors pause playback for inspection. The existing Loop control remains optional.

Workshop notes have a kind, text, person/owner and date/time in MYT. They save privately with the process. A note labelled Decision is a discussion record; formal agreement still requires **Review & deliver → Record business feedback**. Demo notes stay in memory.

## Consultant handover pack

Open **Design tools → Preview handover**. The report includes the selected proposal, current/proposed steps, products, requirements and acceptance tests, material attributes, simulation controls, configuration assumptions, rules, saved-run evidence, decisions, workshop notes, open questions, delivery references and SAP sources.

Unagreed proposals are marked **DRAFT**. Saved runs are replayed from their recorded profile and rule version rather than the latest proposal. The pack retains successful, failed and unsupported attempts. Download the self-contained **printable HTML**, open it and use **Print → Save as PDF**. Generated report contents stay on the device; the website does not upload report files.

## Coverage, effects and storage

The current rule version is `mm-core-2026-10-21.2`. Earlier `.1` snapshots, which predate material attributes, remain supported. New material-specific controls require `.2` and are saved with that version. Existing core inventory and integer-money calculations are preserved.

Services, production-only profiles and value-only inventory updates report **outside model** for this physical PO simulator. ECC/S/4HANA is target context, not a release-specific emulator. The inventory model continues to exclude invoices, tax/freight, moving-average valuation, special stock, QM/EWM, sales, production and cross-plant flows. See [the base coverage guide](SOLUTION-STUDIO.md).

Effects include luminous movement trails, receiving pulses, success shockwaves, blocked-movement impacts, document flow, floating accounting deltas and animated warehouse shelves. They use CSS, run inside the Studio and respect device reduced motion and the existing Animations Off setting. No downloaded video, sound or per-frame cloud writes are introduced.

New data stays in the existing private `workhub.solutionStudio` JSON document. Additive collections are `materialTypes`, `businessRules`, `workshopNotes` and `preparations`; products/proposals hold material snapshots and processes may hold interview answers. Per-project caps are 100 custom types and 600 each of rules, notes and preparations; account caps are 1,000 types and 4,000 each of the other collections. Existing document-size and conflict controls still apply. Project deletion removes its new records, process deletion removes its rules/notes, and proposal deletion removes its preparation progress. Saved runs remain independent snapshots.

The existing table, grants, authentication and autosave contract are unchanged. New records participate in account backups/restores and the existing migration protection.

## Code and verification

- `solution-materials.js`: reference data, attribute helpers, suggestions, explanations and extra record validation.
- `solution-theatre.js`: document, warehouse, accounting and comparison views; all balances come from the engine.
- `solution-experience.js`: Explorer, interview, rules, preparation, perspectives, workshop and handover UI.
- `solution-experience.css`: responsive design and heavier scoped effects.
- `tests/materials.test.mjs`: pure attribute, scope, legacy, snapshot and relationship checks.
- `tests/app.test.mjs`: real UI flows, private saving, restoring, stale edits, isolation, exports and playback.

Run `npm test` for the application and database contract suite. Official sources are linked inside **Material explorer → Official SAP references & profile boundaries**.
