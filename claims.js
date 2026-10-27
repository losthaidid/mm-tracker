/**
 * claims.js
 * Location/rate settings, booking mileage inputs and the monthly expense ledger.
 * Uses claims-engine.js for calculations and a.mutate() to save reviewed edits.
 * Changing a route does not rewrite the distance or rate already captured on an older booking.
 * File map: docs/FILE-MAP.md
 */
/* Mileage inputs, maintainable routes and a monthly claim ledger. */
(function (root) {
  'use strict';
  const E = root.WorkHubClaimsEngine,
    esc = v =>
      String(v ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      ),
    uid = () =>
      root.crypto?.randomUUID?.() ||
      'claim-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const options = (rows, value, blank = '') =>
    (blank ? '<option value="">' + esc(blank) + '</option>' : '') +
    rows
      .map(
        ([id, label]) =>
          '<option value="' +
          esc(id) +
          '"' +
          (value === id ? ' selected' : '') +
          '>' +
          esc(label) +
          '</option>'
      )
      .join('');
  const input = (name, label, value = '', type = 'text', extra = '') =>
    '<div><label for="claim-' +
    name +
    '">' +
    esc(label) +
    '</label><input id="claim-' +
    name +
    '" name="' +
    name +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    extra +
    '></div>';
  const office = value =>
    String(value || '')
      .trim()
      .toLowerCase() === 'office';
  function draft(form, kind) {
    if (root.WorkHubLeave.isLeave(kind) || office(form.elements.namedItem('location')?.value))
      return null;
    const get = k => form.elements.namedItem(k)?.value || '',
      locationId = get('travelLocationId');
    if (!locationId || locationId === '__one-off__') return null;
    return {
      locationId,
      locationName: get('travelLocationName'),
      oneWayKm: Number(get('travelKm')),
      ratePerKm: Number(get('travelRate')),
      journey: get('travelJourney') || 'return',
      visits: Number(get('travelVisits')),
      claimable: !!form.elements.namedItem('travelClaimable')?.checked,
    };
  }
  function context(form, kind, strict = false) {
    if (root.WorkHubLeave.isLeave(kind)) return {};
    if (office(form.elements.namedItem('location')?.value))
      return { claimType: 'client-site', claimLocationName: '' };
    const claimType = form.elements.namedItem('claimType')?.value || 'client-site',
      oneOff = form.elements.namedItem('travelLocationId')?.value === '__one-off__',
      claimLocationName = oneOff
        ? (form.elements.namedItem('claimLocationName')?.value || '').trim()
        : '';
    if (strict && (!Object.hasOwn(E.CLAIM_TYPES, claimType) || (oneOff && !claimLocationName)))
      throw Error('Choose a claim type and enter the one-off destination.');
    return { claimType, claimLocationName };
  }
  function read(form, kind) {
    const t = draft(form, kind);
    if (t) {
      for (const key of ['travelKm', 'travelRate', 'travelVisits'])
        if (!form.elements.namedItem(key)?.value.trim())
          throw Error('Enter the distance, rate and visits.');
      E.validateTravel(t);
    }
    return t;
  }
  function fields(s, d) {
    if (root.WorkHubLeave.isLeave(s.kind)) return '';
    const t = s.travel || null,
      locations = d.workhub.claims.locations.filter(l => !l.archived || l.id === t?.locationId),
      selected = t?.locationId || (s.claimLocationName ? '__one-off__' : '');
    return `<section class="claim-travel wide" data-claim-booking="${esc(s.bookingId || '')}"><div class="claim-section-heading"><span class="claim-route-icon" aria-hidden="true">↗</span><div><span class="hub-kicker">ON-SITE VISIT</span><h3>Location & mileage</h3><p>One visit entry per booked date, with its own saved rate.</p></div></div>${
      s.kind !== 'project'
        ? '<label for="claimWorkLocation">Work location (optional)</label><select id="claimWorkLocation" name="location">' +
          options(
            d.lists.workLocations.map(l => [l, l]),
            s.location || '',
            'Not specified'
          ) +
          '</select>'
        : ''
    }<fieldset data-claim-visit-fields${office(s.location) ? ' hidden disabled' : ''}><div class="claim-context-grid"><div><label for="bookingClaimType">Claim type</label><select id="bookingClaimType" name="claimType">${options(Object.entries(E.CLAIM_TYPES), E.claimType(s))}</select></div><div><label for="travelLocationId">Claim destination / mileage route</label><select id="travelLocationId" name="travelLocationId">${options(
      locations.map(l => [l.id, l.name + (l.archived ? ' · archived' : '')]),
      selected,
      'No on-site visit / no mileage'
    )}<option value="__one-off__"${selected === '__one-off__' ? ' selected' : ''}>One-off destination · no mileage</option>${selected && selected !== '__one-off__' && !locations.some(l => l.id === selected) ? '<option value="' + esc(selected) + '" selected>' + esc(t.locationName) + ' · saved route</option>' : ''}</select></div></div><div data-claim-one-off${selected === '__one-off__' ? '' : ' hidden'}><label for="bookingClaimLocation">One-off destination</label><input id="bookingClaimLocation" name="claimLocationName" maxlength="120" value="${esc(s.claimLocationName || '')}"${selected === '__one-off__' ? ' required' : ' disabled'} placeholder="e.g. Training venue"><p class="hint">Tolls and other expenses can be linked to this visit. Save a mileage route in Settings if you also need a kilometre claim.</p></div>${!locations.length ? '<p class="hint">Add reusable destinations and rates in Settings → On-site locations & mileage.</p>' : ''}<input name="travelLocationName" type="hidden" value="${esc(t?.locationName || '')}"><fieldset data-claim-route-fields${t ? '' : ' hidden'}${t ? '' : ' disabled'}><div class="form-grid">${input('travelKm', 'One-way distance (km)', t?.oneWayKm ?? '', 'number', 'min="0.01" max="10000" step="0.01" required')}${input('travelRate', 'Mileage rate (RM / km)', t?.ratePerKm ?? '', 'number', 'min="0" max="1000" step="0.0001" required')}<div><label for="travelJourney">Journey</label><select id="travelJourney" name="travelJourney">${options(Object.entries(E.JOURNEYS), t?.journey || 'return')}</select></div>${input('travelVisits', 'Visits per date', t?.visits || 1, 'number', 'min="1" max="20" step="1" required')}</div><label class="check-label"><input name="travelClaimable" type="checkbox"${t?.claimable ? ' checked' : ''}>Include this mileage in my monthly claim</label><div class="claim-trip-preview" data-claim-preview aria-live="polite"></div><p class="claim-duplicate-note" data-claim-duplicate hidden></p><div class="claim-route-footer"><small>Saved distance and rate stay with this booking. Toll and parking receipts are added separately.</small><button type="button" class="small" data-claim="latest-route">Use latest mapping</button></div></fieldset></fieldset><p class="hint" data-claim-office-note${office(s.location) ? '' : ' hidden'}>Office work has no on-site claim destination or mileage.</p></section>`;
  }
  function badge(slot) {
    if (!slot.travel && !slot.claimLocationName) return '';
    const t = slot.travel;
    return (
      '<span class="claim-booking-badge">↗ ' +
      esc(t?.locationName || slot.claimLocationName) +
      ' · ' +
      E.CLAIM_TYPES[E.claimType(slot)] +
      (t?.claimable ? ' · ' + E.km(E.distance(t)) + ' km' : ' · no mileage') +
      '</span>'
    );
  }
  function details(slot, d) {
    if (root.WorkHubLeave.isLeave(slot.kind)) return '';
    if (!slot.travel)
      return slot.claimLocationName
        ? `<section class="claim-booking-details"><h3>${esc(slot.claimLocationName)}</h3><p>${E.CLAIM_TYPES[E.claimType(slot)]} · No mileage</p><button type="button" data-claim="add-expense" data-date="${esc(slot.date)}" data-booking="${esc(slot.bookingId || '')}">＋ Add toll / other expense</button></section>`
        : '';
    const t = slot.travel,
      booking = E.trips(d).filter(x => x.bookingId && x.bookingId === slot.bookingId),
      count = booking.length || 1,
      cost = E.travelCost(t);
    return `<section class="claim-booking-details"><div class="claim-section-heading"><span class="claim-route-icon" aria-hidden="true">↗</span><div><span class="hub-kicker">SAVED ROUTE</span><h3>${esc(t.locationName)}</h3><p>${E.CLAIM_TYPES[E.claimType(slot)]}</p></div></div><dl class="booking-facts"><div><dt>One-way distance</dt><dd>${E.km(t.oneWayKm)} km</dd></div><div><dt>Journey / visits</dt><dd>${E.JOURNEYS[t.journey]} · ${t.visits} per date</dd></div><div><dt>Saved rate</dt><dd>${E.rate(t.ratePerKm)} / km</dd></div><div><dt>Mileage per date</dt><dd>${E.km(E.distance(t))} km · ${E.money(cost)}</dd></div><div><dt>Included in claim</dt><dd>${t.claimable ? 'Yes' : 'No · mileage excluded'}</dd></div><div><dt>Booking mileage</dt><dd>${E.money(t.claimable ? cost * count : 0)} · ${count} booked date${count === 1 ? '' : 's'}</dd></div></dl><button type="button" data-claim="add-expense" data-date="${esc(slot.date)}" data-booking="${esc(slot.bookingId || '')}" data-location="${esc(t.locationId)}">＋ Add toll / other expense</button></section>`;
  }
  function install(a) {
    const $ = id => document.getElementById(id),
      data = () => a.state().workhub.claims;
    let owner = '',
      page = 0,
      monthSeen = '',
      lastDeleted = null,
      submissionDraft = null;
    const thisMonth = () => a.month(),
      day = () => {
        const selected = a.day?.();
        return selected?.startsWith(thisMonth())
          ? selected
          : a.today().startsWith(thisMonth())
            ? a.today()
            : thisMonth() + '-01';
      };
    const save = (fn, message) => {
      if (!a.ready()) throw Error('Sign in before saving expenses.');
      const ok = a.mutate(fn);
      if (ok && message) a.tell(message);
      return ok;
    };
    function resetOwner() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        owner = next;
        page = 0;
        monthSeen = '';
        lastDeleted = null;
        submissionDraft = null;
        if ($('claimSubmissionForm')) a.closeModal();
      }
    }
    function settings() {
      if (!a.ready()) return;
      if ($('settingsMenu')) $('settingsMenu').open = false;
      const locations = data().locations,
        rows = locations
          .map(
            l =>
              `<article class="claim-location-row${l.archived ? ' is-archived' : ''}"><span class="claim-route-icon" aria-hidden="true">↗</span><div><strong>${esc(l.name)}</strong>${l.address ? '<p>' + esc(l.address) + '</p>' : ''}<small>${E.km(l.oneWayKm)} km one way · ${E.rate(l.ratePerKm)} / km · ${E.JOURNEYS[l.journey]}${l.archived ? ' · Archived' : ''}</small></div><div class="actions"><button type="button" class="small" data-claim="edit-location" data-id="${esc(l.id)}">Edit</button><button type="button" class="small" data-claim="archive-location" data-id="${esc(l.id)}">${l.archived ? 'Restore' : 'Archive'}</button></div></article>`
          )
          .join('');
      a.openModal(
        'On-site locations & mileage',
        `<div class="claim-settings-intro"><span class="hub-kicker">YOUR ROUTES, YOUR RATES</span><h3>A little less claim admin.</h3><p>Save the one-way distance and RM rate for each site. Choose a site in Schedule, then use a one-way or return trip.</p><button type="button" class="primary" data-claim="edit-location">＋ Add on-site location</button></div><div class="claim-location-list">${rows || '<div class="claim-empty"><strong>Your first route starts here.</strong><p>Add a client site, branch or other on-site destination.</p></div>'}</div><p class="hint">Mapping changes apply to new selections. Existing bookings keep their saved distance and rate. Archive a location to hide it from new visits while keeping its history.</p>`
      );
    }
    function locationForm(id = '') {
      if (!a.ready()) return;
      const l = data().locations.find(l => l.id === id) || {
        id: '',
        name: '',
        address: '',
        oneWayKm: '',
        ratePerKm: '',
        journey: 'return',
      };
      a.openModal(
        id ? 'Edit on-site location' : 'Add on-site location',
        `<form id="claimLocationForm" data-id="${esc(l.id)}"><div class="claim-form-intro"><span class="hub-kicker">MILEAGE MAPPING · RM / KM</span><h3>A familiar route, ready to reuse.</h3></div><div class="form-grid">${input('name', 'Location name', l.name, 'text', 'maxlength="120" required autocomplete="off"')}${input('address', 'Route / address (optional)', l.address, 'text', 'maxlength="300"')}${input('oneWayKm', 'One-way distance (km)', l.oneWayKm, 'number', 'min="0.01" max="10000" step="0.01" required')}${input('ratePerKm', 'Cost per kilometre (RM)', l.ratePerKm, 'number', 'min="0" max="1000" step="0.0001" required')}<div><label for="claim-journey">Default journey</label><select id="claim-journey" name="journey">${options(Object.entries(E.JOURNEYS), l.journey)}</select></div></div><p class="hint">Enter your maintained distance and rate. A return trip doubles the one-way distance. You can adjust either value for a particular booking.</p><div class="modal-actions"><button type="button" data-claim="settings">Back to locations</button><button type="submit" class="primary">Save location</button></div></form>`
      );
    }
    function number(form, key, places, min, max, label) {
      const raw = form.elements.namedItem(key)?.value;
      if (raw === undefined || !raw.trim()) throw Error('Enter ' + label + '.');
      const value = Number(raw);
      if (!E.decimal(value, places, min, max)) throw Error('Check ' + label + '.');
      return value;
    }
    function saveLocation(form) {
      const value = k => form.elements.namedItem(k).value.trim(),
        id = form.dataset.id || uid(),
        old = data().locations.find(x => x.id === id),
        row = {
          id,
          name: value('name'),
          address: value('address'),
          oneWayKm: number(form, 'oneWayKm', 2, 0.01, 10000, 'the one-way distance'),
          ratePerKm: number(form, 'ratePerKm', 4, 0, 1000, 'the mileage rate'),
          journey: value('journey'),
          archived: old?.archived || false,
        };
      if (form.dataset.id && !old) throw Error('This location no longer exists.');
      if (
        save(d => {
          const list = d.workhub.claims.locations,
            index = list.findIndex(x => x.id === id);
          if (index < 0) list.push(row);
          else list[index] = row;
        }, 'On-site location saved. Existing trip rates are kept.')
      )
        settings();
    }
    function updateTravel(form, latest = false, resetVisit = false) {
      if (!form?.isConnected || form.id !== 'scheduleForm') return;
      const select = form.elements.namedItem('travelLocationId'),
        section = form.querySelector('[data-claim-route-fields]');
      if (!select || !section) return;
      const visit = form.querySelector('[data-claim-visit-fields]'),
        isOffice = office(form.elements.namedItem('location')?.value);
      if (visit) {
        visit.hidden = isOffice;
        visit.disabled = isOffice;
      }
      const officeNote = form.querySelector('[data-claim-office-note]');
      if (officeNote) officeNote.hidden = !isOffice;
      if (isOffice) {
        section.hidden = true;
        section.disabled = true;
        return;
      }
      const l = data().locations.find(l => l.id === select.value),
        oneOff = select.value === '__one-off__',
        selected = !!select.value && !oneOff,
        custom = form.querySelector('[data-claim-one-off]'),
        destination = form.elements.namedItem('claimLocationName');
      custom.hidden = !oneOff;
      destination.disabled = !oneOff;
      destination.required = oneOff;
      section.hidden = !selected;
      section.disabled = !selected;
      if (latest && l) {
        for (const [k, value] of Object.entries({
          travelLocationName: l.name,
          travelKm: l.oneWayKm,
          travelRate: l.ratePerKm,
          travelJourney: l.journey,
        }))
          form.elements.namedItem(k).value = value;
        if (resetVisit) {
          form.elements.namedItem('travelVisits').value = 1;
          form.elements.namedItem('travelClaimable').checked = true;
          const workLocation = form.elements.namedItem('location');
          if (
            E.claimType(context(form, form.elements.namedItem('kind').value)) === 'client-site' &&
            workLocation &&
            [...workLocation.options].some(o => o.value === 'Client site')
          )
            workLocation.value = 'Client site';
        }
      }
      const preview = form.querySelector('[data-claim-preview]'),
        warning = form.querySelector('[data-claim-duplicate]');
      if (!selected) {
        preview.textContent = '';
        warning.hidden = true;
        return;
      }
      try {
        const travel = read(form, form.elements.namedItem('kind').value),
          perDate = E.travelCost(travel),
          start = form.elements.namedItem('date').value,
          end = form.elements.namedItem('endDate').value || start,
          days =
            E.validDate(start) && E.validDate(end) && end >= start
              ? Math.round(
                  (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000
                ) + 1
              : 1;
        preview.innerHTML =
          '<strong>' +
          E.km(E.distance(travel)) +
          ' km × ' +
          E.rate(travel.ratePerKm) +
          ' / km = ' +
          E.money(perDate) +
          '</strong><span>' +
          (travel.claimable
            ? E.money(perDate * days) + ' for ' + days + ' booked date' + (days === 1 ? '' : 's')
            : 'Mileage excluded from your claim') +
          '. Toll and other expenses are separate.</span>';
        const booking = form.querySelector('[data-claim-booking]').dataset.claimBooking,
          duplicate = E.trips(a.state()).filter(
            t =>
              t.travel.claimable &&
              t.travel.locationId === travel.locationId &&
              t.bookingId !== booking &&
              t.date >= start &&
              t.date <= end
          );
        warning.hidden = !travel.claimable || !duplicate.length;
        if (!warning.hidden)
          warning.textContent =
            'Another mileage entry exists for this location on ' +
            [...new Set(duplicate.map(t => t.date))].slice(0, 3).join(', ') +
            '. If this is the same visit, untick Include mileage to avoid counting it twice.';
      } catch {
        preview.textContent =
          'Enter a valid distance, rate and number of visits to see your estimate.';
        warning.hidden = true;
      }
    }
    function expenseForm(id = '', context = {}) {
      if (!a.ready()) return;
      const old = data().expenses.find(e => e.id === id),
        site = data().locations.find(l => l.id === context.locationId),
        booking = a.state().schedule.find(s => s.bookingId && s.bookingId === context.bookingId),
        e = old || {
          id: '',
          date: context.date || day(),
          category: 'toll',
          amountCents: null,
          description: '',
          payment: E.PAYMENTS[0],
          locationId: site?.id || '',
          locationName: site?.name || booking?.claimLocationName || '',
          bookingId: context.bookingId || '',
          reference: '',
          notes: '',
          claimable: true,
          claimType: E.claimType(booking),
        },
        locations = data().locations.filter(l => !l.archived || l.id === e.locationId);
      a.openModal(
        id ? 'Edit expense' : 'Add toll / other expense',
        `<form id="claimExpenseForm" data-id="${esc(e.id)}" data-booking="${esc(e.bookingId)}" data-location-name="${esc(e.locationName)}" data-location-id="${esc(e.locationId)}"><div class="claim-form-intro"><span class="hub-kicker">TOLLS, PARKING & THE LITTLE EXTRAS</span><h3>Keep the whole visit together.</h3><p>${e.bookingId ? 'Linked to your scheduled visit.' : 'This expense is recorded against its own date.'}</p></div><div class="form-grid"><div><label for="expenseClaimType">Claim type</label><select id="expenseClaimType" name="claimType">${options(Object.entries(E.CLAIM_TYPES), E.claimType(e))}</select></div>${input('date', 'Expense date', e.date, 'date', 'min="1900-01-01" max="9999-12-31" required')}<div><label for="claim-category">Category</label><select id="claim-category" name="category">${options(Object.entries(E.CATEGORIES), e.category)}</select></div>${input('amount', 'Amount (RM)', e.amountCents === null ? '' : (e.amountCents / 100).toFixed(2), 'number', 'min="0.01" max="1000000" step="0.01" required')}${input('description', 'Description', e.description, 'text', 'maxlength="300" required placeholder="e.g. PLUS toll · client visit"')}<div><label for="claim-payment">Payment method</label><select id="claim-payment" name="payment">${options(
          E.PAYMENTS.map(p => [p, p]),
          e.payment
        )}</select></div><div><label for="claim-locationId">On-site location (optional)</label><select id="claim-locationId" name="locationId">${options(
          locations.map(l => [l.id, l.name + (l.archived ? ' · archived' : '')]),
          e.locationId || (e.locationName ? '__one-off__' : ''),
          'No specific site'
        )}<option value="__one-off__"${!e.locationId && e.locationName ? ' selected' : ''}>One-off destination</option>${e.locationId && !locations.some(l => l.id === e.locationId) ? '<option value="' + esc(e.locationId) + '" selected>' + esc(e.locationName) + '</option>' : ''}</select></div><div data-claim-expense-one-off${!e.locationId && e.locationName ? '' : ' hidden'}><label for="expenseOneOffLocation">One-off destination</label><input id="expenseOneOffLocation" name="oneOffLocation" maxlength="120" value="${esc(!e.locationId ? e.locationName : '')}"${!e.locationId && e.locationName ? ' required' : ' disabled'}></div>${input('reference', 'Receipt / TnG reference (optional)', e.reference, 'text', 'maxlength="160"')}<div class="wide"><label for="claim-notes">Notes (optional)</label><textarea id="claim-notes" name="notes" maxlength="2000">${esc(e.notes)}</textarea></div></div><label class="check-label"><input type="checkbox" name="claimable"${e.claimable ? ' checked' : ''}>Include in my claimable expenses</label><p class="hint">Non-claimable entries stay in your ledger and are excluded from the monthly total. Expenses remain recorded if a linked activity is later deleted.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save expense</button></div></form>`
      );
    }
    function saveExpense(form) {
      const value = k => form.elements.namedItem(k).value.trim(),
        id = form.dataset.id || uid(),
        old = data().expenses.find(e => e.id === id),
        locationId = value('locationId'),
        site = data().locations.find(l => l.id === locationId),
        amount = number(form, 'amount', 2, 0.01, 1000000, 'a positive expense amount'),
        now = new Date().toISOString(),
        row = {
          ...(old?.tngSource ? { tngSource: old.tngSource } : {}),
          id,
          date: value('date'),
          category: value('category'),
          amountCents: Math.round(amount * 100),
          description: value('description'),
          payment: value('payment'),
          claimable: form.elements.namedItem('claimable').checked,
          claimType: value('claimType'),
          locationId: locationId === '__one-off__' ? '' : locationId,
          locationName:
            locationId === '__one-off__'
              ? value('oneOffLocation')
              : locationId === form.dataset.locationId
                ? form.dataset.locationName
                : site?.name || '',
          bookingId: form.dataset.booking || '',
          reference: value('reference'),
          notes: value('notes'),
          createdAt: old?.createdAt || now,
          updatedAt: now,
        };
      if (form.dataset.id && !old) throw Error('This expense no longer exists.');
      if (locationId === '__one-off__' && !row.locationName)
        throw Error('Enter the one-off destination.');
      if (
        save(
          d => {
            const list = d.workhub.claims.expenses,
              index = list.findIndex(x => x.id === id);
            if (index < 0) list.push(row);
            else list[index] = row;
          },
          'Expense saved to ' + row.date.slice(0, 7) + '.'
        )
      ) {
        a.closeModal();
        page = 0;
        mount('schedule');
      }
    }
    function monthLabel(month) {
      return new Date(month + '-15T12:00:00').toLocaleDateString('en-MY', {
        month: 'long',
        year: 'numeric',
      });
    }
    const submissionLabels = { draft: 'Draft', submitted: 'Submitted', paid: 'Paid' };
    function submissionHTML(m) {
      const s = m.submission;
      return `<section class="claim-submission-strip" aria-label="Claims submission status"><div class="claim-submission-heading"><div><span class="claim-submission-status" data-status="${s.status}">${submissionLabels[s.status]}</span><p>${s.status === 'draft' ? 'Track this month from submission to payment.' : 'Submitted ' + esc(s.submittedDate) + (s.paidDate ? ' · Last payment ' + esc(s.paidDate) : '')}</p></div><div class="actions"><button type="button" data-claim="tracking">Claims tracker</button><button type="button" data-claim="submission" data-month="${m.month}">Update status</button></div></div><dl class="claim-payment-totals">${[
        ['Submitted', s.submittedCents],
        ['Paid', s.paidCents],
        ['Outstanding', s.outstandingCents],
      ]
        .map(
          ([name, cents]) =>
            `<div><dt>${name}</dt><dd>${s.status === 'draft' ? '—' : E.money(cents)}</dd></div>`
        )
        .join(
          ''
        )}</dl>${s.status !== 'draft' && s.submittedCents !== m.totalCents ? '<p class="hint">The current estimate differs from the recorded submission. Your submitted amount stays fixed until you edit it.</p>' : ''}</section>`;
    }
    function tracking() {
      if (!a.ready()) return;
      const rows = [...(data().submissions || [])].sort((a, b) => b.id.localeCompare(a.id)),
        outstanding = rows.reduce((sum, s) => sum + s.submittedCents - s.paidCents, 0);
      a.openModal(
        'Monthly claims tracker',
        `<section class="claim-tracking"><span class="eyebrow">SUBMISSIONS & PAYMENTS</span><h3>${E.money(outstanding)} outstanding</h3><p class="hint">Track actual submitted and received amounts. This records payment status; it does not send a claim or make a payment.</p><div class="claim-tracking-month"><label for="claimTrackingMonth">Claim month</label><input id="claimTrackingMonth" type="month" min="1900-01" max="9999-12" value="${thisMonth()}"><button type="button" data-claim="tracking-open">Open month</button></div><div class="claim-tracking-list">${
          rows
            .slice(0, 36)
            .map(
              s =>
                `<article><div><strong>${esc(monthLabel(s.id))}</strong><small>${submissionLabels[s.status]}${s.reference ? ' · ' + esc(s.reference) : ''}</small><span>Submitted ${E.money(s.submittedCents)} · Paid ${E.money(s.paidCents)} · Outstanding ${E.money(s.submittedCents - s.paidCents)}</span></div><button type="button" data-claim="submission" data-month="${s.id}">Edit</button></article>`
            )
            .join('') || '<p>No months tracked yet. Open a month to record its submission.</p>'
        }</div>${rows.length > 36 ? '<p class="hint">Showing the latest 36 tracked months. Open any other month using the picker above. Outstanding includes all tracked months.</p>' : ''}</section>`
      );
    }
    function submissionForm(month = thisMonth()) {
      if (!a.ready()) return;
      const s = E.submission(a.state(), month),
        m = E.summary(a.state(), month);
      submissionDraft = { owner: a.owner(), month, snapshot: JSON.stringify(s) };
      a.openModal(
        'Claims status · ' + monthLabel(month),
        `<form id="claimSubmissionForm"><p class="hint">Current claimable estimate: ${E.money(m.totalCents)}. Record the amount you actually submitted. Later expense changes do not change that amount.</p><label for="claimSubmissionStatus">Status</label><select id="claimSubmissionStatus" name="status">${options(Object.entries(submissionLabels), s.status)}</select><fieldset class="claim-submission-fields"><div class="form-grid">${input('submittedDate', 'Submission date', s.submittedDate || a.today(), 'date', 'min="1900-01-01" max="9999-12-31" required')}${input('submittedAmount', 'Submitted amount (RM)', ((s.submittedCents || m.totalCents) / 100).toFixed(2), 'number', 'min="0.01" max="10000000000" step="0.01" required')}${input('paidAmount', 'Total received so far (RM)', (s.paidCents / 100).toFixed(2), 'number', 'min="0" max="10000000000" step="0.01" required')}${input('paidDate', 'Last payment date', s.paidDate, 'date', 'min="1900-01-01" max="9999-12-31"')}</div><p class="hint">For a partial payment, keep Submitted status and enter the total received so far. Paid records the full submitted amount as received.</p></fieldset>${input('submissionReference', 'Submission reference', s.reference, 'text', 'maxlength="160"')}<label for="claimSubmissionNotes">Notes</label><textarea id="claimSubmissionNotes" name="notes" maxlength="2000">${esc(s.notes)}</textarea><p class="hint">Saving Draft clears this month’s submission and payment amounts and dates. It keeps your mileage and expenses.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save claim status</button></div></form>`
      );
      updateSubmission($('claimSubmissionForm'));
    }
    function updateSubmission(form) {
      const get = name => form.elements.namedItem(name),
        status = get('status').value;
      form.querySelector('fieldset').disabled = status === 'draft';
      get('paidAmount').disabled = status === 'paid';
      if (status === 'paid') {
        get('paidAmount').value = get('submittedAmount').value;
        if (!get('paidDate').value) get('paidDate').value = a.today();
      }
      get('paidDate').required = status !== 'draft' && Number(get('paidAmount').value) > 0;
    }
    function saveSubmission(form) {
      if (
        !a.ready() ||
        !submissionDraft ||
        submissionDraft.owner !== a.owner() ||
        form !== $('claimSubmissionForm') ||
        !form.closest('dialog[open]')
      )
        throw Error('Reopen claims status for the current account.');
      const current = E.submission(a.state(), submissionDraft.month);
      if (JSON.stringify(current) !== submissionDraft.snapshot)
        throw Error('This claim status changed while you were editing. Reopen it before saving.');
      const get = name => form.elements.namedItem(name).value,
        status = get('status'),
        amount = name => Math.round(Number(get(name)) * 100);
      const row = {
        id: submissionDraft.month,
        status,
        submittedDate: status === 'draft' ? '' : get('submittedDate'),
        submittedCents: status === 'draft' ? 0 : amount('submittedAmount'),
        paidCents:
          status === 'draft'
            ? 0
            : status === 'paid'
              ? amount('submittedAmount')
              : amount('paidAmount'),
        paidDate:
          status === 'draft' || (status !== 'paid' && amount('paidAmount') === 0)
            ? ''
            : get('paidDate'),
        reference: get('submissionReference').trim(),
        notes: get('notes'),
        updatedAt: new Date().toISOString(),
      };
      if (status !== 'draft')
        for (const name of status === 'paid'
          ? ['submittedAmount']
          : ['submittedAmount', 'paidAmount'])
          if (!get(name).trim() || !/^\d+(?:\.\d{1,2})?$/.test(get(name)))
            throw Error('Enter RM amounts with up to two decimal places.');
      const next = {
        ...a.state(),
        workhub: {
          ...a.state().workhub,
          claims: {
            ...data(),
            submissions: [...(data().submissions || []).filter(s => s.id !== row.id), row],
          },
        },
      };
      E.validate(next);
      if (
        save(d => {
          d.workhub.claims.submissions = [
            ...(d.workhub.claims.submissions || []).filter(s => s.id !== row.id),
            row,
          ];
        }, 'Claim status saved.')
      ) {
        submissionDraft = null;
        a.closeModal();
      }
    }
    function summaryHTML(m) {
      return `<div class="claim-summary-heading"><div><span class="hub-kicker">YOUR MONTH AT A GLANCE</span><h3>Monthly claims</h3></div><span class="claim-summary-month">${esc(monthLabel(m.month))}</span></div><div class="claim-summary-body"><div class="claim-summary-copy"><div class="claim-summary-main"><span>Claimable estimate</span><strong>${E.money(m.totalCents)}</strong></div><p>Scheduled mileage + recorded claimable expenses</p><div class="claim-type-totals">${Object.entries(
        E.CLAIM_TYPES
      )
        .map(
          ([type, label]) =>
            `<span><b>${label}</b><strong>${E.money(m.byClaimType[type].totalCents)}</strong></span>`
        )
        .join(
          ''
        )}</div></div><dl class="claim-summary-breakdown"><div><dt>Mileage</dt><dd>${E.money(m.mileageCents)}</dd><small>${E.km(m.distanceKm)} km · ${m.visits} visit${m.visits === 1 ? '' : 's'}</small></div><div><dt>TnG / toll</dt><dd>${E.money(m.tollCents)}</dd><small>Claimable toll expenses</small></div><div><dt>Other expenses</dt><dd>${E.money(m.otherCents)}</dd><small>Parking, meals &amp; other costs</small></div></dl></div><div class="claim-summary-footer"><p>Includes planned visits in the selected month.</p><div class="claim-summary-actions"><button type="button" data-claim="add-expense">＋ Add expense</button><button type="button" data-claim="review">Review / export <span aria-hidden="true">↗</span></button></div></div>`;
    }
    function expenseRows(rows) {
      return rows
        .map(
          e =>
            `<article class="claim-expense-row${e.claimable ? '' : ' is-excluded'}"><div class="claim-date-chip"><strong>${Number(e.date.slice(8))}</strong><span>${esc(new Date(e.date + 'T12:00:00').toLocaleDateString('en-MY', { month: 'short' }))}</span></div><div class="claim-expense-copy"><span class="claim-category">${E.CATEGORIES[e.category]} · ${E.CLAIM_TYPES[E.claimType(e)]}${e.claimable ? '' : ' · excluded'}</span><strong class="hub-sensitive">${esc(e.description)}</strong><small>${esc([e.locationName, e.payment, e.reference].filter(Boolean).join(' · '))}</small></div><strong class="claim-expense-amount hub-sensitive">${E.money(e.amountCents)}</strong><div class="actions"><button type="button" class="small" data-claim="edit-expense" data-id="${esc(e.id)}" aria-label="Edit ${esc(e.description)}">Edit</button>${e.tngSource ? `<button type="button" class="small" data-tng="open-source" data-id="${esc(e.id)}">PDF evidence</button>` : ''}<button type="button" class="small" data-claim="delete-expense" data-id="${esc(e.id)}" aria-label="Delete ${esc(e.description)}">Delete</button></div></article>`
        )
        .join('');
    }
    function ledgerHTML(m) {
      const rows = [...m.expenses].reverse(),
        size = 12;
      page = Math.max(0, Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1)));
      return `<div class="claim-ledger-heading"><div><span class="hub-kicker">THE REST OF THE VISIT</span><h3>Tolls & other expenses <span>${rows.length}</span></h3><p>Receipts, TnG references and incidental costs, kept by date.</p></div><div class="actions">${lastDeleted ? '<button type="button" data-claim="undo-delete">Undo deletion</button>' : ''}<button type="button" class="primary" data-claim="add-expense">＋ Add expense</button></div></div><div class="claim-expense-list">${expenseRows(rows.slice(page * size, (page + 1) * size)) || '<div class="claim-empty"><span aria-hidden="true">▤</span><strong>No extra expenses for this month.</strong><p>Add a toll, parking receipt or another cost when you have one.</p></div>'}</div>${rows.length > size ? `<div class="claim-pagination"><button type="button" class="small" data-claim="page" data-step="-1"${page ? '' : ' disabled'}>Previous</button><span>${page * size + 1}–${Math.min(rows.length, (page + 1) * size)} of ${rows.length}</span><button type="button" class="small" data-claim="page" data-step="1"${(page + 1) * size < rows.length ? '' : ' disabled'}>Next</button></div>` : ''}<div class="claim-ledger-footer"><span>${m.excludedCents ? E.money(m.excludedCents) + ' excluded from claim totals.' : 'Only entries marked claimable contribute to the header.'}</span><button type="button" class="small" data-claim="export">↓ Download monthly CSV</button></div>`;
    }
    function review() {
      const m = E.summary(a.state(), thisMonth()),
        duplicates = new Set(),
        seen = new Set();
      for (const t of m.mileage.filter(t => t.travel.claimable)) {
        const key = t.date + '|' + t.travel.locationId;
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
      }
      a.openModal(
        'Monthly claims · ' + monthLabel(m.month),
        `<div class="claim-review-top"><span class="hub-kicker">CLAIMABLE ESTIMATE</span><strong>${E.money(m.totalCents)}</strong><p>${E.money(m.mileageCents)} mileage + ${E.money(m.tollCents)} tolls + ${E.money(m.otherCents)} other expenses.</p><div class="claim-type-totals">${Object.entries(
          E.CLAIM_TYPES
        )
          .map(
            ([type, label]) =>
              `<span><b>${label}</b><strong>${E.money(m.byClaimType[type].totalCents)}</strong></span>`
          )
          .join(
            ''
          )}</div><button type="button" class="primary" data-claim="export">↓ Download ${esc(m.month)} CSV</button></div>${duplicates.size ? '<p class="claim-duplicate-note">Some dates have multiple mileage bookings for the same site. Review these as separate visits, or exclude the duplicate mileage in Schedule.</p>' : ''}<h3>Daily mileage · ${m.mileage.length} entries</h3><p class="hint">One line per booking and date. Repeated hourly segments are counted once. A date range spanning months is split by the actual visit dates.</p><div class="claim-review-table"><table><thead><tr><th>Date / activity</th><th>Site / saved rate</th><th>Distance</th><th>Amount</th><th></th></tr></thead><tbody>${m.mileage.map(t => `<tr><td>${esc(t.date)}<small>${esc(t.title)}</small></td><td>${esc(t.travel.locationName)}<small>${E.CLAIM_TYPES[t.claimType]} · ${E.rate(t.travel.ratePerKm)} / km · ${E.JOURNEYS[t.travel.journey]} · ${t.travel.visits} visit${t.travel.visits === 1 ? '' : 's'}</small></td><td>${E.km(t.distanceKm)} km</td><td>${E.money(t.amountCents)}${t.travel.claimable ? '' : '<small>Excluded</small>'}</td><td><button type="button" class="small" data-claim="open-booking" data-date="${esc(t.date)}" data-time="${esc(t.time)}">Open</button></td></tr>`).join('') || '<tr><td colspan="5">No on-site mileage in this month.</td></tr>'}</tbody></table></div><h3>Tolls & other expenses</h3><div class="claim-expense-list">${expenseRows(m.expenses) || '<p class="hint">No extra expenses recorded.</p>'}</div><p class="hint">Future scheduled visits are included as planned mileage. Excluded entries remain visible for your reference.</p>`
      );
    }
    function mount(tab) {
      resetOwner();
      const settingsHost =
        $('hubSettingsAppearance') || document.querySelector('#settingsMenu .settings-panel');
      if (settingsHost && !$('claimSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'claimSettingsButton';
        b.dataset.claim = 'settings';
        b.textContent = 'On-site locations & mileage';
        settingsHost.append(b);
      }
      if ($('claimSettingsButton')) $('claimSettingsButton').hidden = !a.ready();
      if (!a.ready() || tab !== 'schedule') return;
      if (monthSeen !== thisMonth()) {
        monthSeen = thisMonth();
        page = 0;
      }
      const host = document.querySelector('#view .schedule-workspace');
      if (!host) return;
      const m = E.summary(a.state(), thisMonth());
      let bar = $('claimMonthSummary');
      if (!bar) {
        bar = document.createElement('section');
        bar.id = 'claimMonthSummary';
        bar.className = 'claim-month-summary hub-sensitive';
        bar.setAttribute('aria-label', 'Monthly claimable expenses');
        const heading = host.querySelector('.panel-top');
        if (heading) heading.after(bar);
        else host.prepend(bar);
      }
      const extractor = bar.querySelector('[data-tng="open"]');
      bar.innerHTML = summaryHTML(m);
      if (extractor) bar.querySelector('.claim-summary-actions').prepend(extractor);
      bar.insertAdjacentHTML('beforeend', submissionHTML(m));
      let ledger = $('claimExpenseLedger');
      if (!ledger) {
        ledger = document.createElement('section');
        ledger.id = 'claimExpenseLedger';
        ledger.className = 'claim-expense-ledger';
        host.append(ledger);
      }
      ledger.innerHTML = ledgerHTML(m);
    }
    document.addEventListener('input', event => {
      const f = event.target.form;
      if (f?.id === 'claimSubmissionForm') updateSubmission(f);
      if (
        f?.id === 'scheduleForm' &&
        (event.target.name.startsWith('travel') ||
          ['date', 'endDate', 'claimType', 'claimLocationName', 'location'].includes(
            event.target.name
          ))
      )
        updateTravel(f);
    });
    document.addEventListener('change', event => {
      const f = event.target.form;
      if (f?.id === 'claimSubmissionForm') updateSubmission(f);
      if (
        f?.id === 'scheduleForm' &&
        (event.target.name.startsWith('travel') ||
          ['date', 'endDate', 'claimType', 'claimLocationName', 'location'].includes(
            event.target.name
          ))
      )
        updateTravel(
          f,
          event.target.name === 'travelLocationId',
          event.target.name === 'travelLocationId'
        );
      if (f?.id === 'claimExpenseForm' && event.target.name === 'locationId') {
        const oneOff = event.target.value === '__one-off__',
          field = f.elements.namedItem('oneOffLocation');
        field.closest('[data-claim-expense-one-off]').hidden = !oneOff;
        field.disabled = !oneOff;
        field.required = oneOff;
      }
    });
    document.addEventListener(
      'submit',
      event => {
        if (
          !['claimLocationForm', 'claimExpenseForm', 'claimSubmissionForm'].includes(
            event.target.id
          )
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          if (event.target.id === 'claimSubmissionForm') saveSubmission(event.target);
          else if (event.target.id === 'claimLocationForm') saveLocation(event.target);
          else saveExpense(event.target);
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    document.addEventListener(
      'click',
      event => {
        const b = event.target.closest?.('[data-claim]');
        if (!b) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!a.ready()) return;
        try {
          const action = b.dataset.claim,
            id = b.dataset.id;
          if (action === 'submission') {
            submissionForm(b.dataset.month);
            return;
          }
          if (action === 'tracking') {
            tracking();
            return;
          }
          if (action === 'tracking-open') {
            submissionForm($('claimTrackingMonth').value);
            return;
          }
          if (action === 'settings') settings();
          else if (action === 'edit-location') locationForm(id);
          else if (action === 'archive-location') {
            if (
              save(d => {
                const l = d.workhub.claims.locations.find(l => l.id === id);
                if (!l) throw Error('Location no longer exists.');
                l.archived = !l.archived;
              }, 'Location updated. Saved bookings are kept.')
            )
              settings();
          } else if (action === 'latest-route') updateTravel(b.closest('form'), true);
          else if (action === 'add-expense' || action === 'edit-expense')
            expenseForm(id, {
              date: b.dataset.date,
              bookingId: b.dataset.booking,
              locationId: b.dataset.location,
            });
          else if (action === 'review') review();
          else if (action === 'export')
            a.download(
              E.csv(a.state(), thisMonth()),
              'claims-' + thisMonth() + '.csv',
              'text/csv;charset=utf-8'
            );
          else if (action === 'page') {
            page += Number(b.dataset.step);
            mount('schedule');
          } else if (action === 'open-booking') a.viewBooking(b.dataset.date, b.dataset.time);
          else if (action === 'delete-expense') {
            const row = data().expenses.find(e => e.id === id),
              index = data().expenses.findIndex(e => e.id === id);
            if (
              row &&
              save(d => {
                d.workhub.claims.expenses = d.workhub.claims.expenses.filter(e => e.id !== id);
              }, 'Expense deleted. Undo is available in the monthly expense section.')
            ) {
              lastDeleted = { row: JSON.parse(JSON.stringify(row)), index, owner };
              mount('schedule');
              if (document.querySelector('#modal .claim-expense-list')) review();
            }
          } else if (action === 'undo-delete' && lastDeleted?.owner === owner) {
            const saved = lastDeleted;
            if (
              save(d => {
                if (!d.workhub.claims.expenses.some(e => e.id === saved.row.id))
                  d.workhub.claims.expenses.splice(saved.index, 0, saved.row);
              }, 'Expense restored.')
            ) {
              lastDeleted = null;
              mount('schedule');
            }
          }
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    return {
      mount,
      settings,
      locationForm,
      expenseForm,
      updateTravel,
      review,
      saveLocation,
      saveExpense,
      submissionForm,
      saveSubmission,
      tracking,
      summary: () => E.summary(a.state(), thisMonth()),
    };
  }
  root.WorkHubClaims = { install, fields, read, draft, context, badge, details };
})(window);
