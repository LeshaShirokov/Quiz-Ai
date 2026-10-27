/* Quiz-Ai — режим «Прохождение». Экспортирует QuizPlayer. */
(function (global) {
  'use strict';
  var C = global.QuizCore;
  var el = global.QuizUI.el;
  var clear = global.QuizUI.clear;

  var root = null;
  var opts = {};
  var state = null;

  function pointsLabel(n) { return C.formatNumber(n) + ' ' + C.plural(n, 'балл', 'балла', 'баллов'); }

  function start(quiz, options) {
    opts = options || opts || {};
    state = {
      quiz: quiz,
      index: 0,
      raw: quiz.questions.map(function (q) { return q.type === 'multiple' ? [] : (q.type === 'single' ? null : ''); }),
      values: quiz.questions.map(function () { return null; }),
      result: null
    };
    renderQuestion();
  }

  function heading(quiz) {
    var children = [el('h2', { className: 'quiz-title', text: quiz.title })];
    if (quiz.description && state.index === 0 && !state.result) {
      children.push(el('p', { className: 'quiz-desc', text: quiz.description }));
    }
    return el('header', { className: 'player-head' }, children);
  }

  function progress(i, n) {
    var pct = Math.round(((i + 1) / n) * 100);
    var bar = el('div', {
      className: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n),
      'aria-valuenow': String(i + 1), 'aria-label': 'Прогресс прохождения: вопрос ' + (i + 1) + ' из ' + n
    }, [el('div', { className: 'progress-bar', style: 'width:' + pct + '%' })]);
    return el('div', { className: 'progress-wrap' }, [
      el('div', { className: 'progress-meta' }, [
        el('span', { text: 'Вопрос ' + (i + 1) + ' из ' + n }),
        el('span', { text: pointsLabel(state.quiz.questions[i].points) })
      ]),
      bar
    ]);
  }

  /** Считывает текущий ввод в state.raw[index]. */
  function readInput(form, q) {
    var i = state.index;
    if (q.type === 'single') {
      var checked = form.querySelector('input[name="answer"]:checked');
      state.raw[i] = checked ? checked.value : null;
    } else if (q.type === 'multiple') {
      state.raw[i] = Array.prototype.map.call(form.querySelectorAll('input[name="answer"]:checked'), function (x) { return x.value; });
    } else {
      state.raw[i] = form.querySelector('[name="answer"]').value;
    }
  }

  function renderQuestion() {
    var quiz = state.quiz;
    var i = state.index;
    var n = quiz.questions.length;
    var q = quiz.questions[i];
    clear(root);

    var msgId = 'answer-msg';
    var msg = el('p', { className: 'answer-msg', id: msgId, role: 'alert', 'aria-live': 'assertive' });
    var qTitleId = 'q-text';
    var body;

    if (q.type === 'single' || q.type === 'multiple') {
      var isSingle = q.type === 'single';
      var choicesBox = el('div', { className: 'choices' });
      q.options.forEach(function (o, oi) {
        var id = 'ans-' + oi;
        var checked = isSingle ? state.raw[i] === o.id : state.raw[i].indexOf(o.id) !== -1;
        choicesBox.appendChild(el('label', { className: 'choice', 'for': id }, [
          el('input', { type: isSingle ? 'radio' : 'checkbox', name: 'answer', id: id, value: o.id, checked: checked,
            onchange: function () { msg.textContent = ''; } }),
          el('span', { className: 'choice-text', text: o.text })
        ]));
      });
      body = el('fieldset', { className: 'answer-group', 'aria-describedby': msgId }, [
        el('legend', { className: 'sr-only', text: q.text }),
        el('p', { className: 'hint', text: isSingle ? 'Выберите один вариант.' : 'Выберите все правильные варианты.' }),
        choicesBox
      ]);
    } else {
      var isNum = q.type === 'number';
      var input = el('input', {
        type: 'text', name: 'answer', id: 'answer-input', className: 'input input-lg', value: state.raw[i] || '',
        autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
        inputmode: isNum ? 'decimal' : 'text',
        placeholder: isNum ? 'Например, 42 или 3,14' : 'Одно слово',
        'aria-describedby': msgId + ' answer-hint',
        oninput: function (ev) {
          // Мгновенная подсказка для слова с пробелом
          if (!isNum && C.hasWhitespace(ev.target.value.trim())) {
            msg.textContent = 'Ответ должен быть одним словом без пробелов.';
            ev.target.setAttribute('aria-invalid', 'true');
          } else {
            msg.textContent = '';
            ev.target.removeAttribute('aria-invalid');
          }
        }
      });
      var hint = isNum
        ? 'Введите число. Дробную часть можно отделять запятой или точкой.' +
          (q.tolerance > 0 ? ' Допускается погрешность ±' + C.formatNumber(q.tolerance) + '.' : '')
        : 'Введите одно слово без пробелов.' + (q.caseSensitive ? ' Регистр букв важен.' : '');
      body = el('div', { className: 'field' }, [
        el('label', { 'for': 'answer-input', className: 'field-label', text: isNum ? 'Ваш ответ (число)' : 'Ваш ответ (слово)' }),
        input,
        el('p', { className: 'hint', id: 'answer-hint', text: hint })
      ]);
    }

    var isLast = i === n - 1;
    var form = el('form', { className: 'card player-card', novalidate: true, 'aria-labelledby': qTitleId }, [
      progress(i, n),
      el('h3', { className: 'question-text', id: qTitleId, tabindex: '-1', text: q.text }),
      body,
      msg,
      el('div', { className: 'player-nav' }, [
        el('button', { type: 'button', className: 'btn btn-secondary', text: '← Назад', disabled: i === 0, 'data-role': 'back',
          onclick: function () { readInput(form, q); state.index -= 1; renderQuestion(); } }),
        el('button', { type: 'submit', className: 'btn btn-primary', 'data-role': 'next', text: isLast ? 'Завершить' : 'Далее →' })
      ])
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      readInput(form, q);
      var v = C.validateAnswer(q, state.raw[i]);
      if (!v.ok) {
        msg.textContent = '';
        setTimeout(function () { msg.textContent = v.message; }, 20);
        msg.textContent = v.message;
        var focusEl = form.querySelector('[name="answer"]');
        if (focusEl) { focusEl.setAttribute('aria-invalid', 'true'); focusEl.focus(); }
        return;
      }
      state.values[i] = v.value;
      if (isLast) finish(); else { state.index += 1; renderQuestion(); }
    });

    root.appendChild(heading(quiz));
    root.appendChild(form);
    var first = form.querySelector('[name="answer"]');
    var title = form.querySelector('.question-text');
    // На первом экране фокус на заголовке вопроса, далее — сразу на поле ответа
    if (i > 0 && first) first.focus({ preventScroll: true }); else if (title && i > 0) title.focus();
  }

  function finish() {
    state.result = C.score(state.quiz, state.values);
    renderResults();
  }

  function row(label, value, cls) {
    return el('div', { className: 'review-row' + (cls ? ' ' + cls : '') }, [
      el('span', { className: 'review-label', text: label }),
      el('span', { className: 'review-value', text: value })
    ]);
  }

  function renderResults() {
    var r = state.result;
    clear(root);
    var verdict = r.percent >= 90 ? 'Отлично!' : r.percent >= 70 ? 'Хороший результат!' : r.percent >= 40 ? 'Неплохо, но есть куда расти.' : 'Попробуйте ещё раз!';

    var summary = el('section', { className: 'card results-card', 'aria-labelledby': 'results-title' }, [
      el('h3', { id: 'results-title', className: 'results-title', tabindex: '-1', text: 'Результаты' }),
      el('div', { className: 'score-ring', style: '--p:' + r.percent }, [
        el('span', { className: 'score-percent', 'data-role': 'percent', text: C.formatNumber(r.percent) + '%' })
      ]),
      el('p', { className: 'score-main', 'data-role': 'score', text: C.formatNumber(r.earned) + ' из ' + pointsLabel(r.total) }),
      el('p', { className: 'score-sub', text: 'Правильных ответов: ' + r.correctCount + ' из ' + r.count + '. ' + verdict }),
      el('div', { className: 'results-actions' }, [
        el('button', { type: 'button', className: 'btn btn-primary', 'data-role': 'restart', text: 'Пройти заново',
          onclick: function () { start(state.quiz); var t = root.querySelector('.question-text'); if (t) t.focus(); } }),
        el('button', { type: 'button', className: 'btn btn-secondary', 'data-role': 'to-builder', text: 'Вернуться в конструктор',
          onclick: function () { if (opts.onExit) opts.onExit(); } })
      ])
    ]);

    var list = el('ol', { className: 'review-list', 'aria-label': 'Разбор ответов' });
    r.items.forEach(function (it, i) {
      var q = it.question;
      var children = [
        el('div', { className: 'review-head' }, [
          el('span', { className: 'status ' + (it.correct ? 'status-ok' : 'status-bad'), text: it.correct ? '✓ Верно' : '✗ Неверно' }),
          el('span', { className: 'review-points', text: C.formatNumber(it.earned) + ' / ' + pointsLabel(q.points) })
        ]),
        el('p', { className: 'review-q', text: (i + 1) + '. ' + q.text }),
        row('Ваш ответ:', C.formatUserAnswer(q, it.value), it.correct ? 'is-ok' : 'is-bad'),
        row('Правильный ответ:', C.formatCorrectAnswer(q), 'is-correct')
      ];
      if (q.explanation && q.explanation.trim()) {
        children.push(el('p', { className: 'review-expl' }, [el('strong', { text: 'Пояснение: ' }), q.explanation]));
      }
      list.appendChild(el('li', { className: 'card review-item ' + (it.correct ? 'is-correct' : 'is-wrong') }, children));
    });

    root.appendChild(heading(state.quiz));
    root.appendChild(summary);
    root.appendChild(el('h3', { className: 'section-title', text: 'Разбор ответов' }));
    root.appendChild(list);
    var t = root.querySelector('.results-title');
    if (t) t.focus();
  }

  global.QuizPlayer = {
    init: function (rootEl, options) { root = rootEl; opts = options || {}; },
    start: function (quiz, options) { if (options) { for (var k in options) opts[k] = options[k]; } start(quiz); },
    getState: function () { return state; }
  };
})(window);
