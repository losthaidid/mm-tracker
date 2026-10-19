/**
 * recipients-engine.js
 * Pure rules for company email recipient lists.
 * Saved under state.workhub.recipients. Provides parsing, duplicate checks and plain address output.
 * No interface or email sending. Change display labels in recipients.js and recipients.css.
 * File map: docs/FILE-MAP.md
 */
/* Company email lists: validation, bulk entry and plain-address copying. */
(function (root) {
  'use strict';
  const ROLES = { to: 'To', cc: 'Cc', bcc: 'Bcc' },
    SEPARATORS = { semicolon: '; ', comma: ', ', lines: '\n' };
  const key = value =>
    String(value ?? '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  const text = (value, max, multiline = false) =>
    typeof value === 'string' &&
    value.length <= max &&
    !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(
      value
    );
  function email(value) {
    if (typeof value !== 'string' || value !== value.trim() || value.length > 254) return false;
    const parts = value.split('@');
    if (parts.length !== 2 || parts[0].length > 64) return false;
    return (
      /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*$/.test(parts[0]) &&
      parts[1].length <= 253 &&
      parts[1].includes('.') &&
      parts[1]
        .split('.')
        .every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)) &&
      !/^\d+$/.test(parts[1].split('.').at(-1))
    );
  }
  function upgrade(d) {
    if (d.workhub && d.workhub.recipients === undefined)
      d.workhub.recipients = { version: 1, companies: [] };
    return d;
  }
  function validateCompany(c) {
    if (
      !c ||
      !text(c.id, 100) ||
      !c.id.trim() ||
      !text(c.name, 200) ||
      !c.name.trim() ||
      !text(c.notes, 2000, true)
    )
      throw Error('Enter a company name (up to 200 characters) and valid notes.');
    if (!Array.isArray(c.contacts) || c.contacts.length > 500)
      throw Error('A company can hold up to 500 email recipients.');
    const ids = new Set(),
      addresses = new Set();
    for (const r of c.contacts) {
      if (
        !r ||
        !text(r.id, 100) ||
        !r.id.trim() ||
        ids.has(r.id) ||
        !text(r.name, 120) ||
        !email(r.email) ||
        !Object.hasOwn(ROLES, r.role) ||
        typeof r.enabled !== 'boolean'
      )
        throw Error('Check each recipient’s name, email address, To/Cc/Bcc group and copy switch.');
      const address = r.email.toLowerCase();
      if (addresses.has(address))
        throw Error(
          'That email address already exists for this company. Edit the existing recipient instead.'
        );
      ids.add(r.id);
      addresses.add(address);
    }
    return c;
  }
  function validate(d) {
    const directory = d.workhub?.recipients;
    if (
      !directory ||
      directory.version !== 1 ||
      !Array.isArray(directory.companies) ||
      directory.companies.length > 200
    )
      throw Error('Check the email directory (up to 200 companies).');
    const ids = new Set(),
      names = new Set();
    let total = 0;
    for (const c of directory.companies) {
      validateCompany(c);
      if (ids.has(c.id)) throw Error('Company email list IDs must be unique.');
      if (names.has(key(c.name)))
        throw Error('A recipient list with that company name already exists.');
      ids.add(c.id);
      names.add(key(c.name));
      total += c.contacts.length;
    }
    if (total > 5000) throw Error('The email directory supports up to 5,000 recipients in total.');
    return d;
  }
  /** Parse all entries before saving; a malformed item rejects the whole bulk edit. */
  function parseList(value) {
    if (typeof value !== 'string' || value.length > 160000)
      throw Error('Paste a list of up to 500 email addresses.');
    const tokens = [];
    let token = '',
      quoted = false,
      angle = false,
      escaped = false;
    for (const char of value) {
      if (escaped) {
        token += char;
        escaped = false;
        continue;
      }
      if (quoted && char === '\\') {
        token += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        token += char;
        continue;
      }
      if (!quoted && char === '<') {
        if (angle) throw Error('Check the name <email> brackets in your list.');
        angle = true;
      }
      if (!quoted && char === '>') {
        if (!angle) throw Error('Check the name <email> brackets in your list.');
        angle = false;
      }
      if (!quoted && !angle && /[,;\r\n]/.test(char)) {
        if (token.trim()) tokens.push(token.trim());
        token = '';
      } else token += char;
    }
    if (quoted || angle || escaped)
      throw Error('Close the quotes and name <email> brackets in your list.');
    if (token.trim()) tokens.push(token.trim());
    if (!tokens.length || tokens.length > 500)
      throw Error('Paste between 1 and 500 email addresses.');
    return tokens.map((token, index) => {
      const display = token.match(/^([^<>]*)<([^<>]+)>$/);
      let name = display ? display[1].trim() : '',
        address = display ? display[2].trim() : token;
      if (name.startsWith('"') && name.endsWith('"'))
        name = name.slice(1, -1).replace(/\\(["\\])/g, '$1');
      if (!text(name, 120) || !email(address))
        throw Error(
          'Check email entry ' + (index + 1) + '. Use name@company.com or Name <name@company.com>.'
        );
      return { name, email: address };
    });
  }
  /** Validate additions and skip case-insensitive duplicates without overwriting existing contacts. */
  function addition(company, value, role, makeId) {
    if (!Object.hasOwn(ROLES, role)) throw Error('Choose To, Cc or Bcc.');
    const seen = new Set(company.contacts.map(r => r.email.toLowerCase())),
      contacts = [];
    let skipped = 0;
    for (const r of parseList(value)) {
      const address = r.email.toLowerCase();
      if (seen.has(address)) {
        skipped++;
        continue;
      }
      seen.add(address);
      contacts.push({ id: makeId(), ...r, role, enabled: true });
    }
    if (company.contacts.length + contacts.length > 500)
      throw Error('A company can hold up to 500 email recipients.');
    return { contacts, skipped };
  }
  function recipients(company, role = 'all') {
    if (role !== 'all' && !Object.hasOwn(ROLES, role)) throw Error('Choose a recipient group.');
    const seen = new Set(),
      out = [];
    for (const group of Object.keys(ROLES))
      for (const r of company.contacts) {
        const address = r.email.toLowerCase();
        if (
          r.enabled &&
          r.role === group &&
          (role === 'all' || role === group) &&
          !seen.has(address)
        ) {
          seen.add(address);
          out.push(r);
        }
      }
    return out;
  }
  /** Return plain enabled email addresses in the selected group and separator. */
  function copyText(company, role = 'all', separator = 'semicolon') {
    if (!Object.hasOwn(SEPARATORS, separator)) throw Error('Choose an address separator.');
    return recipients(company, role)
      .map(r => r.email)
      .join(SEPARATORS[separator]);
  }
  root.WorkHubRecipientsEngine = {
    ROLES,
    SEPARATORS,
    key,
    email,
    upgrade,
    validate,
    validateCompany,
    parseList,
    addition,
    recipients,
    copyText,
  };
})(window);
