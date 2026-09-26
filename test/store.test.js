/**
 * Data layer tests.
 *
 * The store is exercised with a fake localStorage, which is also the reason it
 * is written as a UMD module: the same code the browser runs is the code under
 * test here, with no mocking library and no dependencies.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore, STORAGE_KEY, emptyState, SCHEMA_VERSION } = require('../assets/js/store.js');
const calc = require('../assets/js/calc.js');
const { buildState } = require('../assets/js/seed.js');

/** Minimal in-memory stand-in for window.localStorage. */
function fakeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

function seededStore() {
  const storage = fakeStorage();
  const store = createStore({ storage, seed: () => buildState() });
  return { store, storage };
}

test('first read seeds the demo data and writes it to storage', () => {
  const { store, storage } = seededStore();
  const clients = store.clients();

  assert.ok(clients.length >= 5, 'demo data should include clients');
  assert.ok(store.quotes().length >= 7);
  assert.ok(store.projects().length >= 4);
  assert.equal(store.isEmpty(), false);

  const raw = storage.getItem(STORAGE_KEY);
  assert.ok(raw, 'state must be persisted immediately after seeding');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, SCHEMA_VERSION);
  assert.equal(parsed.clients.length, clients.length);
  assert.equal(parsed.seeded, true);
});

test('existing storage is reused instead of re-seeding', () => {
  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      settings: { businessName: 'Acme' },
      clients: [{ id: 'c1', name: 'Ada', company: 'Alpha' }],
      quotes: [],
      projects: [],
      seeded: true,
    }),
  });
  const store = createStore({ storage, seed: () => buildState() });

  assert.equal(store.getSettings().businessName, 'Acme');
  assert.equal(store.clients().length, 1);
});

test('unreadable storage falls back to an empty state instead of throwing', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{not json at all' });
  const store = createStore({ storage });
  assert.deepEqual(store.clients(), []);
  assert.deepEqual(store.quotes(), []);
  assert.equal(store.isEmpty(), true);
});

test('migration repairs records that are missing their arrays', () => {
  const storage = fakeStorage({
    [STORAGE_KEY]: JSON.stringify({
      settings: {},
      clients: [{ id: 'c1', name: 'Ada' }],
      quotes: [{ id: 'q1', clientId: 'c1', title: 'Broken quote' }],
      projects: [{ id: 'p1', clientId: 'c1' }],
    }),
  });
  const store = createStore({ storage });

  const quote = store.quote('q1');
  assert.deepEqual(quote.lineItems, []);
  assert.deepEqual(quote.discount, { type: 'percent', value: 0 });

  const project = store.project('p1');
  assert.deepEqual(project.timeEntries, []);
  assert.deepEqual(project.costs, []);

  // missing settings fall back to the documented defaults
  assert.equal(store.getSettings().currency, calc.DEFAULT_SETTINGS.currency);
});

test('client create, update, delete and name resolution', () => {
  const store = createStore({ storage: fakeStorage() });

  const created = store.addClient({ name: 'Dana Whitfield', company: 'Harbor Coffee', email: 'dana@example.test' });
  assert.ok(created.id.startsWith('c_'));
  assert.ok(created.createdAt);
  assert.equal(store.clientName(created.id), 'Harbor Coffee');
  assert.equal(store.client('missing'), null);

  store.addClient({ name: 'Bo', company: '' });
  assert.equal(store.clientName(store.clients().find((client) => client.name === 'Bo').id), 'Bo');

  store.updateClient(created.id, { company: 'Harbor Roasters' });
  assert.equal(store.client(created.id).company, 'Harbor Roasters');
  assert.ok(store.client(created.id).updatedAt);
  assert.equal(store.updateClient('nope', { name: 'x' }), null);

  // clients() is sorted by contact name
  assert.deepEqual(store.clients().map((client) => client.name), ['Bo', 'Dana Whitfield']);

  store.removeClient(created.id);
  assert.equal(store.client(created.id), null);
  assert.equal(store.clientName(created.id), 'Unknown client');
});

test('new quotes get a sequential number, defaults and a local issue date', () => {
  const store = createStore({ storage: fakeStorage() });
  store.saveSettings({ quotePrefix: 'AC', quoteValidityDays: 14, taxRate: 8 });
  const client = store.addClient({ name: 'Ada', company: 'Alpha' });

  const first = store.addQuote({ clientId: client.id, title: 'One' });
  const second = store.addQuote({ clientId: client.id, title: 'Two' });

  const year = new Date().getFullYear();
  assert.equal(first.number, `AC-${year}-001`);
  assert.equal(second.number, `AC-${year}-002`);
  assert.equal(first.status, 'draft');
  assert.equal(first.taxRate, 8);
  assert.equal(first.issueDate, calc.todayIso());
  assert.equal(first.validUntil, calc.addDays(first.issueDate, 14));
  assert.deepEqual(first.discount, { type: 'percent', value: 0 });
});

test('a quote saved without dates still gets a usable issue date and number', () => {
  const { store } = seededStore();
  const client = store.clients()[0];

  const blank = store.addQuote({ clientId: client.id, title: 'Blank dates', issueDate: '', validUntil: '' });
  assert.equal(blank.issueDate, calc.todayIso());
  assert.equal(blank.validUntil, calc.addDays(calc.todayIso(), 30));
  assert.doesNotMatch(blank.number, /NaN/);
  assert.match(blank.number, /^FN-\d{4}-\d{3}$/);

  const stale = store.addQuote({ clientId: client.id, title: 'Stale validity', issueDate: '2026-06-01', validUntil: '2026-05-01' });
  assert.equal(stale.validUntil, calc.addDays('2026-06-01', 30));
});

test('quote status changes record when a quote was accepted', () => {
  const { store } = seededStore();
  const quote = store.addQuote({ clientId: store.clients()[0].id, title: 'Small job' });

  assert.equal(store.setQuoteStatus(quote.id, 'sent').status, 'sent');
  assert.equal(store.quote(quote.id).acceptedAt, undefined);

  const accepted = store.setQuoteStatus(quote.id, 'accepted');
  assert.ok(accepted.acceptedAt, 'accepting must stamp acceptedAt for revenue reports');
  assert.equal(store.setQuoteStatus(quote.id, 'declined').status, 'declined');
  assert.equal(store.setQuoteStatus('missing', 'sent'), null);

  store.removeQuote(quote.id);
  assert.equal(store.quote(quote.id), null);
});

test('duplicating a quote produces an independent draft', () => {
  const { store } = seededStore();
  const source = store.quotes().find((quote) => quote.status === 'accepted' && quote.projectId);
  const copy = store.duplicateQuote(source.id);

  assert.notEqual(copy.id, source.id);
  assert.equal(copy.status, 'draft');
  assert.equal(copy.projectId, null);
  assert.equal(copy.acceptedAt, undefined);
  assert.equal(copy.title, `${source.title} (copy)`);
  assert.equal(copy.issueDate, calc.todayIso());
  assert.equal(copy.number, calc.quoteNumber(copy, store.getSettings(), store.quotes()));
  assert.equal(copy.lineItems.length, source.lineItems.length);
  assert.notEqual(copy.lineItems[0].id, source.lineItems[0].id);

  // the original is untouched
  assert.equal(store.quote(source.id).title, source.title);
  assert.equal(store.quote(source.id).projectId, source.projectId);
  assert.equal(store.duplicateQuote('missing'), null);
});

test('logging time and costs updates the project record', () => {
  const { store } = seededStore();
  const project = store.projects()[0];
  const before = project.timeEntries.length;

  const entry = { hours: 2.5, note: 'Bug fixes' };
  store.logTime(project.id, entry);
  const timeEntries = store.project(project.id).timeEntries;
  assert.equal(timeEntries.length, before + 1);
  const added = timeEntries.at(-1);
  assert.equal(added.hours, 2.5);
  assert.equal(added.date, calc.todayIso());
  assert.equal(added.billable, true);
  assert.ok(added.id.startsWith('t_'));

  store.logTime(project.id, { hours: 1, billable: false });
  assert.equal(store.project(project.id).timeEntries.at(-1).billable, false);
  assert.equal(store.project(project.id).timeEntries.length, before + 2);

  store.removeTimeEntry(project.id, added.id);
  assert.equal(store.project(project.id).timeEntries.length, before + 1);
  assert.equal(store.logTime('missing', { hours: 1 }), null);

  const costCount = store.project(project.id).costs.length;
  store.addCost(project.id, { label: 'Stock photos', amount: 42.5 });
  const costs = store.project(project.id).costs;
  assert.equal(costs.length, costCount + 1);
  assert.equal(costs.at(-1).amount, 42.5);
  assert.equal(costs.at(-1).date, calc.todayIso());

  store.removeCost(project.id, costs.at(-1).id);
  assert.equal(store.project(project.id).costs.length, costCount);
  assert.equal(store.addCost('missing', { amount: 1 }), null);

  // removing an entry that is not there is a harmless no-op, not a crash
  assert.ok(store.removeCost(project.id, 'nope'));
  assert.equal(store.project(project.id).costs.length, costCount);
  assert.ok(store.removeTimeEntry(project.id, 'nope'));
  assert.equal(store.project(project.id).timeEntries.length, before + 1);
  assert.equal(store.removeTimeEntry('missing', 'nope'), null);
  assert.equal(store.removeCost('missing', 'nope'), null);
});

test('converting an accepted quote creates a project with the estimated hours', () => {
  const { store } = seededStore();
  const quote = store.quotes().find((item) => item.status === 'accepted' && !item.projectId);
  const settings = store.getSettings();
  const totals = calc.quoteTotals(quote, settings);

  const project = store.convertQuoteToProject(quote.id);

  assert.equal(project.name, quote.title);
  assert.equal(project.clientId, quote.clientId);
  assert.equal(project.quoteId, quote.id);
  assert.equal(project.status, 'active');
  assert.equal(project.budgetHours, totals.totalHours);
  assert.equal(project.hourlyRate, totals.lines[0].rate);
  assert.equal(project.costRate, settings.defaultCostRate);
  assert.equal(project.startDate, calc.todayIso());
  assert.equal(project.dueDate, calc.addDays(project.startDate, Math.max(14, Math.round(totals.totalHours / 4))));
  assert.deepEqual(project.timeEntries, []);

  // the quote remembers where it went
  assert.equal(store.quote(quote.id).projectId, project.id);
  assert.equal(store.convertQuoteToProject('missing'), null);
});

test('deleting a project leaves the quote it came from alone', () => {
  const { store } = seededStore();
  const project = store.projects().find((item) => item.quoteId);
  store.removeProject(project.id);

  assert.equal(store.project(project.id), null);
  assert.ok(store.quote(project.quoteId), 'the source quote must survive');
  assert.equal(store.quote(project.quoteId).projectId, null);
});

test('export and import round-trip every record', () => {
  const { store } = seededStore();
  const json = store.exportData();
  const payload = JSON.parse(json);

  assert.equal(payload.app, 'MarginDesk');
  assert.equal(payload.version, SCHEMA_VERSION);
  assert.ok(payload.exportedAt);
  assert.equal(payload.clients.length, store.clients().length);
  assert.equal(payload.quotes.length, store.quotes().length);
  assert.equal(payload.projects.length, store.projects().length);

  const target = createStore({ storage: fakeStorage() });
  assert.equal(target.isEmpty(), true);
  target.importData(json);
  assert.equal(target.clients().length, store.clients().length);
  assert.equal(target.quotes().length, store.quotes().length);
  assert.equal(target.projects().length, store.projects().length);
  assert.equal(target.getSettings().businessName, store.getSettings().businessName);
});

test('importing rubbish fails loudly instead of wiping the app', () => {
  const { store } = seededStore();
  const before = store.clients().length;

  assert.throws(() => store.importData('not json'), /Unexpected|JSON/i);
  assert.throws(() => store.importData('{"hello":"world"}'), /clients or quotes/);
  assert.throws(() => store.importData(null), /does not contain MarginDesk data/);
  assert.equal(store.clients().length, before);
});

test('reset empties the app or brings the demo data back', () => {
  const { store } = seededStore();

  store.reset();
  assert.equal(store.isEmpty(), true);
  assert.equal(store.clients().length, 0);
  assert.equal(store.getSettings().businessName, calc.DEFAULT_SETTINGS.businessName);

  store.reset({ withSeed: true });
  assert.equal(store.isEmpty(), false);
  assert.equal(store.getSettings().businessName, 'Fieldnote Studio');
  assert.ok(store.all().seeded);
});

test('subscribers are notified on every change and can unsubscribe', () => {
  const { store } = seededStore();
  let calls = 0;
  let lastState = null;
  const unsubscribe = store.subscribe((state) => {
    calls += 1;
    lastState = state;
  });

  store.addClient({ name: 'Ada' });
  assert.equal(calls, 1);
  assert.equal(lastState.clients.length, store.clients().length);

  store.saveSettings({ currency: 'EUR' });
  assert.equal(calls, 2);
  assert.equal(store.getSettings().currency, 'EUR');

  unsubscribe();
  store.addClient({ name: 'Bo' });
  assert.equal(calls, 2, 'no notifications after unsubscribe');
});

test('the store keeps working when storage is unavailable', () => {
  const store = createStore({ storage: null, seed: () => buildState() });
  assert.ok(store.clients().length >= 5);
  store.addClient({ name: 'In memory only' });
  assert.equal(store.clients().some((client) => client.name === 'In memory only'), true);
});

test('emptyState matches the documented shape', () => {
  const state = emptyState();
  assert.equal(state.version, SCHEMA_VERSION);
  assert.deepEqual(state.clients, []);
  assert.deepEqual(state.quotes, []);
  assert.deepEqual(state.projects, []);
  assert.equal(state.seeded, false);
  assert.equal(state.settings.businessName, calc.DEFAULT_SETTINGS.businessName);
});
