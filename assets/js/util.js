/**
 * Small DOM + formatting helpers shared by every MarginDesk view.
 * No framework, no build step — just less typing.
 */
(function (root) {
  'use strict';

  const calc = root.MarginDeskCalc;

  /** Create an element. `text` sets textContent, `html` sets innerHTML. */
  function h(tag, attrs, children) {
    const attributes = attrs || {};
    const node = document.createElement(tag);
    for (const key in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, key)) continue;
      const value = attributes[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'value' && 'value' in node) node.value = value;
      else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden' || key === 'multiple') {
        if (value) node.setAttribute(key, '');
        if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'multiple') node[key] = Boolean(value);
      } else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, value);
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined || children === false) return node;
    if (Array.isArray(children)) {
      for (const child of children) appendChildren(node, child);
      return node;
    }
    node.append(children instanceof Node ? children : document.createTextNode(String(children)));
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  let counter = 0;
  function uid(prefix) {
    counter += 1;
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix || 'id'}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
  }

  function todayIso() {
    return calc.todayIso();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced() {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function money(value, currency, options) {
    return calc.formatMoney(value, currency, options);
  }

  function percent(value, decimals) {
    return calc.formatPercent(value, decimals);
  }

  function hours(value) {
    return calc.formatHours(value);
  }

  function date(isoDate) {
    return calc.formatDate(isoDate);
  }

  /** "in 3 days" / "5 days ago" / "today" */
  function relativeDay(isoDate) {
    if (!isoDate) return '—';
    const days = calc.daysUntil(isoDate) ?? 0;
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
  }

  function initials(name) {
    return String(name ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  }

  /** A <span> whose colour reflects the sign of a margin percentage. */
  function marginBadge(value, currency, target) {
    const numeric = calc.toNumber(value);
    const tone =
      numeric >= (target ?? 55) ? 'good' : numeric >= 35 ? 'warn' : 'bad';
    return h('span', { class: `badge badge--${tone}`, text: percent(numeric) });
  }

  function statusBadge(status, label) {
    return h('span', { class: `badge badge--status-${status}`, text: label ?? status });
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime ?? 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  root.MarginDesk = root.MarginDesk || {};
  root.MarginDesk.util = {
    h,
    clear,
    appendChildren,
    $,
    $$,
    uid,
    todayIso,
    nowIso,
    debounce,
    money,
    percent,
    hours,
    date,
    relativeDay,
    initials,
    marginBadge,
    statusBadge,
    downloadFile,
    escapeHtml,
  };
})(typeof self !== 'undefined' ? self : this);
