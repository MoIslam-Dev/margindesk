/**
 * Quote document rendering.
 *
 * Produces a clean, printable quotation that the buyer can turn into a PDF with
 * the browser's "Save as PDF" (Ctrl/Cmd + P). Kept separate from the app views
 * because it is a document, not a screen.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  function money(value, currency) {
    return calc.formatMoney(value, currency);
  }

  function lineDescription(item) {
    const parts = [item.description || 'Item'];
    if (item.detail) parts.push(item.detail);
    return parts.join('\n');
  }

  function buildQuoteDocument(quote, client, settings) {
    const totals = calc.quoteTotals(quote, settings);
    const currency = settings.currency;

    const head = h('div', { class: 'doc__head' }, [
      h('div', { class: 'doc__brand' }, [
        h('h1', { text: settings.businessName || 'Your Studio' }),
        h('p', {
          text: [settings.ownerName, settings.address, [settings.email, settings.phone].filter(Boolean).join(' · '), settings.website]
            .filter(Boolean)
            .join('\n'),
        }),
      ]),
      h('div', { class: 'doc__meta' }, [
        h('h2', { text: 'Quotation' }),
        h('div', {}, [
          h('div', { class: 'mono', text: quote.number }),
          h('div', { text: `Issued ${calc.formatDate(quote.issueDate)}` }),
          h('div', { text: `Valid until ${calc.formatDate(quote.validUntil)}` }),
        ]),
      ]),
    ]);

    const clientName = client ? client.company || client.name : 'Client';
    const clientBlock = [clientName, client ? client.name : '', client ? client.address : '', client ? client.email : '']
      .filter(Boolean)
      .join('\n');

    const parties = h('div', { class: 'doc__parties' }, [
      h('div', {}, [h('h3', { text: 'Prepared for' }), h('p', { text: clientBlock })]),
      h('div', {}, [
        h('h3', { text: 'Project' }),
        h('p', { text: `${quote.title}\n${calc.formatHours(totals.totalHours)} estimated · ${settings.paymentTerms || 'Payment on delivery'}` }),
      ]),
    ]);

    const table = h('table', { class: 'doc-table' }, [
      h('thead', {}, [
        h('tr', {}, [
          h('th', { text: 'Description' }),
          h('th', { class: 'num', text: 'Hours' }),
          h('th', { class: 'num', text: 'Rate' }),
          h('th', { class: 'num', text: 'Adj.' }),
          h('th', { class: 'num', text: 'Amount' }),
        ]),
      ]),
      h(
        'tbody',
        {},
        quote.lineItems.map((item) => {
          const line = calc.lineTotals(item, settings);
          const adjustment = [];
          if (line.complexity > 1) adjustment.push(`complexity ${line.complexity}x`);
          if (line.rushPercent > 0) adjustment.push(`rush ${line.rushPercent}%`);
          return h('tr', {}, [
            h('td', { text: lineDescription(item), style: 'white-space:pre-line' }),
            h('td', { class: 'num', text: calc.formatHours(line.hours) }),
            h('td', { class: 'num', text: money(line.rate, currency) }),
            h('td', { class: 'num', text: adjustment.length ? adjustment.join(', ') : '—' }),
            h('td', { class: 'num', text: money(line.total, currency) }),
          ]);
        }),
      ),
      h('tfoot', {}, [
        h('tr', {}, [
          h('th', { colspan: '4', class: 'num', text: 'Subtotal' }),
          h('td', { class: 'num', text: money(totals.subtotal, currency) }),
        ]),
      ]),
    ]);

    const totalsRows = [
      ['Subtotal', money(totals.subtotal, currency)],
      totals.discountAmount > 0
        ? [totals.discountLabel === 'fixed' ? 'Discount' : `Discount (${totals.discountLabel}%)`, `-${money(totals.discountAmount, currency)}`]
        : null,
      totals.taxRate > 0 ? [`${settings.taxLabel || 'Tax'} (${totals.taxRate}%)`, money(totals.taxAmount, currency)] : null,
    ].filter(Boolean);

    const totalsBlock = h('div', { class: 'doc__totals' }, [
      ...totalsRows.map(([label, value]) => h('div', {}, [h('span', { text: label }), h('span', { text: value })])),
      h('div', { class: 'is-total' }, [h('span', { text: 'Total due' }), h('span', { text: money(totals.total, currency) })]),
      h('div', {}, [
        h('span', { class: 'muted', text: `Effective rate ${money(totals.effectiveHourlyRate, currency)}/h` }),
      ]),
    ]);

    const notes = h('div', { class: 'doc__notes' }, [
      h('div', { text: quote.notes || settings.paymentTerms || '' }),
      settings.bankDetails ? h('div', { style: 'margin-top:10px', text: settings.bankDetails }) : null,
    ]);

    const signature = h('div', { class: 'doc__sign' }, [
      h('div', {}, [h('div', { class: 'muted', text: 'Accepted for ' + clientName }), h('div', { style: 'margin-top:26px;border-bottom:1px solid #ccc', text: ' ' })]),
      h('div', {}, [h('div', { class: 'muted', text: 'Date' }), h('div', { style: 'margin-top:26px;border-bottom:1px solid #ccc', text: ' ' })]),
    ]);

    return h('article', { class: 'doc' }, [head, parties, table, totalsBlock, notes, signature]);
  }

  root.MarginDesk = root.MarginDesk || {};
  root.MarginDesk.print = { buildQuoteDocument };
})(typeof self !== 'undefined' ? self : this);
