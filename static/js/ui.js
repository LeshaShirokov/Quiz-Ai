/* Quiz-Ai — безопасные DOM-хелперы. Весь пользовательский текст выводится
   только через textContent / свойства элементов, без innerHTML. */
(function (global) {
  'use strict';

  /**
   * el('div', {className: 'x', text: 'привет', onclick: fn, 'aria-label': '...'}, [children])
   */
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') node.textContent = String(v);
        else if (k === 'className') node.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled') node[k] = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  var toastTimer = null;
  /** Короткое сообщение в общей aria-live области. */
  function toast(message, kind) {
    var box = document.getElementById('toast');
    if (!box) return;
    box.textContent = '';
    box.className = 'toast is-visible' + (kind ? ' toast--' + kind : '');
    // Небольшая задержка, чтобы скринридеры гарантированно озвучили новое сообщение
    setTimeout(function () { box.textContent = message; }, 30);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 4500);
  }

  global.QuizUI = { el: el, clear: clear, toast: toast };
})(window);
