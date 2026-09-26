/**
 * Settings — business details, money defaults and the data itself.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY', 'INR', 'BRL', 'MXN', 'ZAR', 'AED', 'PLN', 'CZK', 'NZD'];

  function render(ctx) {
    const { store } = ctx;
    const settings = store.getSettings();
    const state = store.all();

    const business = section('Business details', 'These details are printed on every quote.', [
      row([
        field('Business name', input('text', settings.businessName, (value) => save({ businessName: value }))),
        field('Your name', input('text', settings.ownerName, (value) => save({ ownerName: value }))),
      ]),
      row([
        field('Email', input('email', settings.email, (value) => save({ email: value }))),
        field('Phone', input('tel', settings.phone, (value) => save({ phone: value }))),
      ]),
      row([
        field('Website', input('text', settings.website, (value) => save({ website: value }))),
        field('Quote prefix', input('text', settings.quotePrefix, (value) => save({ quotePrefix: value.slice(0, 6) || 'Q' }))),
      ]),
      field('Address', textarea(settings.address, (value) => save({ address: value })), true),
    ]);

    const money = section('Money & rates', 'Defaults used for every new quote and project. You can override them per record.', [
      row([
        field('Currency', select(CURRENCIES.map((code) => ({ value: code, label: `${code} — ${calc.currencySymbol(code).trim()}` })), settings.currency, (value) => save({ currency: value }))),
        field('Default hourly rate', number(settings.defaultHourlyRate, (value) => save({ defaultHourlyRate: value }))),
      ]),
      row([
        field('Your cost per hour', number(settings.defaultCostRate, (value) => save({ defaultCostRate: value })), 'What one hour of your work costs you before profit.'),
        field('Target margin (%)', number(settings.targetMarginPercent, (value) => save({ targetMarginPercent: value })), 'Quotes and projects below this are flagged.'),
      ]),
      row([
        field(`${settings.taxLabel} rate (%)`, number(settings.taxRate, (value) => save({ taxRate: value }))),
        field('Quote validity (days)', number(settings.quoteValidityDays, (value) => save({ quoteValidityDays: value }))),
      ]),
      field('Default rush fee (%)', number(settings.defaultRushPercent, (value) => save({ defaultRushPercent: value })), true),
      field('Payment terms', input('text', settings.paymentTerms, (value) => save({ paymentTerms: value })), true),
      field('Bank details / payment instructions', textarea(settings.bankDetails, (value) => save({ bankDetails: value }), 'Printed at the bottom of quotes when present.'), true),
    ]);

    const appearance = section('Appearance', 'One colour drives buttons, charts and the printed document.', [
      row([
        field('Accent colour', colour(settings.accentColor, (value) => save({ accentColor: value }, true))),
        field('Preview', h('div', { class: 'row', style: 'min-height:34px' }, [
          h('span', { class: 'btn btn--primary', style: 'pointer-events:none', text: 'Primary button' }),
          h('span', { class: 'btn btn--ghost', style: 'pointer-events:none', text: 'Ghost button' }),
          h('span', { class: 'badge badge--good', text: 'Good' }),
          h('span', { class: 'badge badge--warn', text: 'Warn' }),
        ]), 'The document uses the same accent for its header rule.'),
      ]),
    ]);

    const data = section('Your data', 'Everything is stored in this browser only. Export a backup before switching computers or clearing history.', [
      h('div', { class: 'grid grid--3' }, [
        stat('Clients', state.clients.length),
        stat('Quotes', state.quotes.length),
        stat('Projects', state.projects.length),
      ]),
      h('div', { class: 'btn-row', style: 'margin-top:16px' }, [
        h('button', {
          class: 'btn btn--primary',
          type: 'button',
          text: 'Export backup (JSON)',
          onclick: () => {
            util.downloadFile(`margindesk-backup-${util.todayIso()}.json`, store.exportData());
            ctx.toast('Backup downloaded', 'success');
          },
        }),
        h('label', { class: 'btn' }, [
          h('span', { text: 'Import backup…' }),
          h('input', {
            type: 'file',
            accept: 'application/json,.json',
            style: 'display:none',
            onchange: (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  store.importData(String(reader.result));
                  ctx.toast('Backup imported', 'success');
                  ctx.navigate('#/');
                } catch (error) {
                  ctx.toast(error.message || 'That file could not be imported', 'error');
                }
              };
              reader.readAsText(file);
              event.target.value = '';
            },
          }),
        ]),
        h('button', {
          class: 'btn btn--ghost',
          type: 'button',
          text: 'Load demo data',
          onclick: () =>
            ctx.confirmDialog({
              title: 'Replace everything with the demo data?',
              message: 'Your current records are overwritten by the Fieldnote Studio sample. Export a backup first if you want to keep them.',
              confirmLabel: 'Load demo data',
              onConfirm: () => {
                store.reset({ withSeed: true });
                ctx.toast('Demo data loaded', 'success');
                ctx.navigate('#/');
              },
            }),
        }),
        h('button', {
          class: 'btn btn--danger',
          type: 'button',
          text: 'Delete everything',
          onclick: () =>
            ctx.confirmDialog({
              title: 'Delete all records?',
              message: 'Clients, quotes, projects and settings are removed from this browser. This cannot be undone.',
              confirmLabel: 'Delete everything',
              onConfirm: () => {
                store.reset();
                ctx.toast('All data deleted');
                ctx.navigate('#/');
              },
            }),
        }),
      ]),
      h('div', { class: 'callout', style: 'margin-top:16px', text: 'Storage key: margindesk.data.v1 in this browser\'s localStorage. Clearing site data removes your records, so keep an export somewhere safe.' }),
    ]);

    return {
      title: 'Settings',
      subtitle: 'Defaults, branding and your data',
      actions: [h('a', { class: 'btn btn--ghost', href: '#/', text: '← Dashboard' })],
      content: h('div', { class: 'stack' }, [business, money, appearance, data]),
    };
  }

  /* ---------------------------------------------------------------- helpers */

  function save(patch, rerender) {
    const store = window.MarginDeskApp.store;
    store.saveSettings(patch);
    if (patch.accentColor) window.MarginDeskApp.applyAccent(patch.accentColor);
    if (patch.businessName || patch.ownerName) window.MarginDeskApp.syncShell();
    if (patch.currency || patch.taxLabel) window.MarginDeskApp.refresh();
    else if (rerender) window.MarginDeskApp.refresh();
  }

  function section(title, hint, children) {
    return h('section', { class: 'card' }, [
      h('div', { class: 'card__head' }, [h('div', {}, [h('h2', { text: title }), hint ? h('p', { text: hint }) : null])]),
      h('div', { class: 'card__body' }, children),
    ]);
  }

  function row(children) {
    return h('div', { class: 'form-grid' }, children);
  }

  function field(label, control, hint) {
    return h('div', { class: 'field' }, [
      h('span', { class: 'field__label', text: label }),
      control,
      hint ? h('span', { class: 'field__hint', text: hint }) : null,
    ]);
  }

  function input(type, value, onValue) {
    return h('input', {
      type,
      value: value ?? '',
      onchange: (event) => onValue(event.target.value),
    });
  }

  function number(value, onValue) {
    return h('input', {
      type: 'number',
      step: 'any',
      min: '0',
      value: value ?? 0,
      onchange: (event) => onValue(calc.toNumber(event.target.value)),
    });
  }

  function colour(value, onValue) {
    return h('input', {
      type: 'color',
      value: value || '#2f6f4f',
      oninput: (event) => onValue(event.target.value),
      onchange: (event) => onValue(event.target.value),
    });
  }

  function select(options, value, onValue) {
    return h('select', { onchange: (event) => onValue(event.target.value) }, options.map((option) =>
      h('option', { value: option.value, text: option.label, selected: option.value === value }),
    ));
  }

  function textarea(value, onValue, placeholder) {
    return h('textarea', { placeholder: placeholder ?? '', onchange: (event) => onValue(event.target.value) }, [value ?? '']);
  }

  function stat(label, value) {
    return h('div', { class: 'kpi', style: 'box-shadow:none' }, [
      h('div', { class: 'kpi__label', text: label }),
      h('div', { class: 'kpi__value', style: 'font-size:20px', text: String(value) }),
    ]);
  }

  root.MarginDesk.views = root.MarginDesk.views || {};
  root.MarginDesk.views.settings = { title: 'Settings', render };
})(typeof self !== 'undefined' ? self : this);
