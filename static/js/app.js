/* Quiz-Ai — точка входа: переключение режимов, тема, ссылка на квиз. */
(function (global) {
  'use strict';
  var C = global.QuizCore;
  var S = global.QuizStorage;
  var B = global.QuizBuilder;
  var P = global.QuizPlayer;
  var UI = global.QuizUI;

  var LINK_WARN = 8000;   // мессенджеры и почта могут обрезать такие ссылки
  var LINK_MAX = 60000;   // практический предел, после которого ссылкой лучше не делиться

  var sharedMode = false;
  var sharedQuiz = null;

  function $(id) { return document.getElementById(id); }

  /* ---------- Тема ---------- */

  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function updateThemeButton() {
    var btn = $('theme-toggle');
    var dark = currentTheme() === 'dark';
    btn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    btn.setAttribute('title', dark ? 'Светлая тема' : 'Тёмная тема');
  }
  function initTheme() {
    $('theme-toggle').addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      S.setTheme(next);
      updateThemeButton();
    });
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', updateThemeButton);
    }
    updateThemeButton();
  }

  /* ---------- Режимы ---------- */

  function setMode(mode) {
    var isBuilder = mode === 'builder';
    $('view-builder').hidden = !isBuilder;
    $('view-player').hidden = isBuilder;
    $('tab-builder').setAttribute('aria-current', isBuilder ? 'page' : 'false');
    $('tab-player').setAttribute('aria-current', isBuilder ? 'false' : 'page');
    document.body.setAttribute('data-mode', mode);
    global.scrollTo(0, 0);
  }

  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); }
    catch (e) { location.hash = ''; }
  }

  function play(quiz, shared) {
    sharedMode = !!shared;
    sharedQuiz = shared ? quiz : null;
    $('shared-banner').hidden = !sharedMode;
    setMode('player');
    P.start(quiz);
    document.title = quiz.title + ' — Quiz-Ai';
  }

  function backToBuilder() {
    if (sharedMode && sharedQuiz) {
      if (global.confirm('Открыть этот квиз в конструкторе для редактирования?\nВаш текущий черновик будет заменён.')) {
        B.setQuiz(sharedQuiz);
      }
    }
    sharedMode = false;
    sharedQuiz = null;
    $('shared-banner').hidden = true;
    clearHash();
    document.title = 'Quiz-Ai — конструктор квизов';
    setMode('builder');
    $('tab-builder').focus();
  }

  /* ---------- Ссылка ---------- */

  function buildLink(quiz) {
    return location.href.split('#')[0] + '#quiz=' + C.encodeShare(quiz);
  }

  function share(quiz) {
    var url = buildLink(quiz);
    var box = $('share-box');
    var input = $('share-url');
    var warn = $('share-warning');
    input.value = url;
    box.hidden = false;
    warn.hidden = true;
    warn.textContent = '';
    if (url.length > LINK_MAX) {
      warn.textContent = 'Ссылка очень длинная (' + url.length + ' символов) и может не открыться. Сократите квиз или поделитесь JSON-файлом через «Экспорт JSON».';
      warn.hidden = false;
    } else if (url.length > LINK_WARN) {
      warn.textContent = 'Внимание: ссылка длинная (' + url.length + ' символов). Некоторые мессенджеры и почтовые клиенты могут её обрезать — тогда лучше отправить JSON-файл.';
      warn.hidden = false;
    }
    function fallback() {
      input.focus();
      input.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      UI.toast(ok ? 'Ссылка скопирована.' : 'Скопируйте ссылку из поля вручную (Ctrl+C).', ok ? 'success' : null);
    }
    if (navigator.clipboard && navigator.clipboard.writeText && global.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () {
        UI.toast('Ссылка скопирована в буфер обмена.', 'success');
      }, fallback);
    } else {
      fallback();
    }
    return url;
  }

  /* ---------- Запуск из ссылки ---------- */

  function handleHash() {
    var m = /^#quiz=(.+)$/.exec(location.hash);
    if (!m) return false;
    var res = C.decodeShare(m[1]);
    var errors = res.ok ? C.validateQuiz(res.quiz) : [];
    if (!res.ok || errors.length) {
      var list = res.ok ? errors.map(function (e) { return (e.q >= 0 ? 'Вопрос ' + (e.q + 1) + ': ' : '') + e.message; }) : res.errors;
      var box = $('builder-errors');
      UI.clear(box);
      box.appendChild(UI.el('p', { className: 'errors-title', text: 'Не удалось открыть квиз по ссылке:' }));
      var ul = UI.el('ul');
      list.slice(0, 8).forEach(function (t) { ul.appendChild(UI.el('li', { text: t })); });
      box.appendChild(ul);
      box.hidden = false;
      clearHash();
      setMode('builder');
      return false;
    }
    play(res.quiz, true);
    return true;
  }

  function init() {
    initTheme();
    P.init($('player-root'), { onExit: backToBuilder });
    B.init({
      onPlay: function (quiz) { play(quiz, false); },
      onShare: share
    });
    $('tab-builder').addEventListener('click', function () {
      if (document.body.getAttribute('data-mode') !== 'builder') backToBuilder();
    });
    $('tab-player').addEventListener('click', function () {
      if (document.body.getAttribute('data-mode') === 'player') return;
      if (B.validateAndReport()) play(B.getQuiz(), false);
    });
    $('share-copy').addEventListener('click', function () { if (B.validateAndReport()) share(B.getQuiz()); });
    $('share-close').addEventListener('click', function () { $('share-box').hidden = true; $('btn-share').focus(); });
    global.addEventListener('hashchange', handleHash);
    if (!handleHash()) setMode('builder');
  }

  global.QuizApp = { buildLink: buildLink, share: share, play: play, backToBuilder: backToBuilder, handleHash: handleHash };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
