/**
 * Reports — the numbers a freelancer actually looks at: where the money came
 * from, which clients are worth keeping, and whether the work was worth it.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  function render(ctx) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const quotes = store.quotes();
    const projects = store.projects();
    const clients = store.clients();
    const months = Number(ctx.query.months || 6);

    /* ------------------------------------------------------------- headline */

    const revenue = calc.sum(quotes.filter((quote) => quote.status === 'accepted'), (quote) => calc.quoteTotals(quote, settings).total);
    const pipeline = calc.sum(quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)), (quote) => calc.quoteTotals(quote, settings).total);
    const decided = quotes.filter((quote) => ['accepted', 'declined', 'expired'].includes(quote.status));
    const won = decided.filter((quote) => quote.status === 'accepted');
    const winRate = decided.length ? Math.round((won.length / decided.length) * 100) : null;
    const avgDeal = won.length ? revenue / won.length : 0;

    const projectRows = projects
      .map((project) => {
        const quote = quotes.find((item) => item.id === project.quoteId) || null;
        return { project, quote, totals: calc.projectTotals(project, quote, settings) };
      })
      .filter((row) => row.totals.revenue > 0);

    const totalProfit = calc.sum(projectRows, (row) => row.totals.profit);
    const totalHours = calc.sum(projectRows, (row) => row.totals.loggedHours);
    const totalHoursBilled = calc.sum(projectRows, (row) => row.totals.billableHours);
    const blendedMargin = revenue > 0 ? Math.round((totalProfit / revenue) * 100) : null;

    const kpis = h('div', { class: 'grid grid--kpi' }, [
      kpi('Revenue won', util.money(revenue, currency), `${won.length} accepted quote${won.length === 1 ? '' : 's'}`, 'good'),
      kpi('Open pipeline', util.money(pipeline, currency), `${quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).length} undecided`),
      kpi('Average deal', util.money(avgDeal, currency), winRate === null ? 'No decided quotes yet' : `Win rate ${winRate}%`),
      kpi('Blended margin', blendedMargin === null ? '—' : `${blendedMargin}%`, `Target ${settings.targetMarginPercent}%`, blendedMargin !== null && blendedMargin >= settings.targetMarginPercent ? 'good' : 'warn'),
      kpi('Billable ratio', totalHours > 0 ? `${Math.round((totalHoursBilled / totalHours) * 100)}%` : '—', totalHours > 0 ? `${util.hours(totalHoursBilled)} billable of ${util.hours(totalHours)}` : 'No time logged'),
    ]);

    /* -------------------------------------------------------------- monthly */

    const monthRows = calc.revenueByMonth(quotes, settings, new Date(), months);
    const maxRevenue = Math.max(...monthRows.map((row) => row.revenue), 1);
    const monthlyCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Revenue by month' }), h('p', { text: 'Counted when a quote is accepted' })]),
        h('div', { class: 'btn-row' }, [
          ...[3, 6, 12].map((count) =>
            h('a', { class: `btn btn--sm ${count === months ? 'btn--primary' : 'btn--ghost'}`, href: `#/reports?months=${count}`, text: `${count}m` }),
          ),
        ]),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'chart', style: 'height:190px' }, monthRows.map((row) =>
          h('div', { class: 'chart__col' }, [
            h('span', { class: 'chart__value', text: row.revenue > 0 ? util.money(row.revenue, currency, { decimals: 0 }) : '' }),
            h('div', {
              class: `chart__bar${row.revenue > 0 ? '' : ' is-muted'}`,
              style: `height:${Math.max(3, Math.round((row.revenue / maxRevenue) * 140))}px`,
              title: `${row.month}: ${util.money(row.revenue, currency)} revenue · ${util.money(row.profit, currency)} profit`,
            }),
            h('span', { class: 'chart__label', text: row.month.slice(5) }),
          ]),
        )),
        h('div', { class: 'table-wrap', style: 'margin-top:18px' }, [
          h('table', { class: 'data' }, [
            h('thead', {}, [h('tr', {}, [h('th', { text: 'Month' }), h('th', { class: 'num', text: 'Quotes' }), h('th', { class: 'num', text: 'Revenue' }), h('th', { class: 'num', text: 'Est. cost' }), h('th', { class: 'num', text: 'Profit' }), h('th', { class: 'num', text: 'Margin' })])]),
            h('tbody', {}, monthRows.map((row) =>
              h('tr', {}, [
                h('td', { class: 'mono', text: row.month }),
                h('td', { class: 'num', text: String(row.quotes) }),
                h('td', { class: 'num cell-strong', text: util.money(row.revenue, currency) }),
                h('td', { class: 'num', text: util.money(row.cost, currency) }),
                h('td', { class: 'num', text: util.money(row.profit, currency) }),
                h('td', { class: 'num' }, [row.revenue > 0 ? util.marginBadge(Math.round((row.profit / row.revenue) * 100), currency, settings.targetMarginPercent) : h('span', { class: 'dim', text: '—' })]),
              ]),
            )),
          ]),
        ]),
      ]),
    ]);

    /* -------------------------------------------------------------- clients */

    const clientRows = calc.revenueByClient(quotes, clients, settings);
    const clientCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Revenue by client' }), h('p', { text: 'Who is actually paying you' })])]),
      clientRows.some((row) => row.revenue > 0)
        ? h('div', { class: 'table-wrap' }, [
            h('table', { class: 'data' }, [
              h('thead', {}, [h('tr', {}, [h('th', { text: 'Client' }), h('th', { class: 'num', text: 'Won quotes' }), h('th', { class: 'num', text: 'Revenue' }), h('th', { class: 'num', text: 'Share' }), h('th', { class: 'num', text: 'Last won' })])]),
              h('tbody', {}, clientRows.map((row) =>
                h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/clients/${row.clientId}`) }, [
                  h('td', { class: 'cell-strong', text: row.name }),
                  h('td', { class: 'num', text: String(row.quotes) }),
                  h('td', { class: 'num', text: util.money(row.revenue, currency) }),
                  h('td', { class: 'num' }, [
                    h('div', { class: 'row', style: 'gap:8px;flex-wrap:nowrap;justify-content:flex-end' }, [
                      h('div', { class: 'progress', style: 'width:70px' }, [h('div', { class: 'progress__bar', style: `width:${revenue > 0 ? Math.round((row.revenue / revenue) * 100) : 0}%` })]),
                      h('span', { text: revenue > 0 ? `${Math.round((row.revenue / revenue) * 100)}%` : '0%' }),
                    ]),
                  ]),
                  h('td', { class: 'num', text: row.lastActivity ? util.date(row.lastActivity) : '—' }),
                ]),
              )),
            ]),
          ])
        : h('div', { class: 'empty' }, [h('p', { text: 'No accepted quotes yet, so there is no client revenue to show.' })]),
    ]);

    /* ---------------------------------------------------------- profitability */

    const projectCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Project profitability' }), h('p', { text: 'Revenue against the hours and money the work really cost' })]),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: 'Export CSV', onclick: () => exportCsv(ctx, projectRows, currency) }),
      ]),
      projectRows.length
        ? h('div', { class: 'table-wrap' }, [
            h('table', { class: 'data' }, [
              h('thead', {}, [
                h('tr', {}, [
                  h('th', { text: 'Project' }),
                  h('th', { text: 'Status' }),
                  h('th', { class: 'num', text: 'Revenue' }),
                  h('th', { class: 'num', text: 'Est. hours' }),
                  h('th', { class: 'num', text: 'Logged' }),
                  h('th', { class: 'num', text: 'Variance' }),
                  h('th', { class: 'num', text: 'Profit' }),
                  h('th', { class: 'num', text: 'Margin' }),
                  h('th', { class: 'num', text: 'Real rate' }),
                ]),
              ]),
              h('tbody', {}, projectRows.map((row) =>
                h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/projects/${row.project.id}`) }, [
                  h('td', {}, [h('span', { class: 'cell-strong', text: row.project.name }), h('span', { class: 'cell-sub', text: store.clientName(row.project.clientId) })]),
                  h('td', {}, [util.statusBadge(row.project.status, calc.PROJECT_STATUS_LABELS[row.project.status])]),
                  h('td', { class: 'num', text: util.money(row.totals.revenue, currency) }),
                  h('td', { class: 'num', text: util.hours(row.totals.estimatedHours) }),
                  h('td', { class: 'num', text: util.hours(row.totals.loggedHours) }),
                  h('td', { class: 'num' }, [
                    h('span', { class: row.totals.hoursVariance > 0 ? 'badge badge--bad' : 'badge badge--good', text: `${row.totals.hoursVariance > 0 ? '+' : ''}${util.hours(row.totals.hoursVariance)}` }),
                  ]),
                  h('td', { class: 'num cell-strong', text: util.money(row.totals.profit, currency) }),
                  h('td', { class: 'num' }, [util.marginBadge(row.totals.marginPercent, currency, settings.targetMarginPercent)]),
                  h('td', { class: 'num', text: row.totals.hasTime ? `${util.money(row.totals.realHourlyRate, currency, { decimals: 0 })}/h` : '—' }),
                ]),
              )),
              h('tfoot', {}, [
                h('tr', {}, [
                  h('th', { colspan: '2', text: 'Total' }),
                  h('th', { class: 'num', text: util.money(calc.sum(projectRows, (row) => row.totals.revenue), currency) }),
                  h('th', { class: 'num', text: util.hours(calc.sum(projectRows, (row) => row.totals.estimatedHours)) }),
                  h('th', { class: 'num', text: util.hours(calc.sum(projectRows, (row) => row.totals.loggedHours)) }),
                  h('th', {}),
                  h('th', { class: 'num', text: util.money(totalProfit, currency) }),
                  h('th', { class: 'num', text: blendedMargin === null ? '—' : util.percent(blendedMargin) }),
                  h('th', { class: 'num', text: totalHours > 0 ? `${util.money(totalProfit / totalHours, currency, { decimals: 0 })}/h` : '—' }),
                ]),
              ]),
            ]),
          ])
        : h('div', { class: 'empty' }, [
            h('h3', { text: 'No project has revenue yet' }),
            h('p', { text: 'Accept a quote and start a project, then log time. This table fills in with real profit and real hourly rate.' }),
          ]),
    ]);

    return {
      title: 'Reports',
      subtitle: `${util.money(revenue, currency)} won · ${util.money(pipeline, currency)} in pipeline`,
      actions: [
        h('button', { class: 'btn btn--ghost', type: 'button', text: 'Print report', onclick: () => ctx.printDocument(buildReport(ctx, settings, currency, monthRows, projectRows, revenue, totalProfit, blendedMargin, totalHours), 'MarginDesk report') }),
      ],
      content: h('div', { class: 'stack' }, [kpis, monthlyCard, h('div', { class: 'grid grid--2' }, [clientCard]), projectCard]),
    };
  }

  function kpi(label, value, hint, tone) {
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { class: `kpi__value${tone ? ` is-${tone}` : ''}`, style: 'font-size:21px', text: value }),
      hint ? h('div', { class: 'kpi__hint', text: hint }) : null,
    ]);
  }

  function buildReport(ctx, settings, currency, monthRows, projectRows, revenue, profit, margin, hours) {
    const rows = [
      h('tr', {}, [h('th', { text: 'Month' }), h('th', { class: 'num', text: 'Quotes' }), h('th', { class: 'num', text: 'Revenue' }), h('th', { class: 'num', text: 'Profit' })]),
      ...monthRows.map((row) => h('tr', {}, [h('td', { text: row.month }), h('td', { class: 'num', text: String(row.quotes) }), h('td', { class: 'num', text: util.money(row.revenue, currency) }), h('td', { class: 'num', text: util.money(row.profit, currency) })])),
    ];

    return h('article', { class: 'doc' }, [
      h('div', { class: 'doc__head' }, [
        h('div', { class: 'doc__brand' }, [
          h('h1', { text: `${settings.businessName} — profitability report` }),
          h('p', { text: `Prepared ${util.date(util.todayIso())}` }),
        ]),
        h('div', { class: 'doc__meta' }, [h('h2', { text: 'Summary' }), h('div', { text: `${util.money(revenue, currency)} revenue · ${util.money(profit, currency)} profit` })]),
      ]),
      h('div', { class: 'grid grid--3', style: 'margin-bottom:20px' }, [
        h('div', {}, [h('div', { class: 'kpi__label', text: 'Blended margin' }), h('div', { style: 'font-size:18px;font-weight:650', text: margin === null ? '—' : util.percent(margin) })]),
        h('div', {}, [h('div', { class: 'kpi__label', text: 'Hours logged' }), h('div', { style: 'font-size:18px;font-weight:650', text: util.hours(hours) })]),
        h('div', {}, [h('div', { class: 'kpi__label', text: 'Real hourly rate' }), h('div', { style: 'font-size:18px;font-weight:650', text: hours > 0 ? util.money(profit / hours, currency, { decimals: 0 }) : '—' })]),
      ]),
      h('table', { class: 'doc-table' }, [h('tbody', {}, rows)]),
      h('div', { class: 'doc__notes', text: 'Figures come from quotes marked accepted and from time logged on projects. No data leaves this computer.' }),
    ]);
  }

  function exportCsv(ctx, projectRows, currency) {
    const lines = [['project', 'client', 'status', 'revenue', 'estimated_hours', 'logged_hours', 'variance_hours', 'labour_cost', 'direct_costs', 'profit', 'margin_percent', 'real_hourly_rate']];
    for (const row of projectRows) {
      lines.push([
        row.project.name,
        ctx.store.clientName(row.project.clientId),
        row.project.status,
        row.totals.revenue,
        row.totals.estimatedHours,
        row.totals.loggedHours,
        row.totals.hoursVariance,
        row.totals.labourCost,
        row.totals.directCosts,
        row.totals.profit,
        row.totals.marginPercent,
        row.totals.realHourlyRate,
      ]);
    }
    util.downloadFile(`margindesk-projects-${util.todayIso()}.csv`, lines.map((line) => line.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
    ctx.toast(`Exported ${projectRows.length} project row${projectRows.length === 1 ? '' : 's'} (${currency})`, 'success');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  root.MarginDesk.views = root.MarginDesk.views || {};
  root.MarginDesk.views.reports = { title: 'Reports', render };
})(typeof self !== 'undefined' ? self : this);
