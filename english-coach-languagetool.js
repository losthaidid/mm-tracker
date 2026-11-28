/* A user-started check against LanguageTool's public proofreading API. */
(function (root) {
  'use strict';

  const endpoint = 'https://api.languagetool.org/v2/check';
  const maxBytes = 20000;
  const cutsCharacter = (text, at) =>
    /[\uD800-\uDBFF]/.test(text[at - 1] ?? '') && /[\uDC00-\uDFFF]/.test(text[at] ?? '');

  function suggestion(text, match) {
    let start = match?.offset;
    let end = start + match?.length;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(match?.length) ||
      start < 0 ||
      end < start ||
      end > text.length ||
      cutsCharacter(text, start) ||
      cutsCharacter(text, end) ||
      typeof match.message !== 'string' ||
      !match.message.trim()
    )
      return;

    let original = text.slice(start, end);
    let replacement = Array.isArray(match.replacements)
      ? match.replacements.find(item => typeof item?.value === 'string' && item.value !== original)
          ?.value
      : undefined;
    if (start === end) {
      // Anchor insertions to a neighbouring character in the same editor line.
      const before = /[^\r\n\t](?![\s\S])/u.exec(text.slice(0, start))?.[0];
      const after = /^[^\r\n\t]/u.exec(text.slice(end))?.[0];
      if (before) {
        start -= before.length;
        original = before;
        if (replacement !== undefined) replacement = before + replacement;
      } else if (after) {
        end += after.length;
        original = after;
        if (replacement !== undefined) replacement += after;
      } else return;
    }

    const engine = root.WorkHubEnglishCoachEngine;
    let edit;
    if (
      replacement !== undefined &&
      !/[\r\n\t]/.test(original + replacement) &&
      text.length - original.length + replacement.length <= engine.maxText
    ) {
      edit = engine.changedRange(original, replacement, start);
      if (cutsCharacter(text, edit.start) || cutsCharacter(text, edit.end))
        edit = { start, end, replacement };
    }
    const ruleId = typeof match.rule?.id === 'string' ? match.rule.id : 'review';
    return {
      id: 'languagetool:' + ruleId.slice(0, 120),
      type: 'LanguageTool',
      reason: match.message.slice(0, 600),
      start,
      end,
      original,
      replacement: edit ? replacement : null,
      edit,
    };
  }

  async function check(text, signal) {
    if (!text.trim()) throw new Error('Write a draft before checking it with LanguageTool.');
    if (new TextEncoder().encode(text).length > maxBytes)
      throw new Error('This draft exceeds LanguageTool’s 20 KB limit. Check a shorter draft.');

    let response;
    try {
      response = await root.fetch(endpoint, {
        method: 'POST',
        body: new URLSearchParams({ text, language: 'en-GB' }),
        signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      });
    } catch {
      throw new Error(
        signal.aborted
          ? 'LanguageTool took too long to respond. Try again.'
          : 'LanguageTool could not be reached. Try again when connected.'
      );
    }
    if (response.status === 429)
      throw new Error(
        'LanguageTool’s free limit was reached. Wait a minute before checking again.'
      );
    if (response.status === 413) throw new Error('LanguageTool requires a shorter draft.');
    if (!response.ok) throw new Error('LanguageTool could not finish the check. Try again later.');
    const result = await response.json().catch(() => null);
    if (!Array.isArray(result?.matches))
      throw new Error('LanguageTool returned an unreadable result. Try again later.');
    return result.matches
      .slice(0, 100)
      .map(match => suggestion(text, match))
      .filter(Boolean);
  }

  function additionalIssues(local, fromService) {
    const occupied = local.map(issue => issue.edit ?? issue);
    return fromService.filter(issue => {
      const range = issue.edit ?? issue;
      if (occupied.some(other => range.start < other.end && other.start < range.end)) return false;
      occupied.push(range);
      return true;
    });
  }

  function afterEdit(review, edit, text) {
    const expected =
      review.text.slice(0, edit.start) + edit.replacement + review.text.slice(edit.end);
    if (text !== expected) return null;
    const shift = edit.replacement.length - (edit.end - edit.start);
    const offset = range => ({ ...range, start: range.start + shift, end: range.end + shift });
    const issues = [];
    for (const issue of review.issues) {
      if (issue.end <= edit.start) issues.push(issue);
      else if (issue.start >= edit.end)
        issues.push({ ...offset(issue), edit: issue.edit ? offset(issue.edit) : undefined });
    }
    return { text, issues };
  }

  root.WorkHubEnglishCoachLanguageTool = { check, additionalIssues, afterEdit };
})(globalThis);
