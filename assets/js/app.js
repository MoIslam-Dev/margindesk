/**
 * MarginDesk — application shell.
 *
 * Hash routing, the sidebar, the modal/toast/print helpers, and the context
 * object every view receives. No framework: the whole app is these small files
 * loaded by index.html in order.
 */
(function (root) {
  'use strict';

  const util = root.MarginDesk.util;
  const calc = root.MarginDeskCalc;
  const h = util.h;

  const store = root.MarginDeskStore.createStore({ seed: () => root.MarginDeskSeed.buildState() });

  const NAV = [
    { key: '', hash: '#/', label: 'Dashboard' },
    { key: 'clients', hash: '#/clients', label: 'Clients', count: () => store.clients().length },
    { key: 'quotes', hash: '#/quotes', label: 'Quotes', count: () => store.quotes().filter((quote) => ['draft', 'sent'].includes(quote.status)).length },
    { key: 'projects', hash: '#/projects', label: 'Projects', count: () => store.projects().filter((project) => project.status === 'active').length },
    { key: 'reports', hash: '#/reports', label: 'Reports' },
    { key: 'settings', hash: '#/settings', label: 'Settings' },
  ];

  const dom = {
    nav: document.getElementById('nav'),
    view: document.getElementById('view'),
    title: document.getElementById('pageTitle'),
    subtitle: document.getElementById('pageSubtitle'),
    actions: document.getElementById('pageActions'),
    brandName: document.getElementById('brandName'),
    brandSub: document.getElementById('brandSub'),
    brandMark: document.getElementById('brandMark'),
    sidebarFoot: document.getElementById('sidebarFoot'),
    modal: document.getElementById('modal'),
    modalForm: document.getElementById('modalForm'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalError: document.getElementById('modalError'),
    modalSubmit: document.getElementById('modalSubmit'),
    toasts: document.getElementById('toasts'),
  };

  /* ---------------------------------------------------------------- routing */

  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#/, '');
    const question = raw.indexOf('?');
    const pathPart = question === -1 ? raw : raw.slice(0, question);
    const queryPart = question === -1 ? '' : raw.slice(question + 1);
    const segments = pathPart.split('/').filter(Boolean);
    const query = {};
    for (const [key, value] of new URLSearchParams(queryPart)) {
      if (key) query[key] = value;
    }
    return { area: segments[0] || '', id: segments[1] || '', mode: segments[2] || '', segments, query };
  }

  function currentKey() {
    const { area, id } = parseRoute();
    return area === '' ? '' : `${area}${id ? `:${id}` : ''}`;
  }

  function navigate(hash, options) {
    const target = hash.startsWith('#') ? hash : `#${hash}`;
    if (location.hash === target) {
      render();
      return;
    }
    if (options && options.replace) {
      history.replaceState(null, '', target);
      render();
      scrollTo({ top: 0 });
    } else {
      location.hash = target;
      render();
    }
  }

  function resolve(route) {
    const views = root.MarginDesk.views;
    const { area, id, mode } = route;

    if (area === '') return views.dashboard.render(ctx);
    if (area === 'clients') return id ? views.clients.detail(ctx, id) : views.clients.render(ctx);
    if (area === 'quotes') {
      if (id === 'new') return views.quotes.editor(ctx, null);
      if (!id) return views.quotes.render(ctx);
      if (mode === 'edit') return views.quotes.editor(ctx, store.quote(id));
      return views.quotes.detail(ctx, id);
    }
    if (area === 'projects') {
      if (id === 'new') return views.projects.editor(ctx, null);
      if (!id) return views.projects.render(ctx);
      if (mode === 'edit') return views.projects.editor(ctx, store.project(id));
      return views.projects.detail(ctx, id);
    }
    if (area === 'reports') return views.reports.render(ctx);
    if (area === 'settings') return views.settings.render(ctx);
    return notFound();
  }

  function notFound() {
    return {
      title: 'Page not found',
      subtitle: 'That link does not point anywhere in MarginDesk',
      content: h('div', { class: 'card' }, [
        h('div', { class: 'empty' }, [
          h('h3', { text: 'Nothing here' }),
          h('p', { text: 'The address may be from an older version, or the record was deleted.' }),
          h('a', { class: 'btn btn--primary', href: '#/', text: 'Go to dashboard' }),
        ]),
      ]),
    };
  }

  /* ----------------------------------------------------------------- render */

  let lastTitle = '';

  let lastSignature = null;
  function render() {
    lastSignature = location.hash;
    const focusKey = document.activeElement ? document.activeElement.getAttribute?.('data-focus-key') : null;
    const selection = focusKey && document.activeElement.selectionStart;

    const settings = store.getSettings();
    const route = parseRoute();
    ctx.route = route;
    ctx.query = route.query;
    applyAccent(settings.accentColor);
    renderNav();
    renderBrand(settings);

    let result;
    try {
      result = resolve(route);
    } catch (error) {
      result = {
        title: 'Something went wrong',
        subtitle: String(error && error.message ? error.message : error),
        content: h('div', { class: 'card' }, [
          h('div', { class: 'empty' }, [
            h('h3', { text: 'This screen could not be drawn' }),
            h('p', { text: 'The rest of MarginDesk still works. Go back to the dashboard and try again.' }),
            h('a', { class: 'btn btn--primary', href: '#/', text: 'Go to dashboard' }),
          ]),
        ]),
      };
    }

    util.clear(dom.view);
    util.clear(dom.actions);
    util.clear(dom.title);
    dom.title.textContent = result.title || 'MarginDesk';
    dom.subtitle.textContent = result.subtitle || '';
    util.appendChildren(dom.actions, result.actions || []);
    util.appendChildren(dom.view, result.content);

    if (result.title !== lastTitle) {
      document.title = `${result.title} — MarginDesk`;
      lastTitle = result.title;
    }

    if (focusKey) {
      const target = dom.view.querySelector(`[data-focus-key="${focusKey}"]`);
      if (target) {
        target.focus();
        if (selection !== null && selection !== undefined && target.setSelectionRange) {
          try {
            target.setSelectionRange(selection, selection);
          } catch {
            /* search inputs on some browsers do not support selection */
          }
        }
      }
    }
  }

  function renderNav() {
    const key = currentKey().split(':')[0];
    util.clear(dom.nav);
    util.appendChildren(
      dom.nav,
      NAV.map((item) => {
        const count = item.count ? item.count() : null;
        return h('a', { class: `nav__link${key === item.key ? ' is-active' : ''}`, href: item.hash }, [
          h('span', { text: item.label }),
          count ? h('span', { class: 'nav__count', text: String(count) }) : null,
        ]);
      }),
    );
  }

  function renderBrand(settings) {
    const name = settings.businessName || 'MarginDesk';
    dom.brandName.textContent = name;
    dom.brandSub.textContent = 'Quotes & profitability';
    dom.brandMark.textContent = name.trim().charAt(0).toUpperCase() || 'M';
    util.clear(dom.sidebarFoot);
    util.appendChildren(dom.sidebarFoot, [
      h('div', { text: `Storage key margindesk.data.v1` }),
      h('div', { text: 'Data stays in this browser' }),
    ]);
  }

  function applyAccent(color) {
    const hex = String(color || '#2f6f4f');
    const rgb = hexToRgb(hex);
    const style = document.documentElement.style;
    style.setProperty('--accent', hex);
    style.setProperty('--accent-soft', rgb ? `rgba(${rgb}, 0.1)` : 'rgba(47, 111, 79, 0.1)');
    style.setProperty('--accent-strong', rgb ? `rgb(${Math.round(rgb.split(',').map((part) => Number(part) * 0.82).join(','))})` : '#245a40');
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!match) return null;
    return [match[1], match[2], match[3]].map((part) => Number.parseInt(part, 16)).join(',');
  }

  /* ---------------------------------------------------------------- context */

  const ctx = {
    store,
    route: parseRoute(),
    query: {},
    navigate,
    refresh: () => render(),
    toast,
    openModal,
    confirmDialog,
    printDocument,
  };

  /* ----------------------------------------------------------------- toasts */

  function toast(message, tone) {
    const node = h('div', { class: `toast${tone ? ` toast--${tone}` : ''}`, text: message });
    dom.toasts.append(node);
    setTimeout(() => {
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 200);
    }, tone === 'error' ? 6000 : 3200);
  }

  /* ------------------------------------------------------------------ modal */

  let closeModalHandler = null;

  function openModal(options) {
    dom.modalTitle.textContent = options.title || 'Dialog';
    dom.modalSubmit.textContent = options.submitLabel || 'Save';
    dom.modalSubmit.className = 'btn btn--primary';
    dom.modalError.hidden = true;
    dom.modalError.textContent = '';
    util.clear(dom.modalBody);
    util.appendChildren(dom.modalBody, buildFields(options.fields || []));

    closeModalHandler = (event) => {
      if (event && event.target && event.target.hasAttribute && event.target.hasAttribute('data-close')) closeModal();
    };
    dom.modal.onclick = closeModalHandler;
    dom.modal.hidden = false;

    const first = dom.modalBody.querySelector('input, select, textarea');
    if (first) first.focus();

    dom.modalForm.onsubmit = async (event) => {
      event.preventDefault();
      const values = readFields(options.fields || []);
      try {
        const result = options.onSubmit ? await options.onSubmit(values) : null;
        if (result === false) return;
        closeModal();
      } catch (error) {
        dom.modalError.textContent = String(error && error.message ? error.message : error);
        dom.modalError.hidden = false;
      }
    };
  }

  function closeModal() {
    dom.modal.hidden = true;
    dom.modal.onclick = null;
    dom.modalForm.onsubmit = null;
    util.clear(dom.modalBody);
  }

  function buildFields(fields) {
    return fields.map((spec) => {
      if (spec.type === 'checkbox') {
        return h('div', { class: 'field' }, [
          h('label', { class: 'checkbox' }, [
            h('input', { type: 'checkbox', name: spec.name, checked: spec.checked ?? Boolean(spec.value) }),
            h('span', { text: spec.label }),
          ]),
        ]);
      }
      if (spec.type === 'select') {
        return fieldWrapper(spec, h('select', { name: spec.name }, (spec.options || []).map((option) =>
          h('option', { value: option.value, text: option.label, selected: option.value === spec.value }),
        )));
      }
      if (spec.type === 'textarea') {
        return fieldWrapper(spec, h('textarea', { name: spec.name, placeholder: spec.placeholder || '', required: spec.required }, [spec.value ?? '']));
      }
      return fieldWrapper(
        spec,
        h('input', {
          type: spec.type || 'text',
          name: spec.name,
          value: spec.value ?? '',
          placeholder: spec.placeholder || '',
          step: spec.step,
          min: spec.min,
          max: spec.max,
          required: spec.required,
        }),
      );
    });
  }

  function fieldWrapper(spec, control) {
    return h('div', { class: 'field' }, [
      h('span', { class: 'field__label', text: spec.label }),
      control,
      spec.hint ? h('span', { class: 'field__hint', text: spec.hint }) : null,
    ]);
  }

  function readFields(fields) {
    const values = {};
    for (const spec of fields) {
      const node = dom.modalBody.querySelector(`[name="${spec.name}"]`);
      if (!node) continue;
      values[spec.name] = spec.type === 'checkbox' ? node.checked : node.value;
    }
    return values;
  }

  function confirmDialog(options) {
    openModal({
      title: options.title,
      submitLabel: options.confirmLabel || 'Confirm',
      fields: [],
      onSubmit: () => {
        if (options.onConfirm) options.onConfirm();
      },
    });
    util.clear(dom.modalBody);
    util.appendChildren(dom.modalBody, [h('p', { class: 'muted', text: options.message || '' })]);
    dom.modalSubmit.classList.remove('btn--primary');
    dom.modalSubmit.classList.add('btn--danger');
  }

  /* ------------------------------------------------------------------ print */

  const printBarLabel = h('span', { text: 'Preview' });
  const printContent = h('div', { class: 'print-preview__doc' });
  const printPreview = h('div', { class: 'print-preview' }, [
    h('div', { class: 'print-preview__bar' }, [
      printBarLabel,
      h('div', { class: 'btn-row' }, [
        h('button', {
          class: 'btn btn--primary',
          type: 'button',
          text: 'Print / Save as PDF',
          onclick: () => window.print(),
        }),
        h('button', { class: 'btn btn--ghost', type: 'button', text: 'Close', onclick: closePrint }),
      ]),
    ]),
    printContent,
  ]);

  function printDocument(node, label) {
    util.clear(printContent);
    printContent.append(node);
    printBarLabel.textContent = label || 'Preview';
    printPreview.classList.add('is-open');
    document.body.classList.add('is-printing');
    printPreview.scrollTop = 0;
  }

  function closePrint() {
    printPreview.classList.remove('is-open');
    document.body.classList.remove('is-printing');
    util.clear(printContent);
  }

  window.addEventListener('afterprint', closePrint);

  /* ------------------------------------------------------------------ wiring */

  function onKeydown(event) {
    if (event.key !== 'Escape') return;
    if (printPreview.classList.contains('is-open')) closePrint();
    else if (!dom.modal.hidden) closeModal();
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === lastSignature) return;
    render();
    scrollTo({ top: 0 });
  });
  window.addEventListener('keydown', onKeydown);

  document.body.append(printPreview);

  store.subscribe(() => {
    /* the views call ctx.refresh() themselves; this keeps other tabs in sync */
  });
  window.addEventListener('storage', (event) => {
    if (event.key === store.STORAGE_KEY) {
      location.reload();
    }
  });

  function syncShell() {
    renderBrand(store.getSettings());
  }

  root.MarginDeskApp = { store, render, refresh: render, navigate, applyAccent, syncShell, ctx };
  window.MarginDeskApp = root.MarginDeskApp;

  render();

  if (!location.hash) navigate('#/', { replace: true });
})(typeof self !== 'undefined' ? self : this);
