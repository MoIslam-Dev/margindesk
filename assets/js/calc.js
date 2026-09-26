/**
 * MarginDesk calculation engine.
 *
 * Pure functions only: no DOM, no storage, no dates from "now". Everything the
 * app shows as money, margin or hours is computed here, which is why the engine
 * can be unit-tested in Node (see test/calc.test.js).
 *
 * The pricing model is deliberately simple and explicit:
 *
 *   line amount  = hours x rate
 *   complexity   = line amount x (multiplier - 1)      e.g. 1.5x for a hard build
 *   rush fee     = (line amount + complexity) x rush %
 *   line total   = line amount + complexity + rush fee
 *   subtotal     = sum of line totals
 *   discount     = subtotal x discount %   (or a fixed amount)
 *   tax          = (subtotal - discount) x tax %
 *   total        = subtotal - discount + tax
 *
 * Profit is measured against what the work actually costs you:
 *   labour cost  = logged hours x your internal cost-per-hour
 *   direct cost  = out-of-pocket expenses logged on the project
 *   profit       = revenue - labour cost - direct cost
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarginDeskCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COMPLEXITY_PRESETS = [
    { value: 1, label: 'Standard (1x)' },
    { value: 1.25, label: 'Somewhat complex (1.25x)' },
    { value: 1.5, label: 'Complex (1.5x)' },
    { value: 2, label: 'Very complex (2x)' },
  ];

  const RUSH_PRESETS = [0, 10, 15, 25];

  const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];

  const QUOTE_STATUS_LABELS = {
    draft: 'Draft',
    sent: 'Sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired',
  };

  const PROJECT_STATUSES = ['active', 'onHold', 'completed'];

  const PROJECT_STATUS_LABELS = {
    active: 'Active',
    onHold: 'On hold',
    completed: 'Completed',
  };

  const DEFAULT_SETTINGS = {
    businessName: 'Your Studio',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    quotePrefix: 'Q',
    currency: 'USD',
    taxRate: 0,
    taxLabel: 'Tax',
    defaultHourlyRate: 95,
    defaultCostRate: 30,
    defaultRushPercent: 0,
    quoteValidityDays: 30,
    paymentTerms: '50% on signature, 50% on delivery',
    bankDetails: '',
    targetMarginPercent: 55,
    accentColor: '#2f6f4f',
  };

  const DEFAULT_ITEM = {
    hours: 8,
    rate: 95,
    complexity: 1,
    rushPercent: 0,
    cost: 0,
  };

  /* ------------------------------------------------------------- primitives */

  function toNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function round2(value) {
    return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* ------------------------------------------------------------------ dates */

  /**
   * YYYY-MM-DD for a Date, in the reader's own calendar.
   *
   * `toISOString()` would answer in UTC, which silently shifts the date by a day
   * for anyone east of Greenwich — a quote issued "today" would say yesterday.
   * Everything user-facing in MarginDesk is local-date based on purpose.
   */
  function isoDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /** Today's date in the reader's timezone, as YYYY-MM-DD. */
  function todayIso() {
    return isoDate(new Date());
  }

  function parseIso(isoDate_) {
    const date = new Date(`${String(isoDate_).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sum(list, pick) {
    return round2((list ?? []).reduce((total, item) => total + toNumber(pick(item)), 0));
  }

  function normaliseItem(item, settings = DEFAULT_SETTINGS) {
    const source = item ?? {};
    return {
      id: source.id ?? null,
      description: source.description ?? '',
      detail: source.detail ?? '',
      hours: Math.max(0, toNumber(source.hours, DEFAULT_ITEM.hours)),
      rate: Math.max(0, toNumber(source.rate, settings.defaultHourlyRate)),
      complexity: Math.max(1, toNumber(source.complexity, 1)),
      rushPercent: Math.max(0, toNumber(source.rushPercent, 0)),
      cost: Math.max(0, toNumber(source.cost, 0)),
    };
  }

  /* ------------------------------------------------------------- line items */

  function lineTotals(item, settings = DEFAULT_SETTINGS) {
    const line = normaliseItem(item, settings);
    const baseAmount = round2(line.hours * line.rate);
    const complexityAmount = round2(baseAmount * (line.complexity - 1));
    const rushAmount = round2((baseAmount + complexityAmount) * (line.rushPercent / 100));
    const total = round2(baseAmount + complexityAmount + rushAmount);
    return {
      hours: round2(line.hours),
      rate: line.rate,
      complexity: line.complexity,
      rushPercent: line.rushPercent,
      baseAmount,
      complexityAmount,
      rushAmount,
      total,
      cost: round2(line.cost),
      profit: round2(total - line.cost),
      marginPercent:
        total > 0 ? round2(((total - line.cost) / total) * 100) : 0,
    };
  }

  /* ----------------------------------------------------------------- quotes */

  function quoteTotals(quote, settings = DEFAULT_SETTINGS) {
    const items = (quote?.lineItems ?? []).map((item) => normaliseItem(item, settings));
    const lines = items.map((item) => lineTotals(item, settings));

    const subtotal = round2(lines.reduce((total, line) => total + line.total, 0));
    const estimatedCost = round2(lines.reduce((total, line) => total + line.cost, 0));
    const totalHours = round2(lines.reduce((total, line) => total + line.hours, 0));

    const discount = quote?.discount ?? { type: 'percent', value: 0 };
    const discountValue = Math.max(0, toNumber(discount.value));
    const discountAmount =
      discount.type === 'fixed'
        ? round2(Math.min(discountValue, subtotal))
        : round2((subtotal * clamp(discountValue, 0, 100)) / 100);

    const taxable = round2(subtotal - discountAmount);
    const taxRate = Math.max(0, toNumber(quote?.taxRate ?? settings.taxRate));
    const taxAmount = round2((taxable * taxRate) / 100);
    const total = round2(taxable + taxAmount);

    const profit = round2(total - taxAmount - estimatedCost);
    return {
      lines,
      subtotal,
      discountAmount,
      discountLabel: discountAmount > 0 ? (discount.type ?? 'percent') : 'none',
      discountRate: discountAmount > 0 && discount.type !== 'fixed' ? round2(discountValue) : 0,
      taxable,
      taxRate,
      taxAmount,
      total,
      totalHours,
      estimatedCost,
      profit,
      marginPercent: total > 0 ? round2((profit / total) * 100) : 0,
      effectiveHourlyRate: totalHours > 0 ? round2(total / totalHours) : 0,
      belowTargetMargin:
        total > 0 && profit / total < (toNumber(settings.targetMarginPercent, 55) / 100),
    };
  }

  function quoteNumber(quote, settings = DEFAULT_SETTINGS, existing = []) {
    if (quote?.number) return quote.number;
    const prefix = settings.quotePrefix || 'Q';
    const year = (parseIso(quote?.issueDate) || new Date()).getFullYear();
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let highest = 0;
    for (const item of existing) {
      const match = pattern.exec(item?.number ?? '');
      if (match) highest = Math.max(highest, Number(match[1]));
    }
    return `${prefix}-${year}-${String(highest + 1).padStart(3, '0')}`;
  }

  function addDays(isoDate_, days) {
    const date = parseIso(isoDate_);
    if (!date) return isoDate_;
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }

  /** A quote is expired when it is past its validity date and still not decided. */
  function isQuoteExpired(quote, today = todayIso()) {
    if (!quote?.validUntil) return false;
    if (quote.status === 'accepted' || quote.status === 'declined') return false;
    return quote.validUntil < today;
  }

  function daysUntil(isoDate_, today = todayIso()) {
    const target = parseIso(isoDate_);
    const base = parseIso(today);
    if (!target || !base) return null;
    return Math.round((target.getTime() - base.getTime()) / 86400000);
  }

  function quoteExpiryStatus(quote, today = todayIso()) {
    if (!quote || quote.status !== 'sent') return 'none';
    const remaining = daysUntil(quote.validUntil, today);
    if (remaining === null) return 'none';
    if (remaining < 0) return 'expired';
    if (remaining <= 3) return 'urgent';
    return 'ok';
  }

  /* --------------------------------------------------------------- projects */

  function projectTotals(project, quote, settings = DEFAULT_SETTINGS) {
    const costRate = Math.max(0, toNumber(project?.costRate, settings.defaultCostRate));
    const entries = project?.timeEntries ?? [];
    const costs = project?.costs ?? [];

    const loggedHours = sum(entries, (entry) => entry.hours);
    const billableHours = sum(
      entries.filter((entry) => entry.billable !== false),
      (entry) => entry.hours,
    );
    const labourCost = round2(loggedHours * costRate);
    const directCosts = sum(costs, (cost) => cost.amount);

    const quotedTotals = quote ? quoteTotals(quote, settings) : null;
    const revenue = quotedTotals ? quotedTotals.total : 0;
    const estimatedHours = round2(
      toNumber(project?.budgetHours, quotedTotals ? quotedTotals.totalHours : 0),
    );
    const hourlyRate = Math.max(0, toNumber(project?.hourlyRate, quotedTotals?.lines?.[0]?.rate ?? settings.defaultHourlyRate));
    const billableAtRate = round2(billableHours * hourlyRate);

    const totalCost = round2(labourCost + directCosts);
    const profit = round2(revenue - totalCost);
    const marginPercent = revenue > 0 ? round2((profit / revenue) * 100) : 0;
    const effectiveHourlyRate = loggedHours > 0 ? round2(revenue / loggedHours) : 0;
    const realHourlyRate = loggedHours > 0 ? round2(profit / loggedHours) : 0;
    const hoursVariance = round2(loggedHours - estimatedHours);
    const progressPercent = estimatedHours > 0 ? clamp(Math.round((loggedHours / estimatedHours) * 100), 0, 999) : 0;

    return {
      revenue,
      estimatedHours,
      loggedHours,
      billableHours,
      nonBillableHours: round2(loggedHours - billableHours),
      labourCost,
      costRate,
      directCosts,
      totalCost,
      profit,
      marginPercent,
      effectiveHourlyRate,
      realHourlyRate,
      hourlyRate,
      billableAtRate,
      hoursVariance,
      progressPercent,
      overBudgetHours: hoursVariance > 0,
      underTargetMargin:
        revenue > 0 && marginPercent < toNumber(settings.targetMarginPercent, 55),
      hasTime: loggedHours > 0,
    };
  }

  /* ---------------------------------------------------------------- reports */

  function monthKey(isoDate) {
    return String(isoDate ?? '').slice(0, 7);
  }

  function lastMonths(count, reference = new Date()) {
    const months = [];
    const cursor = new Date(reference.getFullYear(), reference.getMonth(), 1);
    for (let i = count - 1; i >= 0; i -= 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  /** Revenue = accepted quotes grouped by the month they were accepted. */
  function revenueByMonth(quotes, settings, reference = new Date(), months = 6) {
    const keys = lastMonths(months, reference);
    const rows = keys.map((key) => ({ month: key, revenue: 0, cost: 0, profit: 0, quotes: 0 }));
    const index = new Map(rows.map((row) => [row.month, row]));

    for (const quote of quotes ?? []) {
      if (quote.status !== 'accepted') continue;
      const key = monthKey(quote.acceptedAt ?? quote.updatedAt ?? quote.issueDate);
      const row = index.get(key);
      if (!row) continue;
      const totals = quoteTotals(quote, settings);
      row.revenue = round2(row.revenue + totals.total);
      row.cost = round2(row.cost + totals.estimatedCost);
      row.quotes += 1;
    }
    for (const row of rows) row.profit = round2(row.revenue - row.cost);
    return rows;
  }

  function revenueByClient(quotes, clients, settings) {
    const rows = (clients ?? []).map((client) => ({
      clientId: client.id,
      name: client.company || client.name,
      revenue: 0,
      quotes: 0,
      lastActivity: null,
    }));
    const index = new Map(rows.map((row) => [row.clientId, row]));

    for (const quote of quotes ?? []) {
      if (quote.status !== 'accepted') continue;
      const row = index.get(quote.clientId);
      if (!row) continue;
      const totals = quoteTotals(quote, settings);
      row.revenue = round2(row.revenue + totals.total);
      row.quotes += 1;
      const stamp = quote.acceptedAt ?? quote.updatedAt ?? quote.issueDate;
      if (!row.lastActivity || stamp > row.lastActivity) row.lastActivity = stamp;
    }
    return rows.sort((a, b) => b.revenue - a.revenue);
  }

  function pipelineSummary(quotes, settings) {
    const rows = QUOTE_STATUSES.map((status) => ({ status, label: QUOTE_STATUS_LABELS[status], count: 0, value: 0 }));
    const index = new Map(rows.map((row) => [row.status, row]));
    for (const quote of quotes ?? []) {
      const row = index.get(quote.status);
      if (!row) continue;
      row.count += 1;
      row.value = round2(row.value + quoteTotals(quote, settings).total);
    }
    return rows;
  }

  function clientSummary(client, quotes, projects, settings) {
    const clientQuotes = quotes.filter((quote) => quote.clientId === client.id);
    const clientProjects = projects.filter((project) => project.clientId === client.id);
    const won = clientQuotes.filter((quote) => quote.status === 'accepted');
    const lost = clientQuotes.filter((quote) => quote.status === 'declined' || quote.status === 'expired');
    const decided = won.length + lost.length;
    const wonValue = sum(won, (quote) => quoteTotals(quote, settings).total);
    const lostValue = sum(lost, (quote) => quoteTotals(quote, settings).total);

    const projectTotalsList = clientProjects
      .filter((project) => project.status === 'completed')
      .map((project) => {
        const quote = clientQuotes.find((item) => item.id === project.quoteId);
        return projectTotals(project, quote, settings);
      });

    return {
      quotes: clientQuotes.length,
      won: won.length,
      lost: lost.length,
      winRate: decided > 0 ? round2((won.length / decided) * 100) : null,
      wonValue,
      lostValue,
      pipelineValue: sum(
        clientQuotes.filter((quote) => quote.status === 'sent' || quote.status === 'draft'),
        (quote) => quoteTotals(quote, settings).total,
      ),
      activeProjects: clientProjects.filter((project) => project.status === 'active').length,
      completedProjects: projectTotalsList.length,
      averageMargin: projectTotalsList.length
        ? round2(projectTotalsList.reduce((total, item) => total + item.marginPercent, 0) / projectTotalsList.length)
        : null,
      lifetimeValue: wonValue,
    };
  }

  /** Things the owner should act on today. */
  function attentionItems(data, today = todayIso()) {
    const { quotes = [], projects = [], settings = DEFAULT_SETTINGS } = data ?? {};
    const items = [];

    for (const quote of quotes) {
      if (quote.status !== 'sent') continue;
      const remaining = daysUntil(quote.validUntil, today);
      if (remaining !== null && remaining <= 3) {
        items.push({
          kind: remaining < 0 ? 'expired' : 'expiring',
          severity: remaining < 0 ? 'high' : 'medium',
          title: remaining < 0 ? `Quote ${quote.number} expired` : `Quote ${quote.number} expires in ${remaining} day${remaining === 1 ? '' : 's'}`,
          detail: quote.title,
          link: `#/quotes/${quote.id}`,
        });
      }
    }

    for (const project of projects) {
      if (project.status !== 'active') continue;
      const quote = quotes.find((item) => item.id === project.quoteId);
      const totals = projectTotals(project, quote, settings);
      if (totals.overBudgetHours && totals.progressPercent >= 100) {
        items.push({
          kind: 'overBudget',
          severity: 'high',
          title: `${project.name} is over the estimated hours`,
          detail: `${totals.loggedHours}h logged against ${totals.estimatedHours}h estimated`,
          link: `#/projects/${project.id}`,
        });
      } else if (totals.underTargetMargin && totals.hasTime) {
        items.push({
          kind: 'lowMargin',
          severity: 'medium',
          title: `${project.name} margin is ${totals.marginPercent}%`,
          detail: `Target is ${settings.targetMarginPercent}% — check the hours logged so far`,
          link: `#/projects/${project.id}`,
        });
      }
    }

    const order = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }

  /* -------------------------------------------------------------- formatting */

  const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', CHF: 'CHF ', SEK: 'kr ',
    NOK: 'kr ', DKK: 'kr ', JPY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$', ZAR: 'R',
    AED: 'AED ', PLN: 'zł ', CZK: 'Kč ', NZD: 'NZ$',
  };

  function currencySymbol(currency) {
    return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  }

  function formatMoney(value, currency = 'USD', options = {}) {
    const amount = toNumber(value);
    const symbol = currencySymbol(currency);
    const formatted = Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2,
    });
    return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
  }

  function formatPercent(value, decimals = 0) {
    const amount = toNumber(value);
    return `${amount.toFixed(decimals)}%`;
  }

  function formatHours(value) {
    const hours = toNumber(value);
    return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
  }

  function formatDate(isoDate_) {
    if (!isoDate_) return '—';
    const date = parseIso(isoDate_);
    if (!date) return '—';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return {
    COMPLEXITY_PRESETS,
    RUSH_PRESETS,
    QUOTE_STATUSES,
    QUOTE_STATUS_LABELS,
    PROJECT_STATUSES,
    PROJECT_STATUS_LABELS,
    DEFAULT_SETTINGS,
    DEFAULT_ITEM,
    toNumber,
    round2,
    clamp,
    isoDate,
    todayIso,
    sum,
    normaliseItem,
    lineTotals,
    quoteTotals,
    quoteNumber,
    addDays,
    isQuoteExpired,
    daysUntil,
    quoteExpiryStatus,
    projectTotals,
    monthKey,
    lastMonths,
    revenueByMonth,
    revenueByClient,
    pipelineSummary,
    clientSummary,
    attentionItems,
    currencySymbol,
    formatMoney,
    formatPercent,
    formatHours,
    formatDate,
  };
});
