/**
 * Clients — the people you invoice, and how much each one is actually worth.
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
    const search = (ctx.query.search || '').toLowerCase();
    const all = store.clients();
    const quotes = store.quotes();
    const projects = store.projects();

    const rows = all
      .map((client) => {
        const summary = calc.clientSummary(client, quotes, projects, settings);
        return { client, summary };
      })
      .filter(({ client }) =>
        !search ||
        [client.name, client.company, client.email].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
      .sort((a, b) => b.summary.lifetimeValue - a.summary.lifetimeValue || a.client.name.localeCompare(b.client.name));

    const body = rows.length
      ? h('tbody', {}, rows.map(({ client, summary }) =>
          h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/clients/${client.id}`) }, [
            h('td', {}, [
              h('div', { class: 'client-cell' }, [
                h('div', { class: 'avatar', text: util.initials(client.company || client.name) }),
                h('div', {}, [
                  h('div', { class: 'cell-strong', text: client.company || client.name }),
                  h('span', { class: 'cell-sub', text: client.company ? client.name : client.email || '' }),
                ]),
              ]),
            ]),
            h('td', {}, [
              h('div', { text: client.email || '—' }),
              h('span', { class: 'cell-sub', text: client.phone || '' }),
            ]),
            h('td', { class: 'num', text: String(summary.quotes) }),
            h('td', { class: 'num', text: util.money(summary.pipelineValue, currency) }),
            h('td', { class: 'num cell-strong', text: util.money(summary.lifetimeValue, currency) }),
            h('td', { class: 'num' }, [
              summary.winRate === null
                ? h('span', { class: 'dim', text: '—' })
                : h('span', { class: summary.winRate >= 50 ? 'badge badge--good' : 'badge badge--warn', text: util.percent(summary.winRate) }),
            ]),
            h('td', { class: 'num' }, [
              h('button', {
                class: 'btn btn--ghost btn--sm',
                type: 'button',
                text: 'Edit',
                onclick: (event) => {
                  event.stopPropagation();
                  openClientForm(ctx, client);
                },
              }),
            ]),
          ]),
        ))
      : null;

    const table = h('div', { class: 'table-wrap' }, [
      h('table', { class: 'data' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', { text: 'Client' }),
            h('th', { text: 'Contact' }),
            h('th', { class: 'num', text: 'Quotes' }),
            h('th', { class: 'num', text: 'In pipeline' }),
            h('th', { class: 'num', text: 'Won to date' }),
            h('th', { class: 'num', text: 'Win rate' }),
            h('th', { class: 'num', text: '' }),
          ]),
        ]),
        body ?? h('tbody', {}, [
          h('tr', {}, [
            h('td', { colspan: '7' }, [
              h('div', { class: 'empty' }, [
                h('h3', { text: all.length ? 'No client matches that search' : 'No clients yet' }),
                h('p', {
                  text: all.length
                    ? 'Try a different name or company.'
                    : 'Add the people you quote. Each client keeps their own default rate, contact details and history.',
                }),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]);

    return {
      title: 'Clients',
      subtitle: `${all.length} client${all.length === 1 ? '' : 's'} on file`,
      actions: [h('button', { class: 'btn btn--primary', type: 'button', text: '+ New client', onclick: () => openClientForm(ctx, null) })],
      content: h('div', { class: 'stack' }, [
        h('div', { class: 'toolbar' }, [
          h('div', { class: 'field toolbar__search' }, [
            h('input', {
              type: 'search',
              placeholder: 'Search name, company or email…',
              'data-focus-key': 'clients-search',
              value: ctx.query.search || '',
              oninput: util.debounce((event) => {
                ctx.navigate(`#/clients?search=${encodeURIComponent(event.target.value)}`, { replace: true });
              }, 260),
            }),
          ]),
        ]),
        h('section', { class: 'card' }, [table]),
      ]),
    };
  }

  /* ----------------------------------------------------------- detail view */

  function detail(ctx, id) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const client = store.client(id);

    if (!client) {
      return {
        title: 'Client not found',
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'That client no longer exists' }),
            h('p', { text: 'It may have been deleted.' }),
            h('a', { class: 'btn btn--primary', href: '#/clients', text: 'Back to clients' }),
          ]),
        ]),
      };
    }

    const quotes = store.quotes().filter((quote) => quote.clientId === client.id);
    const projects = store.projects().filter((project) => project.clientId === client.id);
    const summary = calc.clientSummary(client, store.quotes(), store.projects(), settings);

    const details = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', { class: 'client-cell' }, [
          h('div', { class: 'avatar', text: util.initials(client.company || client.name) }),
          h('div', {}, [
            h('h2', { text: client.company || client.name }),
            h('p', { text: client.company ? client.name : '' }),
          ]),
        ]),
        h('div', { class: 'btn-row' }, [
          h('button', { class: 'btn btn--ghost', type: 'button', text: 'Edit', onclick: () => openClientForm(ctx, client) }),
          h('a', { class: 'btn btn--primary', href: `#/quotes/new?client=${client.id}`, text: '+ New quote' }),
        ]),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'grid grid--3' }, [
          infoBlock('Contact', [client.name, client.email, client.phone].filter(Boolean).join('\n') || '—'),
          infoBlock('Address', client.address || '—'),
          infoBlock('Notes', client.notes || '—'),
        ]),
        h('div', { class: 'grid grid--kpi', style: 'margin-top:16px' }, [
          miniKpi('Won to date', util.money(summary.lifetimeValue, currency)),
          miniKpi('In pipeline', util.money(summary.pipelineValue, currency)),
          miniKpi('Win rate', summary.winRate === null ? '—' : util.percent(summary.winRate)),
          miniKpi('Average project margin', summary.averageMargin === null ? '—' : util.percent(summary.averageMargin)),
        ]),
      ]),
    ]);

    const quoteRows = quotes.length
      ? h('tbody', {}, quotes.map((quote) => {
          const totals = calc.quoteTotals(quote, settings);
          return h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/quotes/${quote.id}`) }, [
            h('td', {}, [h('span', { class: 'mono', text: quote.number }), h('span', { class: 'cell-sub', text: quote.title })]),
            h('td', {}, [util.statusBadge(quote.status, calc.QUOTE_STATUS_LABELS[quote.status])]),
            h('td', { text: util.date(quote.issueDate) }),
            h('td', { class: 'num', text: util.money(totals.total, currency) }),
          ]);
        }))
      : h('tbody', {}, [h('tr', {}, [h('td', { colspan: '4' }, [h('div', { class: 'empty' }, [h('p', { text: 'No quotes for this client yet.' })])])])]);

    const quoteCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Quotes' }), h('p', { text: `${quotes.length} total` })])]),
      h('div', { class: 'table-wrap' }, [
        h('table', { class: 'data' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: 'Quote' }), h('th', { text: 'Status' }), h('th', { text: 'Issued' }), h('th', { class: 'num', text: 'Value' })])]),
          quoteRows,
        ]),
      ]),
    ]);

    const projectRows = projects.length
      ? h('tbody', {}, projects.map((project) => {
          const quote = quotes.find((item) => item.id === project.quoteId);
          const totals = calc.projectTotals(project, quote, settings);
          return h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/projects/${project.id}`) }, [
            h('td', {}, [h('span', { class: 'cell-strong', text: project.name }), h('span', { class: 'cell-sub', text: `${util.hours(totals.loggedHours)} of ${util.hours(totals.estimatedHours)} logged` })]),
            h('td', {}, [util.statusBadge(project.status, calc.PROJECT_STATUS_LABELS[project.status])]),
            h('td', { class: 'num', text: util.money(totals.revenue, currency) }),
            h('td', { class: 'num' }, [util.marginBadge(totals.marginPercent, currency, settings.targetMarginPercent)]),
          ]);
        }))
      : h('tbody', {}, [h('tr', {}, [h('td', { colspan: '4' }, [h('div', { class: 'empty' }, [h('p', { text: 'No projects for this client yet.' })])])])]);

    const projectCard = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Projects' }), h('p', { text: `${projects.length} total` })])]),
      h('div', { class: 'table-wrap' }, [
        h('table', { class: 'data' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: 'Project' }), h('th', { text: 'Status' }), h('th', { class: 'num', text: 'Revenue' }), h('th', { class: 'num', text: 'Margin' })])]),
          projectRows,
        ]),
      ]),
    ]);

    return {
      title: client.company || client.name,
      subtitle: client.email || client.phone || 'Client record',
      actions: [h('a', { class: 'btn btn--ghost', href: '#/clients', text: '← All clients' })],
      content: h('div', { class: 'stack' }, [details, quoteCard, projectCard]),
    };
  }

  function infoBlock(label, text) {
    return h('div', {}, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { style: 'white-space:pre-line;font-size:13px;margin-top:3px', text }),
    ]);
  }

  function miniKpi(label, value) {
    return h('div', { class: 'kpi' }, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { class: 'kpi__value', style: 'font-size:19px', text: value }),
    ]);
  }

  /* ----------------------------------------------------------------- forms */

  function openClientForm(ctx, client) {
    const { store } = ctx;
    ctx.openModal({
      title: client ? 'Edit client' : 'New client',
      submitLabel: client ? 'Save changes' : 'Add client',
      fields: [
        { name: 'name', label: 'Contact name', value: client ? client.name : '', placeholder: 'Dana Whitfield' },
        { name: 'company', label: 'Company', value: client ? client.company : '', placeholder: 'Harbor Coffee Roasters' },
        { name: 'email', label: 'Email', type: 'email', value: client ? client.email : '' },
        { name: 'phone', label: 'Phone', type: 'tel', value: client ? client.phone : '' },
        { name: 'address', label: 'Address', type: 'textarea', value: client ? client.address : '', placeholder: '14 Wharf Street\nPortland, ME 04101' },
        { name: 'notes', label: 'Notes', type: 'textarea', value: client ? client.notes : '', placeholder: 'How they like to work, who signs off, anything you always forget.' },
      ],
      onSubmit: (values) => {
        if (!values.name.trim() && !values.company.trim()) {
          throw new Error('Give the client a contact name or a company name.');
        }
        if (client) {
          store.updateClient(client.id, values);
          ctx.toast('Client updated', 'success');
        } else {
          const created = store.addClient(values);
          ctx.toast('Client added', 'success');
          ctx.navigate(`#/clients/${created.id}`);
          return;
        }
        ctx.refresh();
      },
    });
  }

  root.MarginDesk.views.clients = { title: 'Clients', render: list, detail, openForm: openClientForm };
})(typeof self !== 'undefined' ? self : this);
