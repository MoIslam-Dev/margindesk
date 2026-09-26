/**
 * Projects — where a quote turns into hours, costs and the profit you keep.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  /* ------------------------------------------------------------- list view */

  function list(ctx) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const all = store.projects();
    const quotes = store.quotes();
    const status = ctx.query.status || '';
    const search = (ctx.query.search || '').toLowerCase();

    const rows = all
      .filter((project) => (status ? project.status === status : true))
      .filter((project) => !search || [project.name, store.clientName(project.clientId)].join(' ').toLowerCase().includes(search));

    const totalRevenue = calc.sum(all, (project) => calc.projectTotals(project, quotes.find((quote) => quote.id === project.quoteId), settings).revenue);
    const totalProfit = calc.sum(all, (project) => calc.projectTotals(project, quotes.find((quote) => quote.id === project.quoteId), settings).profit);

    const filters = h('div', { class: 'pill-row' }, [{ value: '', label: `All (${all.length})` }, ...calc.PROJECT_STATUSES.map((item) => ({ value: item, label: `${calc.PROJECT_STATUS_LABELS[item]} (${all.filter((project) => project.status === item).length})` }))].map((filter) =>
      h('button', {
        class: `btn btn--sm${status === filter.value ? ' btn--primary' : ' btn--ghost'}`,
        type: 'button',
        text: filter.label,
        onclick: () => ctx.navigate(`#/projects?status=${filter.value}`),
      }),
    ));

    const table = h('div', { class: 'table-wrap' }, [
      h('table', { class: 'data' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', { text: 'Project' }),
            h('th', { text: 'Status' }),
            h('th', { text: 'Hours' }),
            h('th', { class: 'num', text: 'Revenue' }),
            h('th', { class: 'num', text: 'Cost' }),
            h('th', { class: 'num', text: 'Profit' }),
            h('th', { class: 'num', text: 'Margin' }),
            h('th', { class: 'num', text: 'Real rate' }),
            h('th', { class: 'num', text: '' }),
          ]),
        ]),
        rows.length
          ? h('tbody', {}, rows.map((project) => projectRow(ctx, project, quotes, settings, currency)))
          : h('tbody', {}, [
              h('tr', {}, [
                h('td', { colspan: '9' }, [
                  h('div', { class: 'empty' }, [
                    h('h3', { text: all.length ? 'No projects match that filter' : 'No projects yet' }),
                    h('p', {
                      text: all.length
                        ? 'Try another status.'
                        : 'When a quote is accepted, press "Start project" on it — the hours you estimated become the budget, then log time against it.',
                    }),
                    all.length ? null : h('a', { class: 'btn btn--primary', href: '#/projects/new', text: '+ New project' }),
                  ]),
                ]),
              ]),
            ]),
      ]),
    ]);

    return {
      title: 'Projects',
      subtitle: `${all.length} project${all.length === 1 ? '' : 's'} · ${util.money(totalRevenue, currency)} revenue · ${util.money(totalProfit, currency)} profit`,
      actions: [h('a', { class: 'btn btn--primary', href: '#/projects/new', text: '+ New project' })],
      content: h('div', { class: 'stack' }, [
        h('div', { class: 'toolbar' }, [
          h('div', { class: 'field toolbar__search' }, [
            h('input', {
              type: 'search',
              placeholder: 'Search project or client…',
              'data-focus-key': 'projects-search',
              value: ctx.query.search || '',
              oninput: util.debounce((event) => ctx.navigate(`#/projects?status=${status}&search=${encodeURIComponent(event.target.value)}`, { replace: true }), 260),
            }),
          ]),
          filters,
        ]),
        h('section', { class: 'card' }, [table]),
      ]),
    };
  }

  function projectRow(ctx, project, quotes, settings, currency) {
    const quote = quotes.find((item) => item.id === project.quoteId);
    const totals = calc.projectTotals(project, quote, settings);
    const barClass = totals.overBudgetHours ? 'is-over' : '';
    return h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/projects/${project.id}`) }, [
      h('td', {}, [
        h('div', { class: 'cell-strong', text: project.name }),
        h('span', { class: 'cell-sub', text: `${ctx.store.clientName(project.clientId)} · due ${util.date(project.dueDate)}` }),
      ]),
      h('td', {}, [util.statusBadge(project.status, calc.PROJECT_STATUS_LABELS[project.status])]),
      h('td', {}, [
        h('div', { class: 'row', style: 'gap:8px;flex-wrap:nowrap' }, [
          h('div', { class: 'progress', style: 'flex:1' }, [h('div', { class: `progress__bar ${barClass}`, style: `width:${Math.min(100, totals.progressPercent)}%` })]),
          h('span', { class: 'nowrap', text: `${util.hours(totals.loggedHours)}/${util.hours(totals.estimatedHours)}` }),
        ]),
      ]),
      h('td', { class: 'num', text: util.money(totals.revenue, currency) }),
      h('td', { class: 'num', text: util.money(totals.totalCost, currency) }),
      h('td', { class: 'num cell-strong', text: util.money(totals.profit, currency) }),
      h('td', { class: 'num' }, [util.marginBadge(totals.marginPercent, currency, settings.targetMarginPercent)]),
      h('td', { class: 'num', text: totals.hasTime ? `${util.money(totals.realHourlyRate, currency, { decimals: 0 })}/h` : '—' }),
      h('td', { class: 'num' }, [
        h('button', {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          text: 'Open',
          onclick: (event) => {
            event.stopPropagation();
            ctx.navigate(`#/projects/${project.id}`);
          },
        }),
      ]),
    ]);
  }

  /* ----------------------------------------------------------- detail view */

  function detail(ctx, id) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const project = store.project(id);

    if (!project) {
      return {
        title: 'Project not found',
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'That project no longer exists' }),
            h('p', { text: 'It may have been deleted.' }),
            h('a', { class: 'btn btn--primary', href: '#/projects', text: 'Back to projects' }),
          ]),
        ]),
      };
    }

    const quote = store.quotes().find((item) => item.id === project.quoteId) || null;
    const totals = calc.projectTotals(project, quote, settings);

    const kpis = h('div', { class: 'grid grid--kpi' }, [
      kpi('Revenue', util.money(totals.revenue, currency), quote ? `From quote ${quote.number}` : 'No linked quote'),
      kpi('Cost to you', util.money(totals.totalCost, currency), `${util.money(totals.costRate, currency, { decimals: 0 })}/h × ${util.hours(totals.loggedHours)} + ${util.money(totals.directCosts, currency)} expenses`),
      kpi('Profit', util.money(totals.profit, currency), totals.revenue > 0 ? `${util.percent(totals.marginPercent)} margin` : '—', totals.underTargetMargin ? 'warn' : 'good'),
      kpi('Real hourly rate', totals.hasTime ? util.money(totals.realHourlyRate, currency, { decimals: 0 }) : '—', totals.hourlyRate > 0 ? `Quoted at ${util.money(totals.hourlyRate, currency, { decimals: 0 })}/h` : '—'),
      kpi('Hours used', `${util.hours(totals.loggedHours)} / ${util.hours(totals.estimatedHours)}`, totals.hoursVariance > 0 ? `${util.hours(totals.hoursVariance)} over estimate` : `${util.hours(Math.abs(totals.hoursVariance))} left`, totals.overBudgetHours ? 'bad' : null),
    ]);

    const statusActions = calc.PROJECT_STATUSES
      .filter((item) => item !== project.status)
      .map((item) =>
        h('button', {
          class: 'btn btn--sm btn--ghost',
          type: 'button',
          text: `Mark ${calc.PROJECT_STATUS_LABELS[item].toLowerCase()}`,
          onclick: () => {
            store.updateProject(project.id, { status: item });
            ctx.toast(`Project marked ${calc.PROJECT_STATUS_LABELS[item].toLowerCase()}`, 'success');
            ctx.refresh();
          },
        }),
      );

    const header = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [
          h('h2', { text: project.name }),
          h('p', { text: `${store.clientName(project.clientId)} · ${util.date(project.startDate)} → ${util.date(project.dueDate)}` }),
        ]),
        h('div', { class: 'btn-row' }, statusActions),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'progress' }, [h('div', { class: `progress__bar${totals.overBudgetHours ? ' is-over' : ''}`, style: `width:${Math.min(100, totals.progressPercent)}%` })]),
        h('div', { class: 'row row--between', style: 'margin-top:6px;font-size:12.5px;color:var(--text-muted)' }, [
          h('span', { text: `${util.hours(totals.loggedHours)} of ${util.hours(totals.estimatedHours)} estimated (${totals.progressPercent}%)` }),
          h('span', { text: totals.billableHours < totals.loggedHours ? `${util.hours(totals.nonBillableHours)} non-billable` : 'All time billable' }),
        ]),
        totals.overBudgetHours
          ? h('div', { class: 'callout callout--bad', style: 'margin-top:12px', text: `You are ${util.hours(totals.hoursVariance)} over the estimate. Raise the price, cut scope or log the overrun so the profit stays honest.` })
          : null,
        totals.underTargetMargin && totals.hasTime
          ? h('div', { class: 'callout callout--warn', style: 'margin-top:12px', text: `Margin is ${util.percent(totals.marginPercent)} against a ${settings.targetMarginPercent}% target. Your real hourly rate is ${util.money(totals.realHourlyRate, currency, { decimals: 0 })}.` })
          : null,
        project.notes ? h('div', { class: 'callout', style: 'margin-top:12px', text: project.notes }) : null,
      ]),
    ]);

    const timeCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Time' }), h('p', { text: `${util.hours(totals.loggedHours)} logged · ${util.hours(totals.nonBillableHours)} non-billable` })]),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '+ Log time', onclick: () => openTimeForm(ctx, project) }),
      ]),
      project.timeEntries.length
        ? h('div', { class: 'table-wrap' }, [
            h('table', { class: 'data' }, [
              h('thead', {}, [h('tr', {}, [h('th', { text: 'Date' }), h('th', { text: 'Note' }), h('th', { text: 'Type' }), h('th', { class: 'num', text: 'Hours' }), h('th', { class: 'num', text: '' })])]),
              h('tbody', {}, project.timeEntries.map((entry) =>
                h('tr', {}, [
                  h('td', { class: 'nowrap', text: util.date(entry.date) }),
                  h('td', { text: entry.note || '—' }),
                  h('td', {}, [h('span', { class: `badge badge--${entry.billable === false ? 'muted' : 'info'}`, text: entry.billable === false ? 'Internal' : 'Billable' })]),
                  h('td', { class: 'num cell-strong', text: util.hours(entry.hours) }),
                  h('td', { class: 'num' }, [
                    h('button', {
                      class: 'icon-btn',
                      type: 'button',
                      title: 'Remove entry',
                      text: '×',
                      onclick: () => {
                        store.removeTimeEntry(project.id, entry.id);
                        ctx.toast('Time entry removed');
                        ctx.refresh();
                      },
                    }),
                  ]),
                ]),
              )),
            ]),
          ])
        : h('div', { class: 'empty' }, [
            h('h3', { text: 'No time logged yet' }),
            h('p', { text: 'Logging hours is what turns a quote into a real number. Two minutes after each work session is enough.' }),
            h('button', { class: 'btn btn--primary', type: 'button', text: '+ Log time', onclick: () => openTimeForm(ctx, project) }),
          ]),
    ]);

    const costCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [h('h2', { text: 'Direct costs' }), h('p', { text: `${util.money(totals.directCosts, currency)} spent` })]),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '+ Add cost', onclick: () => openCostForm(ctx, project) }),
      ]),
      project.costs.length
        ? h('div', { class: 'table-wrap' }, [
            h('table', { class: 'data' }, [
              h('thead', {}, [h('tr', {}, [h('th', { text: 'Date' }), h('th', { text: 'Label' }), h('th', { class: 'num', text: 'Amount' }), h('th', { class: 'num', text: '' })])]),
              h('tbody', {}, project.costs.map((cost) =>
                h('tr', {}, [
                  h('td', { class: 'nowrap', text: util.date(cost.date) }),
                  h('td', { text: cost.label || 'Expense' }),
                  h('td', { class: 'num cell-strong', text: util.money(cost.amount, currency) }),
                  h('td', { class: 'num' }, [
                    h('button', {
                      class: 'icon-btn',
                      type: 'button',
                      title: 'Remove cost',
                      text: '×',
                      onclick: () => {
                        store.removeCost(project.id, cost.id);
                        ctx.toast('Cost removed');
                        ctx.refresh();
                      },
                    }),
                  ]),
                ]),
              )),
            ]),
          ])
        : h('div', { class: 'empty' }, [h('p', { text: 'No out-of-pocket costs logged. Stock, print, plugins, fonts — anything you paid for.' })]),
    ]);

    return {
      title: project.name,
      subtitle: `${store.clientName(project.clientId)} · ${util.money(totals.profit, currency)} profit · ${util.hours(totals.loggedHours)} logged`,
      actions: [
        h('a', { class: 'btn btn--ghost', href: '#/projects', text: '← All projects' }),
        quote ? h('a', { class: 'btn btn--ghost', href: `#/quotes/${quote.id}`, text: `View quote ${quote.number}` }) : null,
        h('a', { class: 'btn btn--primary', href: `#/projects/${project.id}/edit`, text: 'Edit' }),
      ],
      content: h('div', { class: 'stack' }, [
        kpis,
        header,
        h('div', { class: 'grid grid--2' }, [timeCard, costCard]),
        h('section', { class: 'card' }, [
          h('div', { class: 'card__head' }, [
            h('div', {}, [h('h2', { text: 'Danger zone' })]),
            h('button', {
              class: 'btn btn--danger btn--sm',
              type: 'button',
              text: 'Delete project',
              onclick: () =>
                ctx.confirmDialog({
                  title: `Delete ${project.name}?`,
                  message: 'The project and its logged time are removed. The quote it came from is kept.',
                  confirmLabel: 'Delete project',
                  onConfirm: () => {
                    store.removeProject(project.id);
                    ctx.toast('Project deleted');
                    ctx.navigate('#/projects');
                  },
                }),
            }),
          ]),
        ]),
      ]),
    };
  }

  function kpi(label, value, hint, tone) {
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { class: `kpi__value${tone ? ` is-${tone}` : ''}`, style: 'font-size:21px', text: value }),
      hint ? h('div', { class: 'kpi__hint', text: hint }) : null,
    ]);
  }

  /* -------------------------------------------------------------- forms */

  function openTimeForm(ctx, project) {
    ctx.openModal({
      title: `Log time — ${project.name}`,
      submitLabel: 'Log time',
      fields: [
        { name: 'date', label: 'Date', type: 'date', value: util.todayIso(), required: true },
        { name: 'hours', label: 'Hours', type: 'number', value: '1', required: true, step: '0.25', min: '0' },
        { name: 'note', label: 'What did you work on?', placeholder: 'Homepage build' },
        { name: 'billable', label: 'Billable (uncheck for internal work)', type: 'checkbox', value: true, checked: true },
      ],
      onSubmit: (values) => {
        const hours = calc.toNumber(values.hours);
        if (hours <= 0) throw new Error('Enter how many hours you worked.');
        ctx.store.logTime(project.id, {
          date: values.date || util.todayIso(),
          hours,
          note: (values.note || '').trim(),
          billable: Boolean(values.billable),
        });
        ctx.toast(`${util.hours(hours)} logged`, 'success');
        ctx.refresh();
      },
    });
  }

  function openCostForm(ctx, project) {
    ctx.openModal({
      title: `Add a cost — ${project.name}`,
      submitLabel: 'Add cost',
      fields: [
        { name: 'label', label: 'What was it?', placeholder: 'Stock photography', required: true },
        { name: 'amount', label: 'Amount', type: 'number', step: '0.01', value: '0', required: true },
        { name: 'date', label: 'Date', type: 'date', value: util.todayIso() },
      ],
      onSubmit: (values) => {
        const amount = calc.toNumber(values.amount);
        if (amount <= 0) throw new Error('Enter the amount you paid.');
        ctx.store.addCost(project.id, {
          label: values.label.trim(),
          amount,
          date: values.date || util.todayIso(),
        });
        ctx.toast('Cost added', 'success');
        ctx.refresh();
      },
    });
  }

  function editor(ctx, project) {
    const { store } = ctx;
    const settings = store.getSettings();
    const clients = store.clients();
    const quotes = store.quotes();
    const isNew = !project;

    if (clients.length === 0) {
      return {
        title: isNew ? 'New project' : 'Edit project',
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'Add a client first' }),
            h('p', { text: 'A project always belongs to a client so the revenue can be reported against their name.' }),
            h('button', { class: 'btn btn--primary', type: 'button', text: '+ New client', onclick: () => root.MarginDesk.views.clients.openForm(ctx, null) }),
          ]),
        ]),
      };
    }

    const draft = project
      ? JSON.parse(JSON.stringify(project))
      : {
          name: '',
          clientId: clients[0].id,
          quoteId: null,
          status: 'active',
          startDate: util.todayIso(),
          dueDate: calc.addDays(util.todayIso(), 21),
          budgetHours: 0,
          hourlyRate: settings.defaultHourlyRate,
          costRate: settings.defaultCostRate,
          notes: '',
        };

    const eligibleQuotes = quotes.filter((quote) => quote.status === 'accepted' && (quote.projectId === project?.id || !quote.projectId));

    const previewHost = h('div', { class: 'callout', text: '' });

    const form = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Project details' }), h('p', { text: 'Link the accepted quote and MarginDesk fills in the revenue and hour budget' })])]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'form-grid' }, [
          field('Name', h('input', { type: 'text', value: draft.name, placeholder: 'Harbor Coffee rebrand', oninput: (event) => { draft.name = event.target.value; } })),
          field('Client', h('select', { onchange: (event) => { draft.clientId = event.target.value; } }, clients.map((client) => h('option', { value: client.id, text: client.company || client.name, selected: client.id === draft.clientId })))),
          field('Linked quote', h('select', { onchange: (event) => { applyQuote(draft, event.target.value, quotes, settings, ctx); recalculatePreview(); } }, [
            h('option', { value: '', text: 'None — set revenue manually', selected: !draft.quoteId }),
            ...eligibleQuotes.map((quote) => h('option', { value: quote.id, text: `${quote.number} — ${quote.title} (${util.money(calc.quoteTotals(quote, settings).total, settings.currency)})`, selected: quote.id === draft.quoteId })),
          ])),
          field('Status', h('select', { onchange: (event) => { draft.status = event.target.value; } }, calc.PROJECT_STATUSES.map((item) => h('option', { value: item, text: calc.PROJECT_STATUS_LABELS[item], selected: item === draft.status })))),
          field('Start date', h('input', { type: 'date', value: draft.startDate, onchange: (event) => { draft.startDate = event.target.value; } })),
          field('Due date', h('input', { type: 'date', value: draft.dueDate, onchange: (event) => { draft.dueDate = event.target.value; } })),
          field('Budget hours', h('input', { type: 'number', step: '0.5', min: '0', value: draft.budgetHours, oninput: (event) => { draft.budgetHours = calc.toNumber(event.target.value); recalculatePreview(); } })),
          field('Hourly rate', h('input', { type: 'number', step: '1', min: '0', value: draft.hourlyRate, oninput: (event) => { draft.hourlyRate = calc.toNumber(event.target.value); recalculatePreview(); } })),
          field('Your cost per hour', h('input', { type: 'number', step: '1', min: '0', value: draft.costRate, oninput: (event) => { draft.costRate = calc.toNumber(event.target.value); recalculatePreview(); } })),
        ]),
        h('div', { class: 'field' }, [
          h('span', { class: 'field__label', text: 'Notes' }),
          h('textarea', { placeholder: 'Scope reminders, decisions, links…', oninput: (event) => { draft.notes = event.target.value; } }, [draft.notes]),
        ]),
        h('div', { class: 'grid grid--3' }, [previewHost]),
      ]),
    ]);

    function recalculatePreview() {
      const quote = quotes.find((item) => item.id === draft.quoteId) || null;
      const totals = calc.projectTotals(draft, quote, settings);
      util.clear(previewHost);
      util.appendChildren(previewHost, [
        h('div', { class: 'kpi__label', text: 'Projected' }),
        h('div', { style: 'font-weight:600;margin-top:2px', text: `${util.money(totals.revenue, settings.currency)} revenue · ${util.money(totals.totalCost, settings.currency)} cost · ${util.money(totals.profit, settings.currency)} profit` }),
        h('div', { text: totals.revenue > 0 ? `Margin ${util.percent(totals.marginPercent)} (target ${settings.targetMarginPercent}%)` : 'Link a quote to project the revenue and margin.' }),
      ]);
    }

    recalculatePreview();

    function save() {
      if (!draft.name.trim()) {
        ctx.toast('Give the project a name', 'error');
        return;
      }
      const payload = {
        name: draft.name.trim(),
        clientId: draft.clientId,
        quoteId: draft.quoteId || null,
        status: draft.status,
        startDate: draft.startDate,
        dueDate: draft.dueDate,
        budgetHours: calc.toNumber(draft.budgetHours),
        hourlyRate: calc.toNumber(draft.hourlyRate),
        costRate: calc.toNumber(draft.costRate),
        notes: draft.notes,
      };
      const saved_ = isNew ? store.addProject(payload) : store.updateProject(project.id, payload);
      ctx.toast(isNew ? 'Project created' : 'Project saved', 'success');
      ctx.navigate(`#/projects/${saved_.id}`);
    }

    return {
      title: isNew ? 'New project' : `Edit ${project.name}`,
      subtitle: isNew ? 'Link an accepted quote to carry the revenue over' : project.name,
      actions: [
        h('a', { class: 'btn btn--ghost', href: project ? `#/projects/${project.id}` : '#/projects', text: 'Cancel' }),
        h('button', { class: 'btn btn--primary', type: 'button', text: isNew ? 'Create project' : 'Save project', onclick: save }),
      ],
      content: h('div', { class: 'stack' }, [form]),
    };
  }

  function applyQuote(draft, quoteId, quotes, settings, ctx) {
    const quote = quotes.find((item) => item.id === quoteId) || null;
    draft.quoteId = quoteId || null;
    if (!quote) return;
    const totals = calc.quoteTotals(quote, settings);
    draft.budgetHours = totals.totalHours || draft.budgetHours;
    draft.name = draft.name || quote.title;
    draft.clientId = quote.clientId || draft.clientId;
    if (totals.lines[0]) draft.hourlyRate = totals.lines[0].rate;
    ctx.toast('Quote applied — hours, rate and client filled in', 'success');
  }

  function field(label, control) {
    return h('div', { class: 'field' }, [h('span', { class: 'field__label', text: label }), control]);
  }

  root.MarginDesk.views = root.MarginDesk.views || {};
  root.MarginDesk.views.projects = { title: 'Projects', render: list, detail, editor };
})(typeof self !== 'undefined' ? self : this);
