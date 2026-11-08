# Describe an animated process — without AI

Open **Process Hub → Animated processes → Describe a process**. The generator uses maintained rules in the browser. It makes no AI request and has no API key, model or new external service.

## Quick start

Choose **Use CR Form example**, then **Generate draft preview**. The example includes actions, responsible roles and an Approved / Otherwise decision. Review the steps and notes, choose **Open in animated editor**, then choose **Save process** when satisfied. Generation and opening a draft do not save account records. The existing canvas, animation, playback, editing and export tools are used.

You can write ordered steps using `then`, commas, arrows, semicolons or new lines. Numbered lists also work. Double quotes protect a value containing commas or words such as “then”. Ordinary instructions that do not match a maintained sentence pattern remain task steps; the preview explains when no structured fields or quantity effect were inferred.

## Maintain your vocabulary

**Sentence rules** has four sections. All row changes are staged until **Save rules**. Removing a staged row has Undo. Reload saved rules discards the current rule draft and reads the latest saved set.

- **Terms & values:** define a unique key, readable name, aliases, meaning and target field. Number/text terms map to sample fields. Entity terms map to the existing company, plant, storage-location, material, batch, valuation and unit fields. Values use one line per entry: `value | display name | alias one, alias two`.
- **People & departments:** maintain names and aliases separately. For example, the Person term can contain `John Tan | John Tan | John`, while Department contains `Warehouse | Warehouse team | stores`.
- **Actions:** maintain verbs/aliases, animated step type and optional quantity effect. Effects set, add to or subtract from a named sample counter. Receive, issue and transfer have separate activity counters by default; they do not imply an opening inventory balance. Explicitly configure your own balance counter and starting sample value when needed.
- **Sentence patterns:** connect literal wording and `{termKey}` placeholders to an action. `{action}` at the start matches that action’s maintained aliases. Each other placeholder may appear once, with literal text between placeholders. More specific literal wording takes priority. Equally specific conflicting matches are flagged for correction.

Example setup: maintain `QA01 | Quality store | quality warehouse` under SLoc, and the Warehouse/John entries above. Then enter:

```
Warehouse: Receive 120 into SLoc QA01.
If quantity exceeds 100, John: Request approval.
Otherwise, Warehouse: Review the receipt.
After both routes: Close the record.
```

A pattern such as `{action} {quantity} into SLoc {SLoc} by {department}` also binds a responsible department directly. A typed `Name: Action` prefix assigns that step. Known names use their maintained Person/Department identity; unmatched explicit roles remain exactly as typed with a review note. The optional default responsible field supplies responsibility on other steps.

## Match review and references

Entity placeholders use the term’s maintained values and entity information already saved in Process Hub steps. The generated step keeps the actual entity value, including available plant context, in its existing detail fields. Unrecognised or ambiguous values block opening the draft until a maintained match is chosen or the rules are corrected. Match selectors can search maintained entries. An explicit replacement is reflected in generated instructions, while the original description remains in process notes.

Two locations with the same code in different contexts remain separate choices. Data changing after preview requires a new preview. Rules and existing generated processes are independent: editing a rule changes later generation, without rewriting previously saved process steps.

## Decisions

One `If … / Otherwise …` block is supported per description. `If approved … If rejected …` is also recognised. Add additional or nested decisions in the existing canvas editor. `After both routes:` explicitly rejoins the branches; the generator does not silently join them.

Defined number/text conditions support `=`, `!=`, `>`, `<`, `>=`, `<=`, `exceeds`, `equals`, `is greater than`, `is less than` and `is`. The field name or alias must identify a maintained number/text term. Matched numeric inputs populate their sample fields. Other fields can be supplied under **Starting sample values**, one `Field = value` per line, such as `Status = Approved`.

Automatic playback evaluates the condition against current sample values at that step, including earlier value changes. Text equality ignores case and surrounding spaces. Interactive playback or an explicit scenario route can override it. A condition such as “approved” without a defined sample comparison remains a named interactive decision; its automatic default is stated in the preview.

Both private step editors include **Automatic condition**, with the sample field, comparison, numeric/text value type and an enable switch. The first named answer is the matching route, the second is Otherwise. Clear the switch for a manual decision. Scenario settings can retain **Evaluate the automatic condition** or explicitly choose a route.

## Saving, access and limits

Rules live at the optional `workhub.rehearsal.sentenceRules` key in the existing private account document and JSON backups. Untouched accounts do not receive new defaults in storage. Generated processes use the existing rehearsal collection and validation. No database migration or new dependency is required.

Process Hub Create permission is required to generate and open a draft; Edit permission is required to maintain rules. Existing account save and data-change permissions apply when saving the process. Account switches and permission changes invalidate open builders/editors. Conflicting rule saves are rejected with the local draft retained for review.

Limits: 12,000 input characters, 80 generated nodes including the decision, 30 terms, 40 actions, 100 patterns, 200 manually maintained values per term and a 500 KB rule budget. Existing process/sample-value limits still apply. Template matching uses bounded literal scans rather than user expressions or executable code.

## Verification

The pure sentence tests cover rule bounds, specificity, quoting, aliases, unknown/ambiguous references, responsibilities, conditions, sample changes, branch joins, replacement values and bounded pattern matching. Process Hub tests cover rule staging, generation/save, unchanged old records, private condition editing, stale state and permissions. Application tests exercise actual Create/Edit guards, cloud saving/reopen, backups and account changes. Browser checks use an isolated synthetic account at desktop and 390 px widths.
