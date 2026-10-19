/* Isolated synthetic preview: no Supabase client, credentials or uploaded user records. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id),
    stamp = '2026-10-20T00:00:00Z';
  const state = {
    projects: [],
    projectPlans: [],
    tasks: [],
    schedule: [
      {
        date: '2026-10-09',
        time: '09:00',
        location: 'Client site',
        kind: 'custom',
        bookingId: 'demo-visit',
        text: 'Demo client workshop',
      },
    ],
    workhub: {
      claims: { locations: [], expenses: [] },
      notes: [],
      lab: [
        {
          id: 'demo-lab',
          title: 'Goods receipt investigation',
          system: 'Demo QAS · client 200',
          tcodes: 'MIGO',
          process: 'Purchase order → goods receipt',
          status: 'Solved',
          archived: false,
          error: 'Posting stopped during the process.',
          expected: 'A material document is posted.',
          actual: 'The first approach did not resolve the issue.',
          cause: 'A missing assignment was identified.',
          solution: 'The second experiment confirmed the maintained assignment.',
          notes: 'Synthetic investigation for playback review.',
          verification: 'Expected result confirmed in the demo.',
          resolvedAt: stamp,
          position: { x: 54, y: 158 },
          attempts: [
            {
              id: 'demo-passed',
              title: 'Maintain the assignment',
              action: 'Review the approved setting and retest.',
              expected: 'Posting completes.',
              result: 'Expected result confirmed.',
              outcome: 'Passed',
              parentId: '@issue',
              position: { x: 410, y: 158 },
              createdAt: stamp,
            },
            {
              id: 'demo-failed',
              title: 'Retry without a change',
              action: 'Repeat the original steps.',
              expected: 'Posting completes.',
              result: 'The original message remained.',
              outcome: 'Failed',
              parentId: '',
              position: { x: 720, y: 158 },
              createdAt: stamp,
            },
          ],
        },
      ],
    },
  };
  const download = (blob, name, type) => {
    const url = URL.createObjectURL(new Blob([blob], { type })),
      el = document.createElement('a');
    el.href = url;
    el.download = name;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const adapter = {
    state: () => state,
    ready: () => true,
    owner: () => 'synthetic-preview',
    today: () => '2026-10-20',
    month: () => '2026-10',
    day: () => '2026-10-09',
    prefs: () => ({ motion: 'calm', mascot: false }),
    life: () => null,
    moments: () => null,
    react() {},
    tell(text) {
      $('previewStatus').textContent = text;
    },
    download,
    mutate(fn) {
      fn(state);
      WorkHubClaimsEngine.validate(state);
      $('previewStatus').textContent =
        `Saved locally: ${state.workhub.claims.expenses.length} expenses · ${WorkHubClaimsEngine.money(WorkHubClaimsEngine.summary(state, '2026-10').totalCents)}`;
      return true;
    },
    openModal(title, body) {
      $('modalTitle').textContent = title;
      $('modalBody').innerHTML = body;
      if (!$('modal').open) $('modal').showModal();
    },
    closeModal() {
      $('modal').close();
    },
    render() {
      renderLab();
    },
    openRecord() {
      renderLab();
    },
  };
  const tng = WorkHubTng.install(adapter),
    lab = WorkHubLabWorkshop.install(adapter);
  function renderLab() {
    $('view').innerHTML = lab.render(state.workhub.lab[0], {
      rows: state.workhub.lab,
      query: '',
      view: 'active',
    });
    lab.mount();
  }
  $('openTng').onclick = () => tng.open();
  $('openLab').onclick = renderLab;
  $('closeModal').onclick = () => $('modal').close();
  $('phoneWidth').onclick = () => document.body.classList.toggle('preview-phone');
  setInterval(() => lab.tick(), 500);
  $('demoTng').onclick = async () => {
    try {
      const { PDFDocument, StandardFonts, rgb } = await import(
        '../vendor/pdf-lib/pdf-lib.esm.min.js'
      );
      const pdf = await PDFDocument.create(),
        font = await pdf.embedFont(StandardFonts.Helvetica),
        page = pdf.addPage([595, 842]);
      const text = (s, x, y, size = 8) => page.drawText(s, { x, y, size, font });
      text('Customer Transactions Statement', 20, 810, 16);
      text('Serial No.', 20, 785);
      text('DEMO-CARD', 150, 785);
      text('Offline Card Transactions', 20, 752, 11);
      const cols = [20, 70, 120, 177, 205, 235, 280, 330, 380, 420, 470, 505, 535, 575],
        top = 720,
        rowH = 34;
      const grid = (y, bg = false) => {
        if (bg)
          page.drawRectangle({
            x: 20,
            y: y - rowH,
            width: 555,
            height: rowH,
            color: rgb(0.93, 0.95, 0.91),
          });
        for (const x of cols)
          page.drawLine({
            start: { x, y },
            end: { x, y: y - rowH },
            thickness: 0.5,
            color: rgb(0.5, 0.6, 0.5),
          });
        for (const yy of [y, y - rowH])
          page.drawLine({
            start: { x: 20, y: yy },
            end: { x: 575, y: yy },
            thickness: 0.5,
            color: rgb(0.4, 0.5, 0.4),
          });
      };
      grid(top, true);
      text('Trans No.', 25, top - 19);
      text('Exit Date & Time', 122, top - 19, 7);
      text('Posted', 180, top - 19, 7);
      text('Type', 207, top - 19, 7);
      text('Entry', 240, top - 19, 7);
      text('Exit', 335, top - 19, 7);
      text('Amount', 473, top - 19, 7);
      text('Balance', 506, top - 19, 7);
      text('Sector', 540, top - 19, 7);
      const records = [
        [
          '000101',
          '09/10/2026',
          '09:00:00',
          '10/10',
          '/2026',
          'Fare Usage',
          'Demo Plaza A',
          'Demo Plaza B',
          '1.66',
          '5.00',
          'TOLL',
        ],
        [
          '000102',
          '09/10/2026',
          '18:00:00',
          '09/10',
          '/2026',
          'Fare Usage',
          'Demo Plaza B',
          'Demo Plaza A',
          '2.50',
          '6.66',
          'TOLL',
        ],
        [
          '000103',
          '09/10/2026',
          '08:30:00',
          '09/10',
          '/2026',
          'OTA Reload',
          'OTA-TNGD',
          'OTA-TNGD',
          '20.00',
          '9.16',
          'RETAIL',
        ],
        [
          '000104',
          '08/10/2026',
          '09:30:00',
          '08/10',
          '/2026',
          'Fare Usage',
          'Demo Plaza C',
          'Demo Plaza D',
          '6.08',
          '8.00',
          'TOLL',
        ],
      ];
      records.forEach((r, i) => {
        const y = top - rowH * (i + 1);
        grid(y);
        text(r[0], 30, y - 18);
        text(r[1], 125, y - 12, 7);
        text(r[2], 130, y - 23, 7);
        text(r[3], 181, y - 12, 7);
        text(r[4], 181, y - 23, 7);
        text(r[5], 207, y - 18, 5);
        text(r[6], 237, y - 18, 5);
        text(r[7], 332, y - 18, 5);
        text(r[8], 484, y - 18, 7);
        text(r[9], 514, y - 18, 7);
        text(r[10], 540, y - 18, 7);
      });
      const file = new File([await pdf.save()], 'synthetic-tng.pdf', { type: 'application/pdf' });
      tng.open();
      await tng.loadFile(file);
    } catch (error) {
      $('previewStatus').textContent = error.stack || error.message;
    }
  };
  renderLab();
})();
