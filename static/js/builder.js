/* Quiz-Ai — режим «Конструктор». Экспортирует QuizBuilder. */
(function (global) {
  'use strict';
  var C = global.QuizCore;
  var S = global.QuizStorage;
  var el = global.QuizUI.el;
  var clear = global.QuizUI.clear;

  var quiz = C.createEmptyQuiz();
  var showValidation = false;
  var saveTimer = null;
  var dom = {};

  function $(id) { return document.getElementById(id); }

  /* ---------- Сохранение ---------- */

  function saveNow() {
    clearTimeout(saveTimer);
    var ok = S.saveDraft(quiz);
    if (dom.saveStatus) dom.saveStatus.textContent = ok ? 'Черновик сохранён' : 'Не удалось сохранить в localStorage';
  }
  function scheduleSave() {
    if (dom.saveStatus) dom.saveStatus.textContent = 'Сохранение…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
  function changed() {
    scheduleSave();
    refreshErrors();
  }

  /* ---------- Ошибки ---------- */

  function refreshErrors() {
    var errors = C.validateQuiz(quiz);
    var byQ = {};
    errors.forEach(function (e) { (byQ[e.q] = byQ[e.q] || []).push(e.message); });

    var cards = dom.list.querySelectorAll('.q-card');
    Array.prototype.forEach.call(cards, function (card, i) {
      var box = card.querySelector('.q-errors');
      clear(box);
      var msgs = showValidation ? (byQ[i] || []) : [];
      msgs.forEach(function (m) { box.appendChild(el('li', { text: m })); });
      box.hidden = msgs.length === 0;
      card.classList.toggle('has-error', msgs.length > 0);
    });

    dom.titleInput.setAttribute('aria-invalid', showValidation && !quiz.title.trim() ? 'true' : 'false');

    clear(dom.errors);
    if (showValidation && errors.length) {
      dom.errors.appendChild(el('p', { className: 'errors-title', text: 'Квиз пока нельзя пройти — исправьте ошибки (' + errors.length + '):' }));
      var ul = el('ul');
      errors.slice(0, 12).forEach(function (e) {
        ul.appendChild(el('li', { text: (e.q >= 0 ? 'Вопрос ' + (e.q + 1) + ': ' : '') + e.message }));
      });
      if (errors.length > 12) ul.appendChild(el('li', { text: '…и ещё ' + (errors.length - 12) + '.' }));
      dom.errors.appendChild(ul);
      dom.errors.hidden = false;
    } else {
      dom.errors.hidden = true;
    }
    return errors;
  }

  /** Включает показ ошибок; возвращает true, если квиз корректен. */
  function validateAndReport() {
    showValidation = true;
    var errors = refreshErrors();
    if (errors.length) {
      var firstQ = errors[0].q;
      var target = firstQ >= 0 ? dom.list.querySelectorAll('.q-card')[firstQ] : (quiz.title.trim() ? dom.btnAdd : dom.titleInput);
      if (target) {
        if (target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        var f = target.matches && target.matches('input, button, textarea, select') ? target : target.querySelector('textarea, input, select');
        if (f) f.focus({ preventScroll: true });
      }
      return false;
    }
    return true;
  }

  /* ---------- Рендер вопросов ---------- */

  function field(labelText, control, hint) {
    var id = control.id || C.uid('f');
    control.id = id;
    var children = [el('label', { 'for': id, className: 'field-label', text: labelText }), control];
    if (hint) {
      var hid = id + '-hint';
      control.setAttribute('aria-describedby', hid);
      children.push(el('p', { className: 'hint', id: hid, text: hint }));
    }
    return el('div', { className: 'field' }, children);
  }

  function iconButton(text, label, onClick, disabled, extraClass) {
    return el('button', {
      type: 'button', className: 'btn btn-icon' + (extraClass ? ' ' + extraClass : ''),
      'aria-label': label, title: label, text: text, disabled: !!disabled, onclick: onClick
    });
  }

  function renderChoiceEditor(q, qi) {
    var isSingle = q.type === 'single';
    var fs = el('fieldset', { className: 'subfield' }, [
      el('legend', { text: 'Варианты ответа' }),
      el('p', { className: 'hint', text: isSingle ? 'Отметьте один правильный вариант.' : 'Отметьте все правильные варианты (можно несколько).' })
    ]);
    var list = el('div', { className: 'options' });
    q.options.forEach(function (o, oi) {
      var mark = el('input', {
        type: isSingle ? 'radio' : 'checkbox',
        name: 'correct-' + q.id,
        className: 'correct-mark',
        checked: !!o.correct,
        'aria-label': 'Правильный ответ: вариант ' + (oi + 1),
        'data-role': 'option-correct', 'data-idx': oi,
        onchange: function (ev) {
          if (isSingle) q.options.forEach(function (x) { x.correct = false; });
          o.correct = ev.target.checked;
          changed();
        }
      });
      var input = el('input', {
        type: 'text', className: 'input', value: o.text, maxlength: C.LIMITS.option,
        placeholder: 'Вариант ' + (oi + 1),
        'aria-label': 'Текст варианта ' + (oi + 1),
        'data-role': 'option-text', 'data-idx': oi,
        oninput: function (ev) { o.text = ev.target.value; changed(); }
      });
      var del = iconButton('✕', 'Удалить вариант ' + (oi + 1), function () {
        q.options.splice(oi, 1);
        structural('[data-qid="' + q.id + '"] [data-role="option-text"][data-idx="' + Math.max(0, oi - 1) + '"]');
      }, false, 'btn-danger-ghost');
      list.appendChild(el('div', { className: 'option-row' }, [
        el('label', { className: 'correct-wrap', title: 'Правильный ответ' }, [mark, el('span', { className: 'sr-only', text: 'Правильный' })]),
        input, del
      ]));
    });
    fs.appendChild(list);
    fs.appendChild(el('button', {
      type: 'button', className: 'btn btn-ghost btn-small', text: '+ Добавить вариант',
      disabled: q.options.length >= C.LIMITS.options,
      onclick: function () {
        q.options.push(C.createOption('', false));
        structural('[data-qid="' + q.id + '"] [data-role="option-text"][data-idx="' + (q.options.length - 1) + '"]');
      }
    }));
    return fs;
  }

  function renderNumberEditor(q) {
    var answer = el('input', {
      type: 'text', inputmode: 'decimal', className: 'input', autocomplete: 'off',
      value: typeof q.answer === 'number' && isFinite(q.answer) ? C.formatNumber(q.answer) : '',
      placeholder: 'Например, 42 или 3,14',
      oninput: function (ev) {
        var p = C.parseNumber(ev.target.value);
        q.answer = p.empty ? null : p.value;
        changed();
      }
    });
    var tol = el('input', {
      type: 'text', inputmode: 'decimal', className: 'input', autocomplete: 'off',
      value: q.tolerance ? C.formatNumber(q.tolerance) : '',
      placeholder: '0',
      oninput: function (ev) {
        var p = C.parseNumber(ev.target.value);
        q.tolerance = p.empty ? 0 : p.value;
        changed();
      }
    });
    return el('fieldset', { className: 'subfield' }, [
      el('legend', { text: 'Числовой ответ' }),
      el('div', { className: 'grid-2' }, [
        field('Правильный ответ', answer),
        field('Допустимая погрешность ±', tol, 'Необязательно. Например, 0,5 — засчитается ответ от X−0,5 до X+0,5.')
      ])
    ]);
  }

  function renderWordEditor(q) {
    var fs = el('fieldset', { className: 'subfield' }, [
      el('legend', { text: 'Правильное слово' }),
      el('p', { className: 'hint', text: 'Одно слово без пробелов. Можно добавить альтернативные варианты, которые тоже засчитываются.' })
    ]);
    var list = el('div', { className: 'options' });
    q.words.forEach(function (w, wi) {
      var input = el('input', {
        type: 'text', className: 'input', value: w, maxlength: C.LIMITS.word, autocomplete: 'off', spellcheck: 'false',
        placeholder: wi === 0 ? 'Основной ответ' : 'Альтернативный вариант',
        'aria-label': wi === 0 ? 'Правильное слово' : 'Альтернативный вариант ' + wi,
        'data-role': 'word', 'data-idx': wi,
        oninput: function (ev) { q.words[wi] = ev.target.value; changed(); }
      });
      var row = [el('span', { className: 'word-tag', 'aria-hidden': 'true', text: wi === 0 ? 'Ответ' : 'Или' }), input];
      if (wi > 0) {
        row.push(iconButton('✕', 'Удалить альтернативный вариант ' + wi, function () {
          q.words.splice(wi, 1);
          structural('[data-qid="' + q.id + '"] [data-role="word"][data-idx="' + (wi - 1) + '"]');
        }, false, 'btn-danger-ghost'));
      } else {
        row.push(el('span', { className: 'btn-icon-placeholder', 'aria-hidden': 'true' }));
      }
      list.appendChild(el('div', { className: 'option-row' }, row));
    });
    fs.appendChild(list);
    fs.appendChild(el('button', {
      type: 'button', className: 'btn btn-ghost btn-small', text: '+ Добавить вариант слова',
      disabled: q.words.length >= C.LIMITS.words,
      onclick: function () {
        q.words.push('');
        structural('[data-qid="' + q.id + '"] [data-role="word"][data-idx="' + (q.words.length - 1) + '"]');
      }
    }));
    var cs = el('input', {
      type: 'checkbox', id: 'cs-' + q.id, checked: !!q.caseSensitive,
      onchange: function (ev) { q.caseSensitive = ev.target.checked; changed(); }
    });
    fs.appendChild(el('div', { className: 'check-field' }, [
      cs, el('label', { 'for': 'cs-' + q.id, text: 'Учитывать регистр букв (например, «Москва» ≠ «москва»)' })
    ]));
    return fs;
  }

  function renderCard(q, qi, n) {
    var typeSelect = el('select', {
      className: 'input', 'data-role': 'type',
      onchange: function (ev) {
        C.changeType(q, ev.target.value);
        structural('[data-qid="' + q.id + '"] [data-role="type"]');
      }
    });
    C.TYPES.forEach(function (t) {
      var opt = el('option', { value: t, text: C.TYPE_LABELS[t] });
      if (t === q.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });

    var points = el('input', {
      type: 'number', min: '0', step: 'any', className: 'input', value: String(q.points),
      oninput: function (ev) {
        var p = C.parseNumber(ev.target.value);
        q.points = p.empty ? NaN : p.value;
        changed();
      }
    });
    var text = el('textarea', {
      className: 'input', rows: '2', maxlength: C.LIMITS.text, placeholder: 'Например: Сколько планет в Солнечной системе?',
      'data-role': 'text',
      oninput: function (ev) { q.text = ev.target.value; changed(); }
    });
    text.value = q.text;
    var expl = el('textarea', {
      className: 'input', rows: '2', maxlength: C.LIMITS.explanation, placeholder: 'Покажется в разборе после ответа',
      oninput: function (ev) { q.explanation = ev.target.value; changed(); }
    });
    expl.value = q.explanation;

    var editor;
    if (q.type === 'number') editor = renderNumberEditor(q);
    else if (q.type === 'word') editor = renderWordEditor(q);
    else editor = renderChoiceEditor(q, qi);

    var errorsId = 'err-' + q.id;
    var head = el('div', { className: 'q-head' }, [
      el('h3', { className: 'q-title', id: 'qt-' + q.id }, [
        el('span', { className: 'q-num', text: 'Вопрос ' + (qi + 1) }),
        el('span', { className: 'badge', text: C.TYPE_LABELS[q.type] })
      ]),
      el('div', { className: 'q-tools' }, [
        iconButton('↑', 'Переместить вопрос ' + (qi + 1) + ' вверх', function () { move(qi, -1); }, qi === 0, 'js-up'),
        iconButton('↓', 'Переместить вопрос ' + (qi + 1) + ' вниз', function () { move(qi, 1); }, qi === n - 1, 'js-down'),
        iconButton('✕', 'Удалить вопрос ' + (qi + 1), function () { removeQuestion(qi); }, false, 'btn-danger-ghost')
      ])
    ]);

    return el('article', { className: 'card q-card', 'data-qid': q.id, 'aria-labelledby': 'qt-' + q.id, 'aria-describedby': errorsId }, [
      head,
      el('div', { className: 'grid-q' }, [field('Тип вопроса', typeSelect), field('Баллы', points)]),
      field('Текст вопроса', text),
      editor,
      field('Пояснение (необязательно)', expl),
      el('ul', { className: 'q-errors', id: errorsId, hidden: true })
    ]);
  }

  function renderQuestions(focusSelector) {
    clear(dom.list);
    quiz.questions.forEach(function (q, i) {
      dom.list.appendChild(renderCard(q, i, quiz.questions.length));
    });
    dom.empty.hidden = quiz.questions.length > 0;
    dom.count.textContent = quiz.questions.length
      ? quiz.questions.length + ' ' + C.plural(quiz.questions.length, 'вопрос', 'вопроса', 'вопросов')
      : '';
    refreshErrors();
    if (focusSelector) {
      var f = dom.list.querySelector(focusSelector);
      if (f) f.focus();
    }
  }

  function structural(focusSelector) {
    scheduleSave();
    renderQuestions(focusSelector);
  }

  /* ---------- Действия ---------- */

  function addQuestion(type) {
    if (quiz.questions.length >= C.LIMITS.questions) {
      global.QuizUI.toast('Достигнут лимит: ' + C.LIMITS.questions + ' вопросов.', 'error');
      return;
    }
    var q = C.createQuestion(type);
    quiz.questions.push(q);
    structural('[data-qid="' + q.id + '"] [data-role="text"]');
    var card = dom.list.querySelector('[data-qid="' + q.id + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center' });
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= quiz.questions.length) return;
    var tmp = quiz.questions[i];
    quiz.questions[i] = quiz.questions[j];
    quiz.questions[j] = tmp;
    var id = tmp.id;
    var cls = dir < 0 ? (j === 0 ? '.js-down' : '.js-up') : (j === quiz.questions.length - 1 ? '.js-up' : '.js-down');
    structural('[data-qid="' + id + '"] ' + cls);
    global.QuizUI.toast('Вопрос перемещён на позицию ' + (j + 1) + '.');
  }

  function removeQuestion(i) {
    var q = quiz.questions[i];
    var label = q.text.trim() ? '«' + q.text.trim().slice(0, 60) + '»' : (i + 1);
    if (!global.confirm('Удалить вопрос ' + label + '?')) return;
    quiz.questions.splice(i, 1);
    var next = quiz.questions[Math.min(i, quiz.questions.length - 1)];
    structural(next ? '[data-qid="' + next.id + '"] [data-role="text"]' : null);
    if (!next) dom.btnAdd.focus();
    global.QuizUI.toast('Вопрос удалён.');
  }

  function setQuiz(newQuiz) {
    quiz = newQuiz;
    showValidation = false;
    dom.titleInput.value = quiz.title;
    dom.descInput.value = quiz.description;
    saveNow();
    renderQuestions();
  }

  function confirmReplace(msg) {
    var hasContent = quiz.questions.length > 0 || quiz.title.trim() || quiz.description.trim();
    return !hasContent || global.confirm(msg);
  }

  function exportFile() {
    var json = JSON.stringify(C.exportQuiz(quiz), null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var name = (quiz.title.trim() || 'quiz').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'quiz';
    var a = el('a', { href: URL.createObjectURL(blob), download: name + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    global.QuizUI.toast('Квиз экспортирован в файл ' + name + '.json');
    return json;
  }

  function showImportErrors(errors) {
    clear(dom.errors);
    dom.errors.appendChild(el('p', { className: 'errors-title', text: 'Не удалось импортировать квиз:' }));
    var ul = el('ul');
    errors.slice(0, 10).forEach(function (m) { ul.appendChild(el('li', { text: m })); });
    if (errors.length > 10) ul.appendChild(el('li', { text: '…и ещё ' + (errors.length - 10) + '.' }));
    dom.errors.appendChild(ul);
    dom.errors.hidden = false;
    global.QuizUI.toast('Импорт не выполнен — см. ошибки.', 'error');
    return { ok: false, errors: errors };
  }

  /** Импорт из текста JSON. Возвращает {ok, errors}. */
  function importText(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) {
      return showImportErrors(['Файл не является корректным JSON.']);
    }
    var res = C.importQuiz(data);
    if (!res.ok) return showImportErrors(res.errors);
    if (!confirmReplace('Заменить текущий квиз импортированным?')) return { ok: false, errors: ['Отменено.'] };
    setQuiz(res.quiz);
    global.QuizUI.toast('Квиз импортирован: ' + res.quiz.questions.length + ' ' + C.plural(res.quiz.questions.length, 'вопрос', 'вопроса', 'вопросов') + '.', 'success');
    return res;
  }

  function init(opts) {
    dom.titleInput = $('quiz-title');
    dom.descInput = $('quiz-desc');
    dom.list = $('questions');
    dom.empty = $('empty-state');
    dom.errors = $('builder-errors');
    dom.count = $('question-count');
    dom.saveStatus = $('save-status');
    dom.btnAdd = $('btn-add');

    dom.titleInput.maxLength = C.LIMITS.title;
    dom.descInput.maxLength = C.LIMITS.description;
    dom.titleInput.addEventListener('input', function () { quiz.title = dom.titleInput.value; changed(); });
    dom.descInput.addEventListener('input', function () { quiz.description = dom.descInput.value; changed(); });

    dom.btnAdd.addEventListener('click', function () { addQuestion($('add-type').value); });
    $('btn-sample').addEventListener('click', function () {
      if (!confirmReplace('Загрузить пример? Текущий квиз будет заменён.')) return;
      setQuiz(C.sampleQuiz());
      global.QuizUI.toast('Пример загружен: 4 вопроса всех типов.', 'success');
    });
    $('btn-new').addEventListener('click', function () {
      if (!confirmReplace('Начать новый квиз? Текущий будет удалён.')) return;
      setQuiz(C.createEmptyQuiz());
      dom.titleInput.focus();
    });
    $('btn-export').addEventListener('click', exportFile);
    var file = $('file-import');
    $('btn-import').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { showImportErrors(['Файл слишком большой (максимум 2 МБ).']); file.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () { importText(String(reader.result)); file.value = ''; };
      reader.onerror = function () { global.QuizUI.toast('Не удалось прочитать файл.', 'error'); };
      reader.readAsText(f, 'utf-8');
    });
    $('btn-play').addEventListener('click', function () { if (validateAndReport()) opts.onPlay(quiz); });
    $('btn-share').addEventListener('click', function () { if (validateAndReport()) opts.onShare(quiz); });

    var draft = S.loadDraft();
    if (draft) setQuiz(draft); else { setQuiz(C.createEmptyQuiz()); }
  }

  global.QuizBuilder = {
    init: init,
    getQuiz: function () { return quiz; },
    setQuiz: setQuiz,
    addQuestion: addQuestion,
    importText: importText,
    exportFile: exportFile,
    validateAndReport: validateAndReport,
    render: renderQuestions
  };
})(window);
