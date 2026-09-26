/**
 * Calculation engine tests.
 *
 * The engine is the part of MarginDesk that must never be wrong, so these tests
 * pin the pricing formulas: line amounts, complexity, rush fees, discounts, tax,
 * margins, project profitability and the report aggregations.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const calc = require('../assets/js/calc.js');

const settings = Object.assign({}, calc.DEFAULT_SETTINGS, { defaultHourlyRate: 100, defaultCostRate: 30, targetMarginPercent: 55 });

test('primitives: toNumber, round2, clamp and sum', () => {
  assert.equal(calc.toNumber('12.5'), 12.5);
  assert.equal(calc.toNumber('nope'), 0);
  assert.equal(calc.toNumber('nope', 7), 7);
  assert.equal(calc.toNumber(undefined, 3), 3);
  assert.equal(calc.round2(1.005), 1.01);
  assert.equal(calc.round2(0.1 + 0.2), 0.3);
  assert.equal(calc.clamp(5, 0, 10), 5);
  assert.equal(calc.clamp(50, 0, 10), 10);
  assert.equal(calc.sum([{ n: 1 }, { n: 2.5 }], (item) => item.n), 3.5);
  assert.equal(calc.sum(null, (item) => item.n), 0);
});

test('lineTotals: hours x rate, complexity and rush fee', () => {
  const plain = calc.lineTotals({ hours: 10, rate: 100 }, settings);
  assert.equal(plain.baseAmount, 1000);
  assert.equal(plain.complexityAmount, 0);
  assert.equal(plain.rushAmount, 0);
  assert.equal(plain.total, 1000);
  assert.equal(plain.hours, 10);

  const complex = calc.lineTotals({ hours: 10, rate: 100, complexity: 1.5 }, settings);
  assert.equal(complex.complexityAmount, 500);
  assert.equal(complex.total, 1500);

  const rushed = calc.lineTotals({ hours: 10, rate: 100, complexity: 1.5, rushPercent: 10 }, settings);
  // rush applies to base + complexity: (1000 + 500) * 10% = 150
  assert.equal(rushed.rushAmount, 150);
  assert.equal(rushed.total, 1650);
});

test('lineTotals: cost drives the projected margin of a line', () => {
  const line = calc.lineTotals({ hours: 10, rate: 100, cost: 250 }, settings);
  assert.equal(line.cost, 250);
  assert.equal(line.profit, 750);
  assert.equal(line.marginPercent, 75);
});

test('lineTotals: negative and junk input is clamped to zero', () => {
  const line = calc.lineTotals({ hours: -5, rate: -10, complexity: 0.5, rushPercent: -3, cost: -1 }, settings);
  assert.equal(line.hours, 0);
  assert.equal(line.rate, 0);
  assert.equal(line.total, 0);
  assert.equal(line.marginPercent, 0);
});

test('quoteTotals: subtotal, percentage discount, tax and margin', () => {
  const quote = {
    lineItems: [
      { description: 'Design', hours: 10, rate: 100 },
      { description: 'Build', hours: 5, rate: 100, complexity: 1.5 },
    ],
    discount: { type: 'percent', value: 10 },
    taxRate: 20,
  };
  const totals = calc.quoteTotals(quote, settings);

  assert.equal(totals.lines.length, 2);
  assert.equal(totals.subtotal, 1000 + 750);
  assert.equal(totals.discountAmount, 175);
  assert.equal(totals.discountLabel, 'percent');
  assert.equal(totals.taxable, 1575);
  assert.equal(totals.taxAmount, 315);
  assert.equal(totals.total, 1890);
  assert.equal(totals.totalHours, 15);
  // profit excludes tax: 1575 - 0 estimated cost
  assert.equal(totals.estimatedCost, 0);
  assert.equal(totals.profit, 1575);
  assert.equal(totals.effectiveHourlyRate, 126);
});

test('quoteTotals: fixed discount can never exceed the subtotal', () => {
  const totals = calc.quoteTotals(
    { lineItems: [{ hours: 4, rate: 50 }], discount: { type: 'fixed', value: 5000 }, taxRate: 0 },
    settings,
  );
  assert.equal(totals.discountAmount, 200);
  assert.equal(totals.total, 0);
  assert.equal(totals.discountLabel, 'fixed');
});

test('quoteTotals: empty quote is safe', () => {
  const totals = calc.quoteTotals({}, settings);
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.total, 0);
  assert.equal(totals.effectiveHourlyRate, 0);
  assert.equal(totals.marginPercent, 0);
  assert.equal(totals.belowTargetMargin, false);
});

test('quoteTotals: flags quotes below the target margin', () => {
  // margin compares the quote total against the cost of doing the work
  const thin = calc.quoteTotals({ lineItems: [{ hours: 10, rate: 100, cost: 800 }] }, settings);
  assert.equal(thin.total, 1000);
  assert.equal(thin.estimatedCost, 800);
  assert.equal(thin.profit, 200);
  assert.equal(thin.marginPercent, 20);
  assert.equal(thin.belowTargetMargin, true);

  const healthy = calc.quoteTotals({ lineItems: [{ hours: 10, rate: 100, cost: 200 }] }, settings);
  assert.equal(healthy.marginPercent, 80);
  assert.equal(healthy.belowTargetMargin, false);
});

test('quoteNumber: sequential per year, reusing existing numbers when present', () => {
  const existing = [
    { number: 'Q-2026-001' },
    { number: 'Q-2026-002' },
    { number: 'Q-2025-014' },
  ];
  assert.equal(calc.quoteNumber({ issueDate: '2026-05-04' }, Object.assign({}, settings, { quotePrefix: 'Q' }), existing), 'Q-2026-003');
  assert.equal(calc.quoteNumber({ issueDate: '2025-01-02' }, Object.assign({}, settings, { quotePrefix: 'Q' }), existing), 'Q-2025-015');
  assert.equal(calc.quoteNumber({ number: 'Q-2026-099' }, settings, existing), 'Q-2026-099');
  assert.equal(calc.quoteNumber({ issueDate: '2026-05-04' }, Object.assign({}, settings, { quotePrefix: 'FN' }), []), 'FN-2026-001');
});

test('quoteNumber: a blank or broken issue date falls back to the current year', () => {
  const year = new Date().getFullYear();
  for (const issueDate of ['', null, undefined, 'not-a-date']) {
    const number = calc.quoteNumber({ issueDate }, Object.assign({}, settings, { quotePrefix: 'FN' }), []);
    assert.equal(number, `FN-${year}-001`, `issueDate ${JSON.stringify(issueDate)}`);
    assert.doesNotMatch(number, /NaN/);
  }
});

test('quoteTotals: a percentage discount reports the rate that was applied', () => {
  const quote = {
    lineItems: [{ description: 'Design', hours: 10, rate: 100, complexity: 1, rushPercent: 0, cost: 0 }],
    discount: { type: 'percent', value: 10 },
    taxRate: 0,
  };
  const totals = calc.quoteTotals(quote, settings);
  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discountAmount, 100);
  assert.equal(totals.discountRate, 10);
  assert.equal(totals.discountLabel, 'percent');
  assert.equal(totals.total, 900);

  const fixed = calc.quoteTotals(
    Object.assign({}, quote, { discount: { type: 'fixed', value: 250 } }),
    settings,
  );
  assert.equal(fixed.discountAmount, 250);
  assert.equal(fixed.discountRate, 0);
  assert.equal(fixed.discountLabel, 'fixed');
  assert.equal(fixed.total, 750);
});

test('addDays and daysUntil use calendar days', () => {
  // addDays works in local calendar days, so the expectation is built the same way
  const localIso = (iso, days) => {
    const date = new Date(`${iso}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  assert.equal(calc.addDays('2026-02-27', 2), localIso('2026-02-27', 2));
  assert.equal(calc.addDays('2026-01-01', -1), localIso('2026-01-01', -1));
  assert.equal(calc.addDays('not-a-date', 3), 'not-a-date');
  assert.equal(calc.daysUntil('2026-05-10', '2026-05-01'), 9);
  assert.equal(calc.daysUntil('2026-05-01', '2026-05-10'), -9);
  assert.equal(calc.daysUntil('2026-05-01', '2026-05-01'), 0);
  assert.equal(calc.daysUntil('rubbish', '2026-05-01'), null);
});

test('isQuoteExpired and quoteExpiryStatus only judge undecided quotes', () => {
  const today = '2026-05-10';
  assert.equal(calc.isQuoteExpired({ status: 'sent', validUntil: '2026-05-09' }, today), true);
  assert.equal(calc.isQuoteExpired({ status: 'sent', validUntil: '2026-05-12' }, today), false);
  assert.equal(calc.isQuoteExpired({ status: 'accepted', validUntil: '2026-05-09' }, today), false);
  assert.equal(calc.isQuoteExpired({ status: 'declined', validUntil: '2026-05-09' }, today), false);

  assert.equal(calc.quoteExpiryStatus({ status: 'sent', validUntil: '2026-05-09' }, today), 'expired');
  assert.equal(calc.quoteExpiryStatus({ status: 'sent', validUntil: '2026-05-11' }, today), 'urgent');
  assert.equal(calc.quoteExpiryStatus({ status: 'sent', validUntil: '2026-05-13' }, today), 'urgent');
  assert.equal(calc.quoteExpiryStatus({ status: 'sent', validUntil: '2026-05-30' }, today), 'ok');
  assert.equal(calc.quoteExpiryStatus({ status: 'draft', validUntil: '2026-05-09' }, today), 'none');
  assert.equal(calc.quoteExpiryStatus({ status: 'accepted', validUntil: '2026-05-09' }, today), 'none');
});

test('projectTotals: revenue from the quote minus labour and direct costs', () => {
  const quote = {
    id: 'q1',
    lineItems: [{ hours: 20, rate: 100 }],
    discount: { type: 'percent', value: 0 },
    taxRate: 0,
  };
  const project = {
    quoteId: 'q1',
    budgetHours: 20,
    hourlyRate: 100,
    costRate: 30,
    timeEntries: [
      { hours: 6, billable: true },
      { hours: 4, billable: true },
      { hours: 2, billable: false },
    ],
    costs: [{ amount: 150 }, { amount: 50.5 }],
  };
  const totals = calc.projectTotals(project, quote, settings);

  assert.equal(totals.revenue, 2000);
  assert.equal(totals.loggedHours, 12);
  assert.equal(totals.billableHours, 10);
  assert.equal(totals.nonBillableHours, 2);
  assert.equal(totals.labourCost, 360);
  assert.equal(totals.directCosts, 200.5);
  assert.equal(totals.totalCost, 560.5);
  assert.equal(totals.profit, 1439.5);
  assert.ok(Math.abs(totals.marginPercent - 71.98) < 0.02, `margin was ${totals.marginPercent}`);
  assert.equal(totals.effectiveHourlyRate, 166.67);
  assert.equal(totals.realHourlyRate, 119.96);
  assert.equal(totals.progressPercent, 60);
  assert.equal(totals.hoursVariance, -8);
  assert.equal(totals.overBudgetHours, false);
  assert.equal(totals.underTargetMargin, false);
  assert.equal(totals.hasTime, true);
});

test('projectTotals: overrun and low margin are both flagged', () => {
  const quote = { id: 'q2', lineItems: [{ hours: 10, rate: 100, cost: 0 }], discount: { type: 'percent', value: 0 }, taxRate: 0 };
  const project = {
    quoteId: 'q2',
    budgetHours: 10,
    hourlyRate: 100,
    costRate: 40,
    timeEntries: [{ hours: 14, billable: true }],
    costs: [],
  };
  const totals = calc.projectTotals(project, quote, settings);

  assert.equal(totals.overBudgetHours, true);
  assert.equal(totals.hoursVariance, 4);
  assert.equal(totals.progressPercent, 140);
  assert.equal(totals.profit, 440);
  assert.equal(totals.marginPercent, 44);
  assert.equal(totals.underTargetMargin, true);
});

test('projectTotals: a project without a quote has no revenue', () => {
  const totals = calc.projectTotals({ budgetHours: 10, timeEntries: [{ hours: 3 }], costs: [] }, null, settings);
  assert.equal(totals.revenue, 0);
  assert.equal(totals.profit, -90);
  assert.equal(totals.marginPercent, 0);
  assert.equal(totals.underTargetMargin, false);
});

test('revenueByMonth: only accepted quotes, bucketed by the month accepted', () => {
  const quotes = [
    { status: 'accepted', acceptedAt: '2026-04-15T10:00:00.000Z', lineItems: [{ hours: 10, rate: 100 }] },
    { status: 'accepted', acceptedAt: '2026-05-02T10:00:00.000Z', lineItems: [{ hours: 5, rate: 100 }] },
    { status: 'sent', updatedAt: '2026-05-03T10:00:00.000Z', lineItems: [{ hours: 99, rate: 100 }] },
    { status: 'accepted', acceptedAt: '2025-11-10T10:00:00.000Z', lineItems: [{ hours: 4, rate: 100 }] },
  ];
  const rows = calc.revenueByMonth(quotes, settings, new Date('2026-05-20T00:00:00Z'), 3);
  assert.deepEqual(rows.map((row) => row.month), ['2026-03', '2026-04', '2026-05']);
  assert.equal(rows[0].revenue, 0);
  assert.equal(rows[1].revenue, 1000);
  assert.equal(rows[2].revenue, 500);
  assert.equal(rows[2].quotes, 1);
  // the November 2025 quote is outside the window and must not be counted
  assert.equal(calc.sum(rows, (row) => row.revenue), 1500);
});

test('lastMonths returns a contiguous ascending list', () => {
  const months = calc.lastMonths(6, new Date('2026-02-15T00:00:00Z'));
  assert.deepEqual(months, ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
});

test('revenueByClient ranks clients by revenue and only counts accepted work', () => {
  const clients = [{ id: 'c1', name: 'Ada', company: 'Alpha' }, { id: 'c2', name: 'Bo', company: 'Beta' }, { id: 'c3', name: 'Cy', company: 'Gamma' }];
  const quotes = [
    { clientId: 'c2', status: 'accepted', acceptedAt: '2026-01-10T00:00:00.000Z', lineItems: [{ hours: 5, rate: 100 }] },
    { clientId: 'c1', status: 'accepted', acceptedAt: '2026-02-10T00:00:00.000Z', lineItems: [{ hours: 20, rate: 100 }] },
    { clientId: 'c1', status: 'accepted', acceptedAt: '2026-03-10T00:00:00.000Z', lineItems: [{ hours: 10, rate: 100 }] },
    { clientId: 'c3', status: 'sent', lineItems: [{ hours: 100, rate: 100 }] },
  ];
  const rows = calc.revenueByClient(quotes, clients, settings);
  assert.equal(rows[0].name, 'Alpha');
  assert.equal(rows[0].revenue, 3000);
  assert.equal(rows[0].quotes, 2);
  assert.equal(rows[0].lastActivity, '2026-03-10T00:00:00.000Z');
  assert.equal(rows[1].name, 'Beta');
  assert.equal(rows[2].revenue, 0);
});

test('pipelineSummary totals each status', () => {
  const quotes = [
    { status: 'draft', lineItems: [{ hours: 1, rate: 100 }] },
    { status: 'sent', lineItems: [{ hours: 2, rate: 100 }] },
    { status: 'sent', lineItems: [{ hours: 3, rate: 100 }] },
    { status: 'accepted', lineItems: [{ hours: 10, rate: 100 }] },
  ];
  const rows = calc.pipelineSummary(quotes, settings);
  const byStatus = Object.fromEntries(rows.map((row) => [row.status, row]));
  assert.equal(byStatus.draft.count, 1);
  assert.equal(byStatus.draft.value, 100);
  assert.equal(byStatus.sent.count, 2);
  assert.equal(byStatus.sent.value, 500);
  assert.equal(byStatus.accepted.value, 1000);
  assert.equal(byStatus.declined.count, 0);
  assert.equal(rows.length, calc.QUOTE_STATUSES.length);
});

test('clientSummary: win rate, pipeline and lifetime value', () => {
  const client = { id: 'c1', name: 'Ada', company: 'Alpha' };
  const quotes = [
    { clientId: 'c1', status: 'accepted', lineItems: [{ hours: 10, rate: 100 }] },
    { clientId: 'c1', status: 'declined', lineItems: [{ hours: 5, rate: 100 }] },
    { clientId: 'c1', status: 'sent', lineItems: [{ hours: 3, rate: 100 }] },
    { clientId: 'c2', status: 'accepted', lineItems: [{ hours: 100, rate: 100 }] },
  ];
  const summary = calc.clientSummary(client, quotes, [], settings);
  assert.equal(summary.quotes, 3);
  assert.equal(summary.won, 1);
  assert.equal(summary.lost, 1);
  assert.equal(summary.winRate, 50);
  assert.equal(summary.wonValue, 1000);
  assert.equal(summary.lostValue, 500);
  assert.equal(summary.pipelineValue, 300);
  assert.equal(summary.lifetimeValue, 1000);
  assert.equal(summary.averageMargin, null);
});

test('attentionItems: expiring quotes first, then over-budget and thin projects', () => {
  const quotes = [
    { id: 'q_sent', number: 'Q-1', clientId: 'c1', status: 'sent', validUntil: '2026-05-09', title: 'Old' },
    { id: 'q_urgent', number: 'Q-2', clientId: 'c1', status: 'sent', validUntil: '2026-05-12', title: 'Soon' },
    { id: 'q_ok', number: 'Q-3', clientId: 'c1', status: 'sent', validUntil: '2026-06-30', title: 'Fine' },
    { id: 'q_won', number: 'Q-4', clientId: 'c1', status: 'accepted', validUntil: '2026-05-01', title: 'Won', lineItems: [{ hours: 10, rate: 100, cost: 60 }] },
  ];
  const projects = [
    {
      id: 'p_over',
      name: 'Overrun job',
      clientId: 'c1',
      quoteId: 'q_won',
      status: 'active',
      budgetHours: 10,
      hourlyRate: 100,
      costRate: 30,
      timeEntries: [{ hours: 16, billable: true }],
      costs: [],
    },
    {
      id: 'p_thin',
      name: 'Thin job',
      clientId: 'c1',
      quoteId: 'q_won',
      status: 'active',
      budgetHours: 10,
      hourlyRate: 100,
      costRate: 90,
      timeEntries: [{ hours: 9, billable: true }],
      costs: [],
    },
    {
      id: 'p_idle',
      name: 'No time yet',
      clientId: 'c1',
      quoteId: null,
      status: 'active',
      budgetHours: 10,
      timeEntries: [],
      costs: [],
    },
  ];

  const items = calc.attentionItems({ quotes, projects, settings }, '2026-05-10');

  assert.deepEqual(
    items.map((item) => `${item.kind}:${item.severity}`),
    ['expired:high', 'overBudget:high', 'expiring:medium', 'lowMargin:medium'],
  );
  assert.equal(items[0].title, 'Quote Q-1 expired');
  assert.equal(items[0].link, '#/quotes/q_sent');
  assert.equal(items[1].detail, '16h logged against 10h estimated');
  assert.equal(items[2].title, 'Quote Q-2 expires in 2 days');
  assert.equal(items[3].detail, 'Target is 55% — check the hours logged so far');
  // an untouched project has no time and no revenue, so it is not worth nagging about
  assert.ok(!items.some((item) => item.link.includes('p_idle')));
});

test('formatting: money, hours, percent and dates', () => {
  assert.equal(calc.currencySymbol('USD'), '$');
  assert.equal(calc.currencySymbol('EUR'), '€');
  assert.equal(calc.currencySymbol('XYZ'), 'XYZ ');
  assert.equal(calc.formatMoney(1234.5, 'USD'), '$1,234.50');
  assert.equal(calc.formatMoney(-20, 'USD'), '-$20.00');
  assert.equal(calc.formatMoney(1234.5, 'USD', { decimals: 0 }), '$1,235');
  assert.equal(calc.formatMoney('bad', 'USD'), '$0.00');
  assert.equal(calc.formatHours(8), '8h');
  assert.equal(calc.formatHours(8.25), '8.3h');
  assert.equal(calc.formatHours('x'), '0h');
  assert.equal(calc.formatPercent(42.46), '42%');
  assert.equal(calc.formatPercent(42.46, 1), '42.5%');
  assert.equal(calc.formatDate('2026-05-04'), new Date('2026-05-04T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  assert.equal(calc.formatDate(''), '—');
  assert.equal(calc.formatDate('nonsense'), '—');
});

test('presets and labels cover the documented values', () => {
  assert.deepEqual(calc.COMPLEXITY_PRESETS.map((preset) => preset.value), [1, 1.25, 1.5, 2]);
  assert.deepEqual(calc.RUSH_PRESETS, [0, 10, 15, 25]);
  assert.deepEqual(calc.QUOTE_STATUSES, ['draft', 'sent', 'accepted', 'declined', 'expired']);
  assert.deepEqual(calc.PROJECT_STATUSES, ['active', 'onHold', 'completed']);
  for (const status of calc.QUOTE_STATUSES) assert.equal(typeof calc.QUOTE_STATUS_LABELS[status], 'string');
  for (const status of calc.PROJECT_STATUSES) assert.equal(typeof calc.PROJECT_STATUS_LABELS[status], 'string');
});

test('normaliseItem fills defaults and never returns negative numbers', () => {
  const item = calc.normaliseItem({ description: 'x' }, settings);
  assert.equal(item.rate, settings.defaultHourlyRate);
  assert.equal(item.complexity, 1);
  assert.equal(item.rushPercent, 0);
  assert.equal(item.cost, 0);
  assert.equal(calc.normaliseItem(null, settings).hours, calc.DEFAULT_ITEM.hours);
  assert.equal(calc.normaliseItem({ hours: 'abc', rate: 'abc' }, settings).hours, calc.DEFAULT_ITEM.hours);
});
