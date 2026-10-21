# Product & Process Solution Studio

Open **Projects → Solution Studio**, or its card in Project Overview. Your existing project, company and MM area lists remain the starting point.

## Learn from the complete sample

An empty Studio opens the **Demo business**: Meridian Food Manufacturing, a fictional bread manufacturer. It has five product groups, seven business users, eight current processes, sixteen requirements, ten proposals, an example business decision and four saved simulation walkthroughs.

The product groups are raw ingredients, packaging, finished goods, maintenance spare parts and consumables. Shared approvals and supplier returns demonstrate that a process can apply to several products. Finished-goods production and customer dispatch show discovery and specialist design; their PP/SD/QM transactions are explicitly outside this inventory model.

**Saved runs** also includes 311/312 transfer cancellation, 201/202 and 101/102 cancellation, and partial receipt / overdelivery examples.

Choose **Guided sample tour** to follow the maintenance-bearing example through discovery, three alternatives, playback, an invalid non-stock inventory receipt, a valid consumption receipt and business review. **Reset demo** recreates the sample. Demo edits and demo run saves live only in the page session and do not change your private account records.

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

The display shows plant stock, inventory value, consumption cost, net PO receipts, price differences, GR/IR and quantities in both storage locations. No separate valuation area is invented for the second location.

| Supported transaction | Model behaviour |
| --- | --- |
| PO goods receipt · 101 | Check the configured receipt destination, account assignment, GR expected flag and overdelivery tolerance. Partial receipts are valid. |
| Cost-centre goods issue · 201 | Check the selected location's stock and cost centre. Valuated stock consumption uses standard price. UNBW quantity-only issues do not charge purchase cost again. |
| Same-plant storage-location transfer · 311 | Same material, unrestricted stock and two defined locations: source decreases and destination increases. Plant stock/value, GR/IR and consumption cost are unchanged; no FI posting. |
| Referenced supplier return · 122 | Require eligible quantity on a successful receipt and available source-location stock. Update net received quantity and the supported stock/accounting effects. This is not a customer return or returns PO 161. |
| Referenced cancellation · 102 / 202 / 312 | Reverse the last active GR, issue or 311 transfer and its exact model effects. This latest-posting restriction is a simulator limitation, not a universal SAP restriction. Cancellation of 122 is outside this model. |

### Product and valuation profiles

- **Valuated stock:** inventory at standard price, GR/IR at PO price, difference to symbolic price differences. Separate PO and standard prices are maintained.
- **Quantity-only stock / UNBW baseline:** quantities are managed; no inventory value. Under the supported valuated-GR K assignment, PO GR recognises purchase cost. Later GI changes quantity and consumption statistics, with no additional FI cost.
- **Non-stock / NLAG baseline:** an account-assigned PO GR for consumption is valid. No inventory quantity/value is created. An attempted stock receipt, stock issue or storage transfer fails with an explanation.
- **Valuated material, direct-consumption purpose:** with K assignment, receipt records consumption rather than inventory.

K requires a cost centre and consumption G/L account. Negative stock requires both explicit configuration and material permissions in the profile. The GR expected flag and PO GR non-valuated indicator are separate controls; the latter's timing is not implemented and is labelled outside coverage.

Money uses integer sen and quantities use thousandths. Standard-price inventory and PO accrual are rounded cumulatively to avoid fractional-quantity residual balances. Accounting lines are symbolic and balanced, not verified real account determination.

### Explicit boundary

One product, one base unit, one PO item, one plant, two preconfigured/extended storage locations, MYR, unrestricted-use own stock, fixed standard price and single K assignment. Automatic account determination is assumed complete. The rule catalogue uses readable simulator codes, not invented SAP error IDs.

Not implemented: moving-average price, invoices/credit memos, tax/freight, FX, multiple assignments, posting periods/authorisations, services, split valuation, special stock, stock-type/material/cross-plant transfers, two-step transfers/STOs, batch/QM/EWM, PP production postings or SD/customer returns. An unmodelled transaction shows **Not covered** and does not alter balances. Delivery completed is not treated as an unconditional GR prohibition.

## SAP source catalogue

Reviewed 21 October 2026; the implemented version is `mm-core-2026-10-21.1`.

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

- `solution-engine.js`: record rules, relationship checks, snapshots, decisions, delivery links and pure posting calculations.
- `solution-demo.js`: fictional business and explicit sample-copy mapping.
- `solution-simulation.js`: local trial inputs, playback, explanations and transaction controls.
- `solution-studio.js`: product/process/proposal maintenance, lanes, tour, review and delivery UI.
- `solution-studio.css`: responsive blueprint desk, animated flows and success/error effects. Reduced motion, Animations Off and hidden-page pausing are respected.

Real definitions, decisions, handoff links and kept runs use `workhub.solutionStudio` in the existing private account JSON document and its existing autosave, backup, restore and conflict handling. No new table, grant, auth policy or public access is introduced. Demo records are created in memory and are not included in account backups unless explicitly copied as definitions.

Per project: 200 products, 250 processes, 600 proposals, 600 decisions, 100 kept runs and 300 delivery links. Each lane/requirements list supports 40 entries; each run supports 40 transactions. Decision design snapshots are limited to 60,000 characters. Account collection limits and the existing 16 MiB document limit still apply; oversize changes fail visibly rather than dropping records.

Meaningful regression tests are in `tests/solution.test.mjs` and the Solution Studio group in `tests/app.test.mjs`. Run `npm test` for the full application/database suite.
