/**
 * Data layer.
 *
 * Everything lives in one localStorage key as one JSON document. That is the
 * simplest storage that fits the job: a single user, their own records, on their
 * own device. No server, no account, no sync — and the buyer can copy the file
 * to back it up (Settings → Export).
 *
 * The store is a UMD module so the same code can be unit-tested in Node with a
 * fake localStorage.
 */
(function (root, factory) {
  const calc = root.MarginDeskCalc || (typeof require === 'function' ? require('./calc.js') : null);
  const api = factory(calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarginDeskStore = api;
})(typeof self !== 'undefined' ? self : this, function (calc) {
  'use strict';

  const STORAGE_KEY = 'margindesk.data.v1';
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      settings: Object.assign({}, calc.DEFAULT_SETTINGS),
      clients: [],
      quotes: [],
      projects: [],
      seeded: false,
    };
  }

  function createStore(options) {
    const settings = options || {};
    const storage = settings.storage !== undefined ? settings.storage : safeLocalStorage();
    const seedFactory = settings.seed || null;
    let state = null;
    const listeners = [];

    function notify() {
      for (const listener of listeners) listener(state);
    }

    function safeLocalStorage() {
      try {
        const probe = '__margindesk_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return window.localStorage;
      } catch (error) {
        return null;
      }
    }

    function read() {
      if (state) return state;
      let raw = null;
      if (storage) {
        try {
          raw = storage.getItem(STORAGE_KEY);
        } catch (error) {
          raw = null;
        }
      }
      if (raw) {
        try {
          state = migrate(JSON.parse(raw));
        } catch (error) {
          state = emptyState();
        }
      } else {
        state = emptyState();
        if (seedFactory) {
          state = migrate(seedFactory());
          state.seeded = true;
          write();
        }
      }
      return state;
    }

    function migrate(data) {
      const base = emptyState();
      if (!data || typeof data !== 'object') return base;
      const merged = {
        version: SCHEMA_VERSION,
        settings: Object.assign(base.settings, data.settings || {}),
        clients: Array.isArray(data.clients) ? data.clients : [],
        quotes: Array.isArray(data.quotes) ? data.quotes : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
        seeded: Boolean(data.seeded),
      };
      for (const quote of merged.quotes) {
        quote.lineItems = Array.isArray(quote.lineItems) ? quote.lineItems : [];
        quote.discount = quote.discount || { type: 'percent', value: 0 };
      }
      for (const project of merged.projects) {
        project.timeEntries = Array.isArray(project.timeEntries) ? project.timeEntries : [];
        project.costs = Array.isArray(project.costs) ? project.costs : [];
      }
      return merged;
    }

    function write() {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (error) {
        return false;
      }
    }

    function commit() {
      write();
      notify();
      return state;
    }

    /* -------------------------------------------------------------- queries */

    function all() {
      return read();
    }

    function getSettings() {
      return read().settings;
    }

    function saveSettings(patch) {
      read().settings = Object.assign({}, read().settings, patch);
      return commit().settings;
    }

    function clients() {
      return read().clients.slice().sort((a, b) => a.name.localeCompare(b.name));
    }

    function client(id) {
      return read().clients.find((item) => item.id === id) || null;
    }

    function clientName(id) {
      const found = client(id);
      return found ? found.company || found.name : 'Unknown client';
    }

    function addClient(data) {
      const record = Object.assign(
        { id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), notes: '' },
        data,
      );
      read().clients.push(record);
      commit();
      return record;
    }

    function updateClient(id, patch) {
      const found = client(id);
      if (!found) return null;
      Object.assign(found, patch, { updatedAt: new Date().toISOString() });
      commit();
      return found;
    }

    function removeClient(id) {
      const state_ = read();
      state_.clients = state_.clients.filter((item) => item.id !== id);
      commit();
    }

    function quotes() {
      return read()
        .quotes.slice()
        .sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)));
    }

    function quote(id) {
      return read().quotes.find((item) => item.id === id) || null;
    }

    function addQuote(data) {
      const settings = getSettings();
      const record = Object.assign(
        {
          id: `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          number: '',
          status: 'draft',
          issueDate: calc.todayIso(),
          validUntil: calc.addDays(calc.todayIso(), settings.quoteValidityDays),
          lineItems: [],
          discount: { type: 'percent', value: 0 },
          taxRate: settings.taxRate,
          notes: '',
          projectId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data,
      );
      record.issueDate = record.issueDate || calc.todayIso();
      if (!record.validUntil || record.validUntil < record.issueDate) {
        record.validUntil = calc.addDays(record.issueDate, settings.quoteValidityDays);
      }
      record.number = record.number || calc.quoteNumber(record, settings, read().quotes);
      read().quotes.push(record);
      commit();
      return record;
    }

    function updateQuote(id, patch) {
      const found = quote(id);
      if (!found) return null;
      Object.assign(found, patch, { updatedAt: new Date().toISOString() });
      commit();
      return found;
    }

    function removeQuote(id) {
      const state_ = read();
      state_.quotes = state_.quotes.filter((item) => item.id !== id);
      commit();
    }

    function setQuoteStatus(id, status) {
      const found = quote(id);
      if (!found) return null;
      found.status = status;
      found.updatedAt = new Date().toISOString();
      if (status === 'accepted') found.acceptedAt = found.acceptedAt || found.updatedAt;
      commit();
      return found;
    }

    function duplicateQuote(id) {
      const source = quote(id);
      if (!source) return null;
      const copy = JSON.parse(JSON.stringify(source));
      delete copy.id;
      copy.number = '';
      copy.status = 'draft';
      copy.title = `${source.title} (copy)`;
      copy.issueDate = calc.todayIso();
      copy.validUntil = calc.addDays(copy.issueDate, getSettings().quoteValidityDays);
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      delete copy.acceptedAt;
      // a copy is never the source of an existing project
      copy.projectId = null;
      copy.lineItems = copy.lineItems.map((item, index) => Object.assign({}, item, { id: `li_${index}_${Date.now().toString(36)}` }));
      return addQuote(copy);
    }

    function projects() {
      return read()
        .projects.slice()
        .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    }

    function project(id) {
      return read().projects.find((item) => item.id === id) || null;
    }

    function addProject(data) {
      const record = Object.assign(
        {
          id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          name: 'Untitled project',
          clientId: null,
          quoteId: null,
          status: 'active',
          startDate: calc.todayIso(),
          dueDate: null,
          budgetHours: 0,
          hourlyRate: getSettings().defaultHourlyRate,
          costRate: getSettings().defaultCostRate,
          notes: '',
          timeEntries: [],
          costs: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        data,
      );
      read().projects.push(record);
      commit();
      return record;
    }

    function updateProject(id, patch) {
      const found = project(id);
      if (!found) return null;
      Object.assign(found, patch, { updatedAt: new Date().toISOString() });
      commit();
      return found;
    }

    function removeProject(id) {
      const state_ = read();
      state_.projects = state_.projects.filter((item) => item.id !== id);
      for (const quoteItem of state_.quotes) {
        if (quoteItem.projectId === id) quoteItem.projectId = null;
      }
      commit();
    }

    function logTime(projectId, entry) {
      const found = project(projectId);
      if (!found) return null;
      found.timeEntries.push(
        Object.assign(
          { id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: calc.todayIso(), billable: true },
          entry,
        ),
      );
      commit();
      return found;
    }

    function removeTimeEntry(projectId, entryId) {
      const found = project(projectId);
      if (!found) return null;
      found.timeEntries = found.timeEntries.filter((entry) => entry.id !== entryId);
      commit();
      return found;
    }

    function addCost(projectId, cost) {
      const found = project(projectId);
      if (!found) return null;
      found.costs.push(
        Object.assign(
          { id: `cst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: calc.todayIso() },
          cost,
        ),
      );
      commit();
      return found;
    }

    function removeCost(projectId, costId) {
      const found = project(projectId);
      if (!found) return null;
      found.costs = found.costs.filter((cost) => cost.id !== costId);
      commit();
      return found;
    }

    /** Turns an accepted quote into a project with the hours already estimated. */
    function convertQuoteToProject(quoteId) {
      const source = quote(quoteId);
      if (!source) return null;
      const settings = getSettings();
      const totals = calc.quoteTotals(source, settings);
      const firstLine = totals.lines[0];
      const created = addProject({
        name: source.title,
        clientId: source.clientId,
        quoteId: source.id,
        status: 'active',
        startDate: calc.todayIso(),
        dueDate: calc.addDays(calc.todayIso(), Math.max(14, Math.round(totals.totalHours / 4))),
        budgetHours: totals.totalHours,
        hourlyRate: firstLine ? firstLine.rate : settings.defaultHourlyRate,
        costRate: settings.defaultCostRate,
        notes: source.notes || '',
      });
      updateQuote(quoteId, { projectId: created.id });
      return created;
    }

    /* -------------------------------------------------------- import/export */

    function exportData() {
      const state_ = read();
      return JSON.stringify(
        {
          app: 'MarginDesk',
          version: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          settings: state_.settings,
          clients: state_.clients,
          quotes: state_.quotes,
          projects: state_.projects,
        },
        null,
        2,
      );
    }

    function importData(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      if (!parsed || typeof parsed !== 'object') throw new Error('That file does not contain MarginDesk data.');
      if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.quotes)) {
        throw new Error('That file is missing the clients or quotes list.');
      }
      state = migrate(parsed);
      write();
      notify();
      return state;
    }

    function reset({ withSeed = false } = {}) {
      state = withSeed && seedFactory ? migrate(seedFactory()) : emptyState();
      state.seeded = Boolean(withSeed);
      write();
      notify();
      return state;
    }

    function isEmpty() {
      const state_ = read();
      return state_.clients.length === 0 && state_.quotes.length === 0 && state_.projects.length === 0;
    }

    function subscribe(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    return {
      STORAGE_KEY,
      all,
      getSettings,
      saveSettings,
      clients,
      client,
      clientName,
      addClient,
      updateClient,
      removeClient,
      quotes,
      quote,
      addQuote,
      updateQuote,
      removeQuote,
      setQuoteStatus,
      duplicateQuote,
      projects,
      project,
      addProject,
      updateProject,
      removeProject,
      logTime,
      removeTimeEntry,
      addCost,
      removeCost,
      convertQuoteToProject,
      exportData,
      importData,
      reset,
      isEmpty,
      subscribe,
    };
  }

  return { createStore, emptyState, STORAGE_KEY, SCHEMA_VERSION };
});
