/**
 * Demo data tests.
 *
 * The first thing a buyer sees is this data, so it has to be coherent: no
 * dangling references, no placeholder text, no real people's contact details,
 * and enough variety that every screen has something to show.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildState } = require('../assets/js/seed.js');
const calc = require('../assets/js/calc.js');

const state = buildState();
const settings = state.settings;
const clientIds = new Set(state.clients.map((client) => client.id));
const quoteIds = new Set(state.quotes.map((quote) => quote.id));
const projectIds = new Set(state.projects.map((project) => project.id));

test('settings look like a real studio, not a default form', () => {
  assert.equal(settings.businessName, 'Fieldnote Studio');
  assert.equal(settings.ownerName, 'Maya Aldridge');
  assert.equal(settings.currency, 'USD');
  assert.equal(settings.defaultHourlyRate, 120);
  assert.equal(settings.defaultCostRate, 42);
  assert.equal(settings.targetMarginPercent, 55);
  assert.equal(settings.quoteValidityDays, 30);
  assert.match(settings.quotePrefix, /^[A-Z]{1,6}$/);
  assert.match(settings.accentColor, /^#[0-9a-f]{6}$/i);
  for (const key of ['email', 'phone', 'address', 'website', 'paymentTerms', 'bankDetails']) {
    assert.ok(String(settings[key] ?? '').length > 3, `${key} should be filled in`);
  }
});

test('the demo can pay for itself: rate is well above the cost rate', () => {
  assert.ok(settings.defaultHourlyRate > settings.defaultCostRate * 2);
});

test('clients are complete and use reserved example domains', () => {
  assert.ok(state.clients.length >= 5);
  const ids = new Set();
  for (const client of state.clients) {
    assert.ok(client.id && !ids.has(client.id), 'client ids must be unique');
    ids.add(client.id);
    for (const key of ['name', 'company', 'email', 'phone', 'address', 'notes']) {
      assert.ok(String(client[key] ?? '').trim().length > 2, `${client.id}.${key} should read like real content`);
    }
    assert.match(client.email, /@.+\.example$/, `${client.id} must not use a real domain`);
    assert.ok(!/lorem|ipsum|example\.com|test@test/i.test(JSON.stringify(client)), `${client.id} contains filler text`);
  }
});

test('quotes are internally consistent', () => {
  const numbers = new Set();
  for (const quote of state.quotes) {
    assert.ok(quoteIds.has(quote.id), `unknown quote id ${quote.id}`);
    assert.ok(!numbers.has(quote.number), `duplicate quote number ${quote.number}`);
    numbers.add(quote.number);
    assert.match(quote.number, new RegExp(`^${settings.quotePrefix}-\\d{4}-\\d{3}$`));
    assert.ok(clientIds.has(quote.clientId), `${quote.id} points at a missing client`);
    assert.ok(calc.QUOTE_STATUSES.includes(quote.status), `${quote.id} has an unknown status`);
    assert.match(quote.issueDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(quote.validUntil, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(quote.validUntil > quote.issueDate, `${quote.id} expires before it is issued`);
    assert.ok(quote.notes.trim().length > 10, `${quote.id} needs a note for the buyer`);
    assert.ok(['percent', 'fixed'].includes(quote.discount.type));
    assert.ok(Number.isFinite(quote.taxRate));

    assert.ok(quote.lineItems.length > 0, `${quote.id} has no line items`);
    for (const item of quote.lineItems) {
      assert.ok(item.description.trim().length > 3);
      assert.ok(item.detail.trim().length > 3);
      assert.ok(item.hours > 0, `${quote.id} has a line with no hours`);
      assert.ok(item.rate > 0);
      assert.ok(item.complexity >= 1);
      assert.ok(item.rushPercent >= 0);
      assert.ok(item.cost >= 0);
    }

    const totals = calc.quoteTotals(quote, settings);
    assert.ok(totals.total > 0, `${quote.id} is worth nothing`);
    assert.ok(Number.isFinite(totals.total) && Number.isFinite(totals.profit));
    assert.ok(totals.marginPercent > 0, `${quote.id} would show a zero margin on screen`);

    if (quote.projectId) {
      assert.ok(projectIds.has(quote.projectId), `${quote.id} points at a missing project`);
      const project = state.projects.find((item) => item.id === quote.projectId);
      assert.equal(project.quoteId, quote.id, `${quote.id} and ${project.id} disagree about their link`);
    }
    if (quote.status === 'accepted') assert.ok(quote.acceptedAt, `${quote.id} is accepted but never stamped`);
    if (quote.status !== 'accepted') assert.equal(quote.acceptedAt, undefined);
  }
});

test('every quote status appears so each filter has something to show', () => {
  const statuses = new Set(state.quotes.map((quote) => quote.status));
  for (const status of ['draft', 'sent', 'accepted', 'declined']) {
    assert.ok(statuses.has(status), `no ${status} quote in the demo data`);
  }
  // an accepted quote without a project gives the "start project" flow a demo
  assert.ok(state.quotes.some((quote) => quote.status === 'accepted' && !quote.projectId));
});

test('projects link to real quotes and carry believable time and costs', () => {
  const statuses = new Set();
  for (const project of state.projects) {
    assert.ok(clientIds.has(project.clientId), `${project.id} points at a missing client`);
    statuses.add(project.status);
    assert.ok(calc.PROJECT_STATUSES.includes(project.status));
    assert.ok(project.name.trim().length > 3);
    assert.ok(project.notes.trim().length > 10, `${project.id} needs notes`);
    assert.ok(project.budgetHours > 0);
    assert.ok(project.hourlyRate > 0);
    assert.ok(project.costRate > 0);
    assert.ok(project.dueDate >= project.startDate);

    if (project.quoteId) {
      assert.ok(quoteIds.has(project.quoteId));
      const quote = state.quotes.find((item) => item.id === project.quoteId);
      assert.equal(quote.clientId, project.clientId, `${project.id} and its quote disagree on the client`);
    }

    for (const entry of project.timeEntries) {
      assert.ok(entry.hours > 0, `${project.id} has a time entry with no hours`);
      assert.ok(entry.note.trim().length > 3);
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof entry.billable, 'boolean');
    }
    for (const cost of project.costs) {
      assert.ok(cost.amount > 0, `${project.id} has a cost with no amount`);
      assert.ok(cost.label.trim().length > 3);
    }

    if (project.status === 'completed') {
      const totals = calc.projectTotals(project, state.quotes.find((quote) => quote.id === project.quoteId), settings);
      assert.ok(totals.loggedHours > 0, `${project.id} is complete but no time was logged`);
      assert.ok(totals.profit > 0, `${project.id} finished at a loss — not a good demo`);
    }
  }

  for (const status of ['active', 'onHold', 'completed']) {
    assert.ok(statuses.has(status), `no ${status} project in the demo data`);
  }
});

test('the demo tells a story: an expiry, an overrun and a thin or healthy mix', () => {
  const today = calc.todayIso();
  const attention = calc.attentionItems({ quotes: state.quotes, projects: state.projects, settings }, today);
  const kinds = attention.map((item) => item.kind);

  assert.ok(kinds.includes('expired'), 'no overdue quote to follow up on');
  assert.ok(kinds.includes('expiring'), 'no quote about to expire');

  const overruns = state.projects.filter((project) => {
    const totals = calc.projectTotals(project, state.quotes.find((quote) => quote.id === project.quoteId), settings);
    return totals.overBudgetHours;
  });
  assert.ok(overruns.length >= 1, 'no project runs over its estimate in the demo');

  const nonBillable = state.projects.flatMap((project) => project.timeEntries).filter((entry) => entry.billable === false);
  assert.ok(nonBillable.length >= 1, 'demo should show non-billable time');
  const expenses = state.projects.flatMap((project) => project.costs);
  assert.ok(expenses.length >= 2, 'demo should show out-of-pocket costs');
});

test('reports produce real numbers from the demo data', () => {
  const accepted = state.quotes.filter((quote) => quote.status === 'accepted');
  const revenue = calc.sum(accepted, (quote) => calc.quoteTotals(quote, settings).total);
  assert.ok(revenue > 10000, 'the demo should show meaningful revenue');

  const sixMonths = calc.revenueByMonth(state.quotes, settings, new Date(), 6);
  const allTime = calc.revenueByMonth(state.quotes, settings, new Date(), 24);
  assert.ok(calc.sum(sixMonths, (row) => row.revenue) > 0);
  assert.ok(
    calc.sum(allTime, (row) => row.revenue) >= calc.sum(sixMonths, (row) => row.revenue),
    'a wider window can only show more revenue',
  );
  for (const row of sixMonths) assert.ok(Number.isFinite(row.revenue) && Number.isFinite(row.profit));

  const byClient = calc.revenueByClient(state.quotes, state.clients, settings);
  assert.equal(byClient.length, state.clients.length);
  for (let i = 1; i < byClient.length; i += 1) {
    assert.ok(byClient[i - 1].revenue >= byClient[i].revenue, 'client revenue should be sorted high to low');
  }
  assert.ok(byClient.some((row) => row.revenue > 0));

  const pipeline = calc.pipelineSummary(state.quotes, settings);
  assert.equal(calc.sum(pipeline, (row) => row.count), state.quotes.length);
  assert.equal(calc.sum(pipeline, (row) => row.value), calc.sum(state.quotes, (quote) => calc.quoteTotals(quote, settings).total));
});

test('the demo is rebuilt from scratch on every call', () => {
  const again = buildState();
  assert.deepEqual(
    again.quotes.map((quote) => quote.number),
    state.quotes.map((quote) => quote.number),
  );
  assert.notEqual(again.quotes[0], state.quotes[0], 'each build should return fresh objects');
  assert.equal(again.seeded, true);
  assert.equal(again.version, state.version);
});

test('no placeholder or filler text anywhere in the demo data', () => {
  const text = JSON.stringify(state).toLowerCase();
  for (const banned of ['lorem', 'ipsum', 'dolor sit', 'your studio', 'todo', 'tbd', 'xxx', 'foo', 'bar@example', 'test@']) {
    assert.ok(!text.includes(banned), `demo data contains "${banned}"`);
  }
  const phones = state.clients.map((client) => client.phone).join(' ');
  assert.match(phones, /\+1 \(\d{3}\) 555-01\d\d/, 'demo phone numbers should use the reserved 555-01xx fiction range');
  assert.equal((phones.match(/\+1 \(\d{3}\) 555-01\d\d/g) ?? []).length, state.clients.length);
});
