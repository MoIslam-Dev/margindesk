/**
 * Quotes — the list, the read-only record, and the line-item editor.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'declined', label: 'Declined' },
    { value: 'expired', label: 'Expired' },
  ];

  /* ------------------------------------------------------------- list view */

  function list(ctx) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const status = ctx.query.status || '';
    const clientId = ctx.query.client || '';
    const search = (ctx.query.search || '').toLowerCase();
    const all = store.quotes();
    const today = util.todayIso();

    const counts = new Map();
    for (const quote of all) counts.set(quote.status, (counts.get(quote.status) || 0) + 1);

    const rows = all
      .filter((quote) => (status ? quote.status === status : true))
      .filter((quote) => (clientId ? quote.clientId === clientId : true))
      .filter((quote) =>
        !search
          ? true
          : [quote.number, quote.title, store.clientName(quote.clientId)].join(' ').toLowerCase().includes(search),
      );

    const pills = h('div', { class: 'pill-row' }, STATUS_FILTERS.map((filter) =>
      h('button', {
        class: `btn btn--sm${status === filter.value ? ' btn--primary' : ' btn--ghost'}`,
        type: 'button',
        text: filter.value ? `${filter.label} (${counts.get(filter.value) || 0})` : `All (${all.length})`,
        onclick: () => ctx.navigate(`#/quotes${setQuery(ctx.query, { status: filter.value })}`),
      }),
    ));

    const table = h('div', { class: 'table-wrap' }, [
      h('table', { class: 'data' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', { text: 'Quote' }),
            h('th', { text: 'Client' }),
            h('th', { text: 'Status' }),
            h('th', { text: 'Issued' }),
            h('th', { text: 'Valid until' }),
            h('th', { class: 'num', text: 'Value' }),
            h('th', { class: 'num', text: 'Margin' }),
            h('th', { class: 'num', text: '' }),
          ]),
        ]),
        rows.length
          ? h('tbody', {}, rows.map((quote) => quoteRow(ctx, quote, settings, currency, today)))
          : h('tbody', {}, [
              h('tr', {}, [
                h('td', { colspan: '8' }, [
                  h('div', { class: 'empty' }, [
                    h('h3', { text: all.length ? 'No quotes match these filters' : 'No quotes yet' }),
                    h('p', {
                      text: all.length
                        ? 'Clear the search or pick another status.'
                        : 'Build your first quote: line items, hourly rate, discount, tax — the totals and margin update as you type.',
                    }),
                    all.length ? null : h('a', { class: 'btn btn--primary', href: '#/quotes/new', text: '+ New quote' }),
                  ]),
                ]),
              ]),
            ]),
      ]),
    ]);

    return {
      title: 'Quotes',
      subtitle: `${all.length} quote${all.length === 1 ? '' : 's'} · ${util.money(calc.sum(all.filter((quote) => ['draft', 'sent'].includes(quote.status)), (quote) => calc.quoteTotals(quote, settings).total), currency)} still open`,
      actions: [h('a', { class: 'btn btn--primary', href: '#/quotes/new', text: '+ New quote' })],
      content: h('div', { class: 'stack' }, [
        h('div', { class: 'toolbar' }, [
          h('div', { class: 'field toolbar__search' }, [
            h('input', {
              type: 'search',
              placeholder: 'Search number, title or client…',
              'data-focus-key': 'quotes-search',
              value: ctx.query.search || '',
              oninput: util.debounce((event) => {
                ctx.navigate(`#/quotes${setQuery(ctx.query, { search: event.target.value })}`, { replace: true });
              }, 260),
            }),
          ]),
          h('div', { class: 'field' }, [
            h('select', {
              onchange: (event) => ctx.navigate(`#/quotes${setQuery(ctx.query, { client: event.target.value })}`),
            }, [
              h('option', { value: '', text: 'All clients', selected: !clientId }),
              ...store.clients().map((client) =>
                h('option', { value: client.id, text: client.company || client.name, selected: client.id === clientId }),
              ),
            ]),
          ]),
        ]),
        h('div', {}, [pills]),
        h('section', { class: 'card' }, [table]),
      ]),
    };
  }

  function quoteRow(ctx, quote, settings, currency, today) {
    const totals = calc.quoteTotals(quote, settings);
    const expiry = calc.quoteExpiryStatus(quote, today);
    return h('tr', { class: 'is-clickable', onclick: () => ctx.navigate(`#/quotes/${quote.id}`) }, [
      h('td', {}, [
        h('div', {}, [h('span', { class: 'mono dim', text: quote.number }), h('span', { class: 'cell-strong', text: ` ${quote.title}` })]),
        h('span', { class: 'cell-sub', text: `${quote.lineItems.length} line item${quote.lineItems.length === 1 ? '' : 's'} · ${util.hours(totals.totalHours)}` }),
      ]),
      h('td', { text: ctx.store.clientName(quote.clientId) }),
      h('td', {}, [
        util.statusBadge(quote.status, calc.QUOTE_STATUS_LABELS[quote.status]),
        expiry === 'urgent' ? h('span', { class: 'cell-sub', text: 'expires soon' }) : null,
        expiry === 'expired' ? h('span', { class: 'cell-sub', text: 'past validity' }) : null,
      ]),
      h('td', { class: 'nowrap', text: util.date(quote.issueDate) }),
      h('td', { class: 'nowrap' }, [
        util.date(quote.validUntil),
        h('span', { class: 'cell-sub', text: util.relativeDay(quote.validUntil) }),
      ]),
      h('td', { class: 'num cell-strong', text: util.money(totals.total, currency) }),
      h('td', { class: 'num' }, [util.marginBadge(totals.marginPercent, currency, settings.targetMarginPercent)]),
      h('td', { class: 'num' }, [
        h('button', {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          text: 'Open',
          onclick: (event) => {
            event.stopPropagation();
            ctx.navigate(`#/quotes/${quote.id}`);
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
    const quote = store.quote(id);

    if (!quote) {
      return {
        title: 'Quote not found',
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'That quote no longer exists' }),
            h('p', { text: 'It may have been deleted.' }),
            h('a', { class: 'btn btn--primary', href: '#/quotes', text: 'Back to quotes' }),
          ]),
        ]),
      };
    }

    const totals = calc.quoteTotals(quote, settings);
    const client = store.client(quote.clientId);
    const expiry = calc.quoteExpiryStatus(quote, util.todayIso());
    const project = quote.projectId ? store.project(quote.projectId) : null;

    const statusActions = calc.QUOTE_STATUSES
      .filter((status) => status !== quote.status)
      .map((status) =>
        h('button', {
          class: `btn btn--sm${status === 'accepted' ? ' btn--primary' : ' btn--ghost'}`,
          type: 'button',
          text: `Mark ${calc.QUOTE_STATUS_LABELS[status].toLowerCase()}`,
          onclick: () => {
            store.setQuoteStatus(quote.id, status);
            ctx.toast(`Quote ${quote.number} marked ${calc.QUOTE_STATUS_LABELS[status].toLowerCase()}`, 'success');
            ctx.refresh();
          },
        }),
      );

    const meta = h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [
        h('div', {}, [
          h('h2', { text: 'Quote' }),
          h('p', { text: `${quote.number} · issued ${util.date(quote.issueDate)} · valid until ${util.date(quote.validUntil)}` }),
        ]),
        h('div', { class: 'btn-row' }, [util.statusBadge(quote.status, calc.QUOTE_STATUS_LABELS[quote.status]), ...statusActions]),
      ]),
      h('div', { class: 'card__body' }, [
        h('div', { class: 'grid grid--3' }, [
          metaBlock('Client', client ? (client.company || client.name) : '—', client ? `#/clients/${client.id}` : null),
          metaBlock('Validity', `${util.date(quote.validUntil)} (${util.relativeDay(quote.validUntil)})`),
          metaBlock('Project', project ? project.name : quote.status === 'accepted' ? 'Not created yet' : '—', project ? `#/projects/${project.id}` : null),
        ]),
        expiry === 'urgent' ? h('div', { class: 'callout callout--warn', style: 'margin-top:14px', text: 'This quote is about to expire. Follow up or extend the validity date.' }) : null,
        expiry === 'expired' ? h('div', { class: 'callout callout--bad', style: 'margin-top:14px', text: 'This quote is past its validity date. Send a fresh one if the client is still interested.' }) : null,
        totals.belowTargetMargin
          ? h('div', { class: 'callout callout--warn', style: 'margin-top:14px', text: `Projected margin is ${util.percent(totals.marginPercent)} — below your ${settings.targetMarginPercent}% target. Raise the rate, cut hours or add a rush fee.` })
          : null,
        quote.notes ? h('div', { class: 'callout', style: 'margin-top:14px', text: quote.notes }) : null,
      ]),
    ]);

    const lines = h('div', { class: 'table-wrap' }, [
      h('table', { class: 'line-items' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', { text: 'Description' }),
            h('th', { class: 'num', text: 'Hours' }),
            h('th', { class: 'num', text: 'Rate' }),
            h('th', { class: 'num', text: 'Adj.' }),
            h('th', { class: 'num', text: 'Amount' }),
          ]),
        ]),
        h('tbody', {}, totals.lines.map((line, index) => {
          const item = quote.lineItems[index];
          const adjustment = [];
          if (line.complexity > 1) adjustment.push(`×${line.complexity} complex`);
          if (line.rushPercent > 0) adjustment.push(`+${line.rushPercent}% rush`);
          return h('tr', {}, [
            h('td', {}, [
              h('div', { class: 'cell-strong', text: item.description || 'Untitled item' }),
              item.detail ? h('span', { class: 'cell-sub', text: item.detail }) : null,
            ]),
            h('td', { class: 'num', text: util.hours(line.hours) }),
            h('td', { class: 'num', text: util.money(line.rate, currency) }),
            h('td', { class: 'num', text: adjustment.length ? adjustment.join(' · ') : '—' }),
            h('td', { class: 'num cell-strong', text: util.money(line.total, currency) }),
          ]);
        })),
      ]),
    ]);

    const breakdown = h('section', { class: 'card totals' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Totals' })])]),
      h('div', { class: 'card__body' }, [
        totalRow('Subtotal', util.money(totals.subtotal, currency)),
        totals.discountAmount > 0
          ? totalRow(totals.discountLabel === 'fixed' ? 'Discount' : `Discount (${totals.discountRate}%)`, `-${util.money(totals.discountAmount, currency)}`)
          : null,
        totals.taxAmount > 0 ? totalRow(`${settings.taxLabel} (${totals.taxRate}%)`, util.money(totals.taxAmount, currency)) : null,
        h('div', { class: 'totals__row totals__row--total' }, [h('span', { text: 'Total' }), h('span', { class: 'num', text: util.money(totals.total, currency) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Estimated hours' }), h('span', { text: util.hours(totals.totalHours) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Effective rate' }), h('span', { text: `${util.money(totals.effectiveHourlyRate, currency)}/h` })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Estimated cost' }), h('span', { text: util.money(totals.estimatedCost, currency) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Projected profit' }), h('span', { text: util.money(totals.profit, currency) })]),
        h('div', { class: 'totals__row' }, [h('span', { text: 'Projected margin' }), util.marginBadge(totals.marginPercent, currency, settings.targetMarginPercent)]),
      ]),
    ]);

    const actions = [
      h('a', { class: 'btn btn--ghost', href: '#/quotes', text: '← All quotes' }),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: 'Duplicate',
        onclick: () => {
          const copy = store.duplicateQuote(quote.id);
          ctx.toast('Quote duplicated as draft', 'success');
          ctx.navigate(`#/quotes/${copy.id}/edit`);
        },
      }),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: 'Print / PDF',
        onclick: () => {
          const document_ = root.MarginDesk.print.buildQuoteDocument(quote, client, settings);
          ctx.printDocument(document_, `Quote ${quote.number}`);
        },
      }),
      quote.status === 'accepted' && !project
        ? h('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: 'Start project',
            onclick: () => {
              const created = store.convertQuoteToProject(quote.id);
              ctx.toast('Project created from quote', 'success');
              ctx.navigate(`#/projects/${created.id}`);
            },
          })
        : null,
      h('a', { class: 'btn btn--primary', href: `#/quotes/${quote.id}/edit`, text: 'Edit' }),
    ];

    return {
      title: quote.title,
      subtitle: `${quote.number} · ${store.clientName(quote.clientId)} · ${util.money(totals.total, currency)}`,
      actions,
      content: h('div', { class: 'quote-layout' }, [
        h('div', { class: 'stack' }, [
          meta,
          h('section', { class: 'card' }, [h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Line items' })])]), h('div', { class: 'card__body' }, [lines])]),
          h('section', { class: 'card' }, [
            h('div', { class: 'card__head' }, [
              h('div', {}, [h('h2', { text: 'Danger zone' })]),
              h('button', {
                class: 'btn btn--danger btn--sm',
                type: 'button',
                text: 'Delete quote',
                onclick: () =>
                  ctx.confirmDialog({
                    title: `Delete ${quote.number}?`,
                    message: 'This removes the quote permanently. Projects already created from it are kept.',
                    confirmLabel: 'Delete quote',
                    onConfirm: () => {
                      store.removeQuote(quote.id);
                      ctx.toast('Quote deleted');
                      ctx.navigate('#/quotes');
                    },
                  }),
              }),
            ]),
          ]),
        ]),
        breakdown,
      ]),
    };
  }

  function metaBlock(label, text, link) {
    return h('div', {}, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { style: 'margin-top:3px' }, [link ? h('a', { href: link, text }) : h('span', { text })]),
    ]);
  }

  function totalRow(label, value) {
    return h('div', { class: 'totals__row' }, [h('span', { text: label }), h('span', { class: 'num', text: value })]);
  }

  /* ------------------------------------------------------------- editor */

  function editor(ctx, quote) {
    const { store } = ctx;
    const settings = store.getSettings();
    const currency = settings.currency;
    const clients = store.clients();
    const isNew = !quote;

    if (clients.length === 0) {
      return {
        title: isNew ? 'New quote' : 'Edit quote',
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'Add a client first' }),
            h('p', { text: 'Every quote belongs to a client, so their contact details can be printed on the document.' }),
            h('button', { class: 'btn btn--primary', type: 'button', text: '+ New client', onclick: () => root.MarginDesk.views.clients.openForm(ctx, null) }),
          ]),
        ]),
      };
    }

    const draft = quote
      ? JSON.parse(JSON.stringify(quote))
      : {
          clientId: ctx.query.client || clients[0].id,
          title: '',
          issueDate: util.todayIso(),
          validUntil: calc.addDays(util.todayIso(), settings.quoteValidityDays),
          lineItems: [newItem(settings)],
          discount: { type: 'percent', value: 0 },
          taxRate: settings.taxRate,
          notes: '',
        };

    if (!draft.lineItems || draft.lineItems.length === 0) draft.lineItems = [newItem(settings)];

    const totalsHost = h('div', {});
    const linesHost = h('tbody', {});
    const marginHost = h('div', {});

    function recalculate() {
      const totals = calc.quoteTotals(draft, settings);
      util.clear(totalsHost);
      util.appendChildren(totalsHost, [
        totalRow('Subtotal', util.money(totals.subtotal, currency)),
        totals.discountAmount > 0
          ? totalRow(totals.discountLabel === 'fixed' ? 'Discount' : `Discount (${totals.discountRate}%)`, `-${util.money(totals.discountAmount, currency)}`)
          : null,
        totals.taxAmount > 0 ? totalRow(`${settings.taxLabel} (${totals.taxRate}%)`, util.money(totals.taxAmount, currency)) : null,
        h('div', { class: 'totals__row totals__row--total' }, [h('span', { text: 'Total' }), h('span', { class: 'num', text: util.money(totals.total, currency) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Estimated hours' }), h('span', { text: util.hours(totals.totalHours) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Effective rate' }), h('span', { text: `${util.money(totals.effectiveHourlyRate, currency)}/h` })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Estimated cost' }), h('span', { text: util.money(totals.estimatedCost, currency) })]),
        h('div', { class: 'totals__row totals__row--muted' }, [h('span', { text: 'Projected profit' }), h('span', { text: util.money(totals.profit, currency) })]),
        h('div', { class: 'totals__row' }, [h('span', { text: 'Projected margin' }), util.marginBadge(totals.marginPercent, currency, settings.targetMarginPercent)]),
      ]);

      util.clear(marginHost);
      if (totals.belowTargetMargin) {
        util.appendChildren(marginHost, [
          h('div', { class: 'callout callout--warn', text: `Below your ${settings.targetMarginPercent}% margin target. Consider fewer hours, a higher rate or a rush fee.` }),
        ]);
      } else if (totals.subtotal > 0) {
        util.appendChildren(marginHost, [h('div', { class: 'callout callout--good', text: `Margin is above target. The effective rate is ${util.money(totals.effectiveHourlyRate, currency)} per hour.` })]);
      }

      const rows = util.$$('tr[data-line]', linesHost);
      draft.lineItems.forEach((item, index) => {
        const line = calc.lineTotals(item, settings);
        const cell = rows[index]?.querySelector('[data-line-total]');
        if (cell) cell.textContent = util.money(line.total, currency);
      });
    }

    function renderLines() {
      util.clear(linesHost);
      draft.lineItems.forEach((item, index) => {
        linesHost.append(lineRow(item, index));
      });
      recalculate();
    }

    function lineRow(item, index) {
      return h('tr', { 'data-line': String(index) }, [
        h('td', {}, [
          h('input', {
            type: 'text',
            value: item.description,
            placeholder: 'Design sprint',
            oninput: (event) => {
              item.description = event.target.value;
            },
          }),
          h('input', {
            type: 'text',
            value: item.detail ?? '',
            placeholder: 'Optional detail',
            style: 'margin-top:4px',
            oninput: (event) => {
              item.detail = event.target.value;
            },
          }),
        ]),
        h('td', { class: 'col-num' }, [
          h('input', {
            type: 'number',
            step: '0.25',
            min: '0',
            value: item.hours,
            oninput: (event) => {
              item.hours = calc.toNumber(event.target.value);
              recalculate();
            },
          }),
        ]),
        h('td', { class: 'col-num' }, [
          h('input', {
            type: 'number',
            step: '1',
            min: '0',
            value: item.rate,
            oninput: (event) => {
              item.rate = calc.toNumber(event.target.value);
              recalculate();
            },
          }),
        ]),
        h('td', { class: 'col-num' }, [
          h('select', {
            onchange: (event) => {
              item.complexity = Number(event.target.value);
              recalculate();
            },
          }, calc.COMPLEXITY_PRESETS.map((preset) => h('option', { value: preset.value, text: preset.label, selected: Number(item.complexity) === preset.value }))),
          h('select', {
            style: 'margin-top:4px',
            onchange: (event) => {
              item.rushPercent = Number(event.target.value);
              recalculate();
            },
          }, calc.RUSH_PRESETS.map((value) => h('option', { value: value, text: value > 0 ? `+${value}% rush` : 'No rush', selected: Number(item.rushPercent) === value }))),
        ]),
        h('td', { class: 'col-num' }, [
          h('input', {
            type: 'number',
            step: '1',
            min: '0',
            value: item.cost,
            title: 'What this costs you (your time at cost rate, stock, licences…)',
            oninput: (event) => {
              item.cost = calc.toNumber(event.target.value);
              recalculate();
            },
          }),
        ]),
        h('td', { class: 'num cell-strong', 'data-line-total': '1', text: '' }),
        h('td', { class: 'num' }, [
          draft.lineItems.length > 1
            ? h('button', {
                class: 'icon-btn',
                type: 'button',
                title: 'Remove line',
                text: '×',
                onclick: () => {
                  draft.lineItems.splice(index, 1);
                  renderLines();
                },
              })
            : null,
        ]),
      ]);
    }

    function addLine() {
      draft.lineItems.push(newItem(settings));
      renderLines();
      const inputs = util.$$('tr[data-line] input[type="text"]', linesHost);
      inputs[inputs.length - 2]?.focus();
    }

    function save(status) {
      if (!draft.clientId) {
        ctx.toast('Pick a client for this quote', 'error');
        return;
      }
      if (!draft.title.trim()) {
        ctx.toast('Give the quote a title', 'error');
        return;
      }
      if (draft.lineItems.filter((item) => (item.description || '').trim() || calc.toNumber(item.hours) > 0).length === 0) {
        ctx.toast('Add at least one line item', 'error');
        return;
      }
      const payload = {
        clientId: draft.clientId,
        title: draft.title.trim(),
        issueDate: draft.issueDate,
        validUntil: draft.validUntil,
        lineItems: draft.lineItems
          .filter((item) => (item.description || '').trim() || calc.toNumber(item.hours) > 0)
          .map((item) => ({
            id: item.id,
            description: item.description.trim(),
            detail: (item.detail || '').trim(),
            hours: calc.toNumber(item.hours),
            rate: calc.toNumber(item.rate),
            complexity: calc.toNumber(item.complexity, 1),
            rushPercent: calc.toNumber(item.rushPercent),
            cost: calc.toNumber(item.cost),
          })),
        discount: { type: draft.discount.type, value: calc.toNumber(draft.discount.value) },
        taxRate: calc.toNumber(draft.taxRate),
        notes: draft.notes,
      };

      let saved_;
      if (isNew) {
        saved_ = store.addQuote(Object.assign({}, payload, { status }));
        ctx.toast(status === 'sent' ? 'Quote created and marked as sent' : 'Draft saved', 'success');
      } else {
        saved_ = store.updateQuote(quote.id, Object.assign({}, payload, status ? { status } : {}));
        ctx.toast(status && status !== quote.status ? `Quote marked ${calc.QUOTE_STATUS_LABELS[status].toLowerCase()}` : 'Quote saved', 'success');
      }
      ctx.navigate(`#/quotes/${saved_.id}`);
    }

    const form = h('div', { class: 'quote-layout' }, [
      h('div', { class: 'stack' }, [
        h('section', { class: 'card' }, [
          h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Quote details' })])]),
          h('div', { class: 'card__body' }, [
            h('div', { class: 'form-grid' }, [
              field('Client', h('select', {
                onchange: (event) => {
                  draft.clientId = event.target.value;
                },
              }, clients.map((client) => h('option', { value: client.id, text: client.company || client.name, selected: client.id === draft.clientId })))),
              field('Title', h('input', {
                type: 'text',
                value: draft.title,
                placeholder: 'Brand identity refresh',
                oninput: (event) => {
                  draft.title = event.target.value;
                },
              })),
              field('Issue date', h('input', {
                type: 'date',
                value: draft.issueDate,
                onchange: (event) => {
                  draft.issueDate = event.target.value;
                },
              })),
              field('Valid until', h('input', {
                type: 'date',
                value: draft.validUntil,
                onchange: (event) => {
                  draft.validUntil = event.target.value;
                },
              })),
            ]),
          ]),
        ]),
        h('section', { class: 'card' }, [
          h('div', { class: 'card__head' }, [
            h('div', {}, [h('h2', { text: 'Line items' }), h('p', { text: 'Hours × rate, plus complexity or a rush fee when the work deserves it' })]),
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '+ Add line', onclick: addLine }),
          ]),
          h('div', { class: 'card__body' }, [
            h('div', { class: 'table-wrap' }, [
              h('table', { class: 'line-items' }, [
                h('thead', {}, [
                  h('tr', {}, [
                    h('th', { text: 'Description' }),
                    h('th', { class: 'num', text: 'Hours' }),
                    h('th', { class: 'num', text: 'Rate' }),
                    h('th', { text: 'Adjust' }),
                    h('th', { class: 'num', text: 'Cost' }),
                    h('th', { class: 'num', text: 'Amount' }),
                    h('th', {}),
                  ]),
                ]),
                linesHost,
              ]),
            ]),
            h('div', { class: 'form-grid', style: 'margin-top:16px' }, [
              field('Discount type', h('select', {
                onchange: (event) => {
                  draft.discount.type = event.target.value;
                  recalculate();
                },
              }, [
                h('option', { value: 'percent', text: 'Percentage', selected: draft.discount.type !== 'fixed' }),
                h('option', { value: 'fixed', text: 'Fixed amount', selected: draft.discount.type === 'fixed' }),
              ])),
              field('Discount value', h('input', {
                type: 'number',
                'data-discount-value': '',
                step: draft.discount.type === 'fixed' ? '1' : '0.5',
                min: '0',
                value: draft.discount.value,
                oninput: (event) => {
                  draft.discount.value = calc.toNumber(event.target.value);
                  recalculate();
                },
              })),
              field(`${settings.taxLabel} rate (%)`, h('input', {
                type: 'number',
                'data-tax-rate': '',
                step: '0.5',
                min: '0',
                value: draft.taxRate,
                oninput: (event) => {
                  draft.taxRate = calc.toNumber(event.target.value);
                  recalculate();
                },
              })),
            ]),
            h('div', { class: 'field' }, [
              h('span', { class: 'field__label', text: 'Notes on the quote' }),
              h('textarea', {
                placeholder: settings.paymentTerms,
                oninput: (event) => {
                  draft.notes = event.target.value;
                },
              }, [draft.notes]),
            ]),
          ]),
        ]),
      ]),
      h('div', { class: 'stack' }, [
        h('section', { class: 'card totals' }, [
          h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: 'Live totals' })])]),
          h('div', { class: 'card__body' }, [totalsHost, h('div', { style: 'margin-top:12px' }, [marginHost])]),
        ]),
        h('div', { class: 'btn-row' }, [
          h('button', { class: 'btn btn--ghost', type: 'button', text: isNew ? 'Save draft' : 'Save', onclick: () => save(isNew ? 'draft' : null) }),
          h('button', { class: 'btn btn--primary', type: 'button', text: isNew ? 'Save & mark sent' : 'Save & mark sent', onclick: () => save('sent') }),
        ]),
      ]),
    ]);

    renderLines();

    return {
      title: isNew ? 'New quote' : `Edit ${quote.number}`,
      subtitle: isNew ? 'Totals and margin update as you type' : `${quote.number} · ${store.clientName(quote.clientId)}`,
      actions: [h('a', { class: 'btn btn--ghost', href: quote ? `#/quotes/${quote.id}` : '#/quotes', text: 'Cancel' })],
      content: form,
    };
  }

  function newItem(settings) {
    return {
      id: util.uid('li'),
      description: '',
      detail: '',
      hours: calc.DEFAULT_ITEM.hours,
      rate: settings.defaultHourlyRate,
      complexity: 1,
      rushPercent: settings.defaultRushPercent || 0,
      cost: 0,
    };
  }

  function field(label, control) {
    return h('div', { class: 'field' }, [h('span', { class: 'field__label', text: label }), control]);
  }

  function setQuery(current, patch) {
    const params = new URLSearchParams();
    const merged = Object.assign({}, current, patch);
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  root.MarginDesk.views = root.MarginDesk.views || {};
  root.MarginDesk.views.quotes = { title: 'Quotes', render: list, detail, editor, newItem };
})(typeof self !== 'undefined' ? self : this);
