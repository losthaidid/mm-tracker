# Product & Process Solution Studio

Material types, discovery interviews, warehouse trials, workshop presentation and handover exports are documented in [the Material Explorer guide](MATERIAL-EXPLORER.md). Earlier `.1` saved-run snapshots remain replayable.

Open **Projects → Solution Studio**, or its card in Project Overview. Your existing project, company and MM area lists remain the starting point.

## Start here: understand the Studio

The Studio now opens on **Start here**, with a visual map connecting product → process → proposal → test → decision. The welcome actions offer **Teach me with the complete example**, **Start my own discovery interview** and **Explain the words**. Browse all Studio screens opens the full navigation; it is also available on the working screens. The product tray appears when you enter a working screen.

- **Business process:** capture current activities on the AS-IS side and proposed SAP steps on the TO-BE side. Connecting lines show which current activities a proposed step addresses.
- **Solution options:** compare independent proposals for that process, then select the one to test.
- **Test the outcome:** the simulator explains the selected transaction's request, reason and before/after balances.
- **Review & deliver:** keep business feedback and formal agreement, then create linked implementation work when eligible.
- **Material explorer / Design tools:** supporting tools for material behaviour, discovery interviews, business rules, workshops and handover reports.

Each working screen has a plain-language introduction and expandable **Show me how to use this screen** help. The context card names the current project, product/group, process and selected proposal and identifies fictional versus project records. Start here's six content checkpoints describe what is recorded; they do not certify SAP configuration or acceptance. Saved-run evidence is counted for the selected proposal.

**Explain the words** opens nineteen explanations with examples, including product versus process versus proposal, AS-IS/TO-BE, requirements/acceptance, quantity/value updating, direct consumption, GR/GI, GR/IR, account assignment, material profiles and saved snapshots. Core editors show purpose and example text before their fields. Proposal simulation assumptions are initially collapsed so the written business design comes first; their fields and save behaviour remain available.

## Learn from the complete sample

An empty Studio starts with **Demo business → Start here**: Meridian Food Manufacturing, a fictional bread manufacturer. It has five product groups, seven business users, eight current processes, sixteen requirements, ten proposals, an example business decision and four saved simulation walkthroughs.

The product groups are raw ingredients, packaging, finished goods, maintenance spare parts and consumables. Shared approvals and supplier returns demonstrate that a process can apply to several products. Finished-goods production and customer dispatch show discovery and specialist design; their PP/SD/QM transactions are explicitly outside this inventory model.

**Saved runs** also includes 311/312 transfer cancellation, 201/202 and 101/102 cancellation, and partial receipt / overdelivery examples.

Choose **Teach me with the complete example** or **Guided sample walkthrough** to follow maintenance bearings through six lessons: meet the business, understand today's work, compare the options, watch the consequences, understand a blocked attempt and record the decision. Each lesson explains what you are looking at, gives a concrete action and states the intended takeaway. Direct buttons open the sample product, first activity, comparison, next transaction or review form. Next/previous lesson controls and the numbered lesson navigation move between the actual working screens. The lesson is brought into view; the example buttons bring the transaction explanation into view.

Start here also offers three worked-case buttons: stock with value, quantity-only stock and non-stock consumption. Each opens a fresh fictional example and checks its first transaction. The non-stock example begins with the intentionally blocked inventory receipt; the next transaction demonstrates the valid consumption receipt. Beginning a guided walkthrough or worked case resets the fictional sample. **Reset demo** also recreates the sample. Demo edits and demo run saves live only in the page session and do not change your private account records. **Start my own discovery interview** switches to My workspace and opens the draft interview; it does not copy sample records or save anything until you submit.

**Use as starting point** explicitly copies products, current steps, requirements and proposals into an empty real Studio. Choose the destination company. IDs and area mappings are remapped; sample people remain explanatory role/name text, with no real owner assigned. Sample approvals and run evidence are not copied, and every proposal starts as Exploring. Confirm real client requirements before using the copied design.

## Capture the business

1. Switch to **My workspace** and add a product or product group. Capture its business code, category, base unit, location, purpose, current inventory approach and owner from People & responsibilities.
2. Add a process. Select its company, maintained MM area, owner and applicable products. Multiple products can share the same process within one company. An empty product selection retains shared company/project context.
3. Add current steps: who performs the work, systems/documents used, handovers and pain points. A step can link to a screenshot or document using an http/https URL, including a Drive sharing link. The Studio stores the link, not a file upload or new Drive connection.
4. Capture business requirements and acceptance criteria, plus exceptions, volumes, unresolved questions and integration dependencies.

The current and proposed lanes keep stable step IDs. Proposed steps can address several current steps. Open a step for full details; use its arrow buttons to reorder it. Maps survive renaming and reordering. Removing a current step explicitly removes its proposal mappings; removing a requirement removes its coverage links.

## Design and review alternatives

Each process can have independent SAP proposals with an ECC/S/4HANA target and release/deployment notes, approach, benefits, trade-offs, assumptions, configuration/tcode notes and requirement coverage. The target selector records context; it does not infer release-specific SAP rules.

Choose the default simulation profile in **Edit design**. Material capability and procurement purpose are separate. Stock-capable valuated material can be procured directly for consumption when the proposal is configured that way.

**Record business feedback** keeps reviewer, time, outcome, reasoning and the proposal/requirements snapshot. Agreement is recorded through this review flow, not simply by choosing an Agreed dropdown value. Only one alternative per process is agreed at once. Revising an agreed proposal, its current process or an associated product returns it to Under review. Historical decision snapshots remain available. Company/contact deletion retains readable context and removes live ownership links, with affected designs returned to review.

An agreed proposal in My workspace can **Create delivery work**: one project item and three project-linked tasks covering configuration/master data, SAP scenario verification and business acceptance. Requirements and acceptance criteria are captured as handoff test notes. Repeating the action opens the existing links instead of creating duplicates. Removing linked tasks/items keeps the historical links readable. Delivery-linked proposals cannot be removed through Studio deletion.

## Use the simulator

The simulator is a deterministic, source-based learning model. It does not connect to SAP, post documents or verify the client's live Customizing. Trial inputs, playback, comparisons and failed attempts are local. **Keep this run** explicitly saves input transactions, an immutable profile snapshot, target context and the rule version in the private account document. Reopening uses the saved snapshot even after the proposal changes. Deleting a proposal retains its saved run snapshots.

The default stock walkthrough receives 100 units, transfers 20 from MAIN to LINE, issues 30 from MAIN, then returns 10 to the supplier. Inspect any step, play/pause, move forward/back, restart, loop, add/edit/remove transactions and challenge a rule. A failed or unsupported transaction changes no balances and pauses automatic playback. Editing a sequence does not retarget document references: references use stable transaction IDs, not their display positions.

**What just happened?** uses the exact engine event shown by the theatre. It explains the requested movement and reason, then compares before/after stock quantity, inventory value and consumption cost. A location transfer also shows both location changes. Blocked and outside-model attempts have different headings and retain their unchanged balances; rule failures include the engine's suggested next action. Expand **How to read the rest of this screen** to connect the scene, warehouse, documents, accounting companion and transaction sequence.

Playback defaults to **Learning · 6 seconds**, with **Standard · 3.5 seconds** and **Fast · 2.1 seconds** choices. Changing pace while playing reschedules the timer without advancing an extra transaction. **Next transaction** remains available for reading at your own pace. The visual request/check/effects route, changed-value cards, success seal and stopped-attempt reaction illustrate the outcome. Guidance effects respect reduced-motion preferences and the website's motion-off setting. They do not change transaction rules, save records, or add supported SAP transactions.

The display shows plant stock, inventory value, consumption cost, net PO receipts, price differences, GR/IR and quantities in both storage locations. No separate valuation area is invented for the second location.

| Supported transaction | Model behaviour |
| --- | --- |
| PO goods receipt · 101 | Check the configured receipt destination, account assignment, GR expected flag and overdelivery tolerance. Partial receipts are valid. |
| Cost-centre goods issue · 201 | Check the selected location's stock and cost centre. Valuated stock consumption uses its selected standard price or current MAP, independently per valuation type. UNBW quantity-only issues do not charge purchase cost again. |
| Same-plant storage-location transfer · 311 | Same material, unrestricted stock and two defined locations: source decreases and destination increases. Plant stock/value, GR/IR and consumption cost are unchanged; no FI posting. |
| Referenced supplier return · 122 | Require eligible quantity on a successful receipt and available source-location stock. Update net received quantity and the supported stock/accounting effects. This is not a customer return or returns PO 161. |
| Referenced cancellation · 102 / 202 / 312 | Reverse the last active GR, issue or 311 transfer and its exact model effects. This latest-posting restriction is a simulator limitation, not a universal SAP restriction. Cancellation of 122 is outside this model. |

### Product and valuation profiles

- **Valuated stock:** choose S or V. Under S, inventory uses standard price and purchase-price differences use symbolic price differences. Under V, receipts use PO value and issues use current MAP. GR/IR uses PO price. Each split-valuation type keeps its own price control.
- **Quantity-only stock / UNBW baseline:** quantities are managed; no inventory value. Under the supported valuated-GR K assignment, PO GR recognises purchase cost. Later GI changes quantity and consumption statistics, with no additional FI cost.
- **Non-stock / NLAG baseline:** an account-assigned PO GR for consumption is valid. No inventory quantity/value is created. An attempted stock receipt, stock issue or storage transfer fails with an explanation.
- **Valuated material, direct-consumption purpose:** with K assignment, receipt records consumption rather than inventory.

K requires a cost centre and consumption G/L account. Negative stock requires both explicit configuration and material permissions in the profile. The GR expected flag and PO GR non-valuated indicator are separate controls; the latter's timing is not implemented and is labelled outside coverage.

Money uses integer sen and quantities use thousandths. Standard-price inventory and PO accrual are rounded cumulatively to avoid fractional-quantity residual balances. Accounting lines are symbolic and balanced, not verified real account determination.

### Moving average price, valuation class and batch stock

Open **Start here → Go deeper · Stock & valuation** or use the three example buttons in the simulator. These reset only the fictional sample:

- **Moving average price:** opening stock 100 units at RM10, receipt 100 at PO price RM12, MAP RM11. A 30-unit issue costs RM330. Transfers do not change value or the average.
- **Batch-managed stock:** LOT-A opens with 40 units; a receipt creates LOT-B with 60. Transfer LOT-B, try an insufficient issue from LOT-A, then post a valid issue and referenced return.
- **Valuation types & classes:** LOCAL uses V and example class 3000; IMPORT uses S and example class 3100. Their prices and values remain independent. The example combines batch stock, location transfer, 312 cancellation and a referenced return.

Under **Edit design → Simulation assumptions**, or **Scenario inputs & document controls**, maintain **Material price control S/V**, **Opening MAP**, **Valuation class**, **Manage stock by batch** and **Split valuation**. Trial inputs remain local; saving a proposal or explicitly keeping a run uses the existing private account document. Existing backup/restore, account guards and stale-edit checks apply.

V stock uses receipt value at the PO price in this no-invoice model. Current MAP is stock value divided by quantity; GI uses that average with a single sen rounding at the posting. A full withdrawal clears inventory value without leaving residual sen; the last known price remains visible at zero quantity. The next receipt supplies its own value. A supported referenced 122 return removes the corresponding PO receipt value and can change MAP. Returns requiring negative inventory value or a residual value at zero quantity, and negative-total-stock MAP postings, report **Outside this learning model** without changing any balances. Invoice stock-coverage/price-difference valuation is not implemented.

Batch-managed movements identify one batch. Opening stock starts in its specified batch at the main location; further receipts can introduce other batches. The batch ledger shows quantities in both locations. Issues, 311 transfers and 122 returns check the selected batch/location rather than borrowing another batch's stock. Returns inherit their referenced receipt's batch; an explicitly different batch is rejected. Cancellations restore the original batch and location quantities. The warehouse transfer controls also require the batch. Negative batch balances are not supported in this model. No automatic batch selection, classification, shelf-life/status or QM rules are implied.

**Valuation class** is an editable account-determination attribute, displayed alongside symbolic BSX/GBB postings and retained in handovers and run snapshots. The model does not derive or verify a real SAP G/L account from it. Confirm the valuation class, account category reference, valuation grouping and transaction settings in the client.

### Explicit split valuation

Enable split valuation for valuated stock procurement. Maintain a category key and up to eight types, each with its code, valuation class, S/V control, applicable price, opening quantity and optional opening batch. Example category H and LOCAL/IMPORT keys are illustrative. Configured category/type assignments, PO procurement eligibility and the required accounting records are assumed to exist in the target system. Automatic category X is labelled outside coverage.

The material header uses V and sums all type quantities and values; each type can use S or V and its own valuation class. Its opening quantity is calculated from the type rows. Each movement selects one type; a referenced return/cancellation can inherit it and rejects a conflicting explicit selection. PO tolerance is shared across all type receipts. Availability, valuation and expense postings affect the selected type; stock in another type cannot cover a withdrawal. A 311 keeps the type unchanged. Transfers between valuation types are outside coverage.

With batch management and split valuation together, a batch retains one type assignment within the plant, including after a posting cancellation. Batch and valuation type are separate identifiers. Batches of one type share its price. The latest-active-posting cancellation limit applies across all types, not independently within each type. The type ledger, selected transaction explanation, batch ledger, saved run and printable handover retain this context.

Saved snapshots from `mm-core-2026-10-21.1` and `.2` replay with their original supported controls. Material attributes remain valid for `.2`. MAP, batch and split-valuation inputs require the new rule version; applying trial changes explicitly upgrades the local trial's version. Existing proposal definitions are not silently rewritten.

### Explicit boundary

One product, one base unit, one PO item, one plant, two preconfigured/extended storage locations, MYR, unrestricted-use own stock, S/V valuation, optional manual batches and explicit split-valuation types, and single K assignment. Automatic account determination is assumed complete. The rule catalogue uses readable simulator codes, not invented SAP error IDs.

Not implemented: invoices/credit memos, tax/freight, FX, multiple assignments, posting periods/authorisations, services, special stock, stock-type/material/cross-plant transfers, two-step transfers/STOs, batch classification/expiry/automatic determination, category X automatic batch valuation, QM/EWM, PP production postings or SD/customer returns. An unmodelled transaction shows **Not covered** and does not alter balances. Delivery completed is not treated as an unconditional GR prohibition.

## SAP source catalogue

Reviewed 22 October 2026; the implemented version is `mm-core-2026-10-22.1`. Earlier rule snapshots remain supported.

- [S/V valuation and MAP](https://learning.sap.com/courses/business-processes-in-sap-s-4hana-sourcing-procurement/analyzing-material-valuation)
- [Batch management](https://learning.sap.com/courses/optimizing-advanced-logistics-and-analytics-in-sap-s-4hana-cloud-public-edition/exploring-batch-management-blf-_a5f5f6ac-d3ac-489c-954a-6e3079e8cd0c)
- [Split valuation, header V, type S/V and classes](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/configuring-split-valuation)
- [Batch versus valuation type](https://help.sap.com/docs/SUPPORT_CONTENT/erpscm/3362168389.html)
- [Valuation classes and account category references](https://learning.sap.com/courses/cross-functional-customizing-in-sap-s-4hana-materials-management/creating-valuation-classes-and-account-category-references)
- [Stock versus consumption procurement and account assignment](https://learning.sap.com/courses/business-processes-in-sap-s-4hana-sourcing-procurement/comparing-procurement-processes-for-stock-and-consumption)
- [UNBW and NLAG goods movements](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/posting-goods-movements-for-material-types-unbw-and-nlag)
- [UNBW cost timing in Purchasing](https://learning.sap.com/courses/purchasing-in-sap-s-4hana/creating-material-master-records-for-purchasing)
- [Standard-price valuation and purchase-price differences](https://learning.sap.com/courses/implementing-sap-s-4hana-cloud-public-edition-sourcing-and-procurement/maintaining-product-master-data_d2afaa5c-c344-4d00-851f-f117ad075d77)
- [Receipt tolerances](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/applying-tolerances-and-the-delivery-completed-indicator)
- [Negative stock permissions](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/allowing-negative-stock)
- [Cancellations and supplier returns](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/posting-cancellations-return-deliveries-and-returns)
- [Storage-location transfers and unchanged plant valuation](https://learning.sap.com/courses/inventory-management-and-physical-inventory-in-sap-s-4hana/performing-stock-transfers-between-storage-locations)
- [311/312 in Transfer Stock – In-Plant](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/91b21005dded4984bcccf4a69ae1300c/724f8054884f415be10000000a4450e5.html)
- [PO goods-receipt relevance](https://help.sap.com/docs/PRODUCT_ID/91b21005dded4984bcccf4a69ae1300c/9763bd534f22b44ce10000000a174cb4.html)

## Files, saving and limits

- `solution-valuation.js`: exact MAP arithmetic, batch stock, split-valuation routing and compatibility checks.
- `solution-valuation-ui.js` / `.css`: editable valuation controls, type/batch ledgers and explanatory price cards.
- `solution-engine.js`: record rules, relationship checks, snapshots, decisions, delivery links and pure posting calculations.
- `solution-demo.js`: fictional business and explicit sample-copy mapping.
- `solution-simulation.js`: local trial inputs, playback, explanations and transaction controls.
- `solution-studio.js`: product/process/proposal maintenance, lanes, tour, review and delivery UI.
- `solution-studio.css`: responsive blueprint desk, animated flows and success/error effects. Reduced motion, Animations Off and hidden-page pausing are respected.

Real definitions, decisions, handoff links and kept runs use `workhub.solutionStudio` in the existing private account JSON document and its existing autosave, backup, restore and conflict handling. No new table, grant, auth policy or public access is introduced. Demo records are created in memory and are not included in account backups unless explicitly copied as definitions.

Per project: 200 products, 250 processes, 600 proposals, 600 decisions, 100 kept runs and 300 delivery links. Each lane/requirements list supports 40 entries; each run supports 40 transactions. Decision design snapshots are limited to 60,000 characters. Account collection limits and the existing 16 MiB document limit still apply; oversize changes fail visibly rather than dropping records.

Meaningful regression tests are in `tests/solution.test.mjs` and the Solution Studio group in `tests/app.test.mjs`. Run `npm test` for the full application/database suite.
