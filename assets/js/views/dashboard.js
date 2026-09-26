/**
 * Dashboard — the answer to "how is the business doing, and what needs me today?"
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  function kpi(label, value, hint, tone) {
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { class: `kpi__value${tone ? ` is-${tone}` : ''}`, text: value }),
      hint ? h('div', { class: 'kpi__hint', text: hint }) : null,
    ]);
  }

  function render(ctx) {
    const { store, navigate } = ctx;
    const settings = store.getSettings();
    const quotes = store.quotes();
    const projects = store.projects();
    const clients = store.clients();
    const currency = settings.currency;
    const today = util.todayIso();

    /* ---------------------------------------------------------- headline KPIs */

    const ninetyDaysAgo = (() => {
      const date = new Date();
      date.setDate(date.getDate() - 90);
      return date.toISOString().slice(0, 10);
    })();

    const wonRecently = quotes.filter(
      (quote) => quote.status === 'accepted' && String(quote.acceptedAt ?? quote.issueDate).slice(0, 10) >= ninetyDaysAgo,
    );
    const wonValue = calc.sum(wonRecently, (quote) => calc.quoteTotals(quote, settings).total);

    const openQuotes = quotes.filter((quote) => quote.status === 'sent' || quote.status === 'draft');
    const pipelineValue = calc.sum(openQuotes, (quote) => calc.quoteTotals(quote, settings).total);

    const decided = quotes.filter((quote) => ['accepted', 'declined', 'expired'].includes(quote.status));
    const won = decided.filter((quote) => quote.status === 'accepted');
    const winRate = decided.length > 0 ? Math.round((won.length / decided.length) * 100) : null;

    const completedOrActive = projects.filter((project) => project.status !== 'onHold');
    const projectTotals = completedOrActive
      .map((project) => calc.projectTotals(project, quotes.find((quote) => quote.id === project.quoteId), settings))
      .filter((totals) => totals.revenue > 0);
    const totalRevenue = calc.sum(projectTotals, (item) => item.revenue);
    const totalProfit = calc.sum(projectTotals, (item) => item.profit);
    const blendedMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : null;
    const totalHours = calc.sum(projectTotals, (item) => item.loggedHours);
    const realRate = totalHours > 0 ? totalProfit / totalHours : null;

    const activeProjects = projects.filter((project) => project.status === 'active');
    const activeRevenue = calc.sum(
      activeProjects,
      (project) => calc.projectTotals(project, quotes.find((quote) => quote.id === project.quoteId), settings).revenue,
    );

    const kpis = h('div', { class: 'grid grid--kpi' }, [
      kpi('Won, last 90 days', util.money(wonValue, currency), `${wonRecently.length} accepted quote${wonRecently.length === 1 ? '' : 's'}`),
      kpi('Open pipeline', util.money(pipelineValue, currency), `${openQuotes.length} quote${openQuotes.length === 1 ? '' : 's'} not yet decided`),
      kpi('Win rate', winRate === null ? '—' : `${winRate}%`, `${won.length} won of ${decided.length} decided`, winRate !== null && winRate < 50 ? 'warn' : winRate !== null && winRate >= 65 ? 'good' : null),
      kpi('Blended margin', blendedMargin === null ? '—' : `${blendedMargin}%`, `Target ${settings.targetMarginPercent}%`, blendedMargin === null ? null : blendedMargin >= settings.targetMarginPercent ? 'good' : blendedMargin >= 35 ? 'warn' : 'bad'),
      kpi('Real hourly rate', realRate === null ? '—' : util.money(realRate, currency, { decimals: 0 }), 'Profit ÷ hours actually logged'),
    ]);

    /* ------------------------------------------------------------- attention */

    const attention = calc.attentionItems({ quotes, projects, settings }, today);
    const attentionCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Needs attention' }), h('p', { text: 'Quotes expiring and projects drifting over estimate' })]),
        attention.length > 0 ? h('span', { class: 'badge badge--warn', text: `${attention.length} item${attention.length === 1 ? '' : 's'}` }) : null,
      ]),
      attention.length === 0
        ? h('div', { class: 'empty' }, [
            h('h3', { text: 'Nothing is on fire' }),
            h('p', { text: 'No quotes are about to expire and every active project is still inside its estimate.' }),
          ])
        : h(
            'ul',
            { class: 'list' },
            attention.slice(0, 6).map((item) =>
              h('li', { class: 'list__item' }, [
                h('span', { class: `list__icon${item.severity === 'high' ? ' is-bad' : ' is-warn'}`, text: item.severity === 'high' ? '!' : '•' }),
                h('div', { class: 'list__body' }, [
                  h('a', { class: 'list__title', href: item.link, text: item.title }),
                  h('div', { class: 'list__meta', text: item.detail }),
                ]),
                h('a', { class: 'btn btn--ghost btn--sm', href: item.link, text: 'Open' }),
              ]),
            ),
          ),
    ]);

    /* -------------------------------------------------------------- pipeline */

    const pipeline = calc.pipelineSummary(quotes, settings);
    const pipelineTotal = calc.sum(pipeline, (row) => row.value) || 1;
    const pipelineCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Quote pipeline' }), h('p', { text: `${quotes.length} quote${quotes.length === 1 ? '' : 's'} on record` })]),
        h('a', { class: 'btn btn--ghost btn--sm', href: '#/quotes', text: 'All quotes' }),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'progress', style: 'height:10px' }, [
          ...pipeline
            .filter((row) => row.value > 0)
            .map((row) =>
              h('div', {
                class: 'progress__bar',
                style: `width:${(row.value / pipelineTotal) * 100}%;background:${pipelineColor(row.status)}`,
                title: `${row.label}: ${util.money(row.value, currency)}`,
              }),
            ),
        ]),
        h(
          'div',
          { class: 'grid grid--3', style: 'margin-top:14px' },
          pipeline.map((row) =>
            h('div', {}, [
              h('div', { class: 'row', style: 'gap:6px' }, [
                util.statusBadge(row.status, row.label),
                h('span', { class: 'dim', text: `×${row.count}` }),
              ]),
              h('div', { style: 'font-weight:600;margin-top:2px', text: util.money(row.value, currency) }),
            ]),
          ),
        ),
      ]),
    ]);

    function pipelineColor(status) {
      return {
        draft: 'var(--border-strong)',
        sent: 'var(--info)',
        accepted: 'var(--good)',
        declined: 'var(--bad)',
        expired: 'var(--warn)',
      }[status];
    }

    /* -------------------------------------------------------- revenue chart */

    const months = calc.revenueByMonth(quotes, settings, new Date(), 6);
    const maxRevenue = Math.max(...months.map((row) => row.revenue), 1);
    const chartCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Accepted revenue' }), h('p', { text: 'By the month each quote was accepted' })]),
        h('a', { class: 'btn btn--ghost btn--sm', href: '#/reports', text: 'Full report' }),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'chart' }, months.map((row) =>
          h('div', { class: 'chart__col' }, [
            h('span', { class: 'chart__value', text: row.revenue > 0 ? util.money(row.revenue, currency, { decimals: 0 }) : '' }),
            h('div', {
              class: `chart__bar${row.revenue > 0 ? '' : ' is-muted'}`,
              style: `height:${Math.max(3, Math.round((row.revenue / maxRevenue) * 118))}px`,
              title: `${row.month}: ${util.money(row.revenue, currency)}`,
            }),
            h('span', { class: 'chart__label', text: monthLabel(row.month) }),
          ]),
        )),
      ]),
    ]);

    /* -------------------------------------------------------------- activity */

    const activity = buildActivity(quotes, projects);
    const activityCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Recent activity' })])]),
      h(
        'ul',
        { class: 'list' },
        activity.map((item) =>
          h('li', { class: 'list__item' }, [
            h('span', { class: 'list__icon', text: item.icon }),
            h('div', { class: 'list__body' }, [
              h('a', { class: 'list__title', href: item.link, text: item.title }),
              h('div', { class: 'list__meta', text: item.meta }),
            ]),
          ]),
        ),
      ),
    ]);

    return {
      title: 'Dashboard',
      subtitle: `${settings.businessName} · ${clients.length} client${clients.length === 1 ? '' : 's'} · ${activeProjects.length} active project${activeProjects.length === 1 ? '' : 's'} worth ${util.money(activeRevenue, currency)}`,
      actions: [
        h('a', { class: 'btn btn--ghost', href: '#/reports', text: 'Reports' }),
        h('a', { class: 'btn btn--primary', href: '#/quotes/new', text: '+ New quote' }),
      ],
      content: h('div', { class: 'stack' }, [kpis, h('div', { class: 'grid grid--2' }, [attentionCard, pipelineCard]), h('div', { class: 'grid grid--2' }, [chartCard, activityCard])]),
    };
  }

  function monthLabel(key) {
    const date = new Date(`${key}-01T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short' });
  }

  function buildActivity(quotes, projects) {
    const items = [];
    for (const quote of quotes) {
      items.push({
        stamp: quote.updatedAt || quote.createdAt,
        icon: 'Q',
        title: `Quote ${quote.number} — ${quote.title}`,
        meta: `${calc.QUOTE_STATUS_LABELS[quote.status] || quote.status}`,
        link: `#/quotes/${quote.id}`,
      });
    }
    for (const project of projects) {
      items.push({
        stamp: project.updatedAt || project.createdAt,
        icon: 'P',
        title: `Project ${project.name}`,
        meta: `${calc.PROJECT_STATUS_LABELS[project.status] || project.status}`,
        link: `#/projects/${project.id}`,
      });
    }
    return items
      .filter((item) => item.stamp)
      .sort((a, b) => String(b.stamp).localeCompare(String(a.stamp)))
      .slice(0, 6);
  }

  root.MarginDesk = root.MarginDesk || {};
  root.MarginDesk.views = root.MarginDesk.views || {};
  root.MarginDesk.views.dashboard = { render, title: 'Dashboard' };
})(typeof self !== 'undefined' ? self : this);
