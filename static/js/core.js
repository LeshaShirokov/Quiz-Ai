/* Quiz-Ai — модель данных, валидация, проверка ответов, импорт/экспорт.
   Этот файл не работает с DOM. Экспортирует глобальный объект QuizCore. */
(function (global) {
  'use strict';

  var FORMAT = 'quiz-ai';
  var VERSION = 1;
  var TYPES = ['single', 'multiple', 'number', 'word'];
  var TYPE_LABELS = {
    single: 'Один вариант ответа',
    multiple: 'Несколько вариантов ответа',
    number: 'Число',
    word: 'Слово без пробелов'
  };
  var LIMITS = {
    title: 200, description: 2000, text: 2000, explanation: 2000,
    option: 500, word: 100, questions: 200, options: 20, words: 20, points: 1000
  };

  var counter = 0;
  function uid(prefix) {
    counter += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + counter.toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  function hasWhitespace(s) { return /\s/.test(String(s)); }

  function plural(n, one, few, many) {
    if (Math.floor(n) !== n) return few;
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function formatNumber(n) {
    if (!isFiniteNum(n)) return '';
    // Убираем артефакты плавающей точки (0.1 + 0.2) и используем запятую.
    var s = String(parseFloat(n.toPrecision(12)));
    return s.replace('.', ',');
  }

  /** Разбор числа из строки: допускает запятую как десятичный разделитель. */
  function parseNumber(input) {
    var s = String(input == null ? '' : input).trim().replace(/[\s\u00a0]/g, '').replace(',', '.');
    if (s === '') return { ok: false, empty: true, value: null };
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { ok: false, empty: false, value: NaN };
    var v = Number(s);
    if (!isFinite(v)) return { ok: false, empty: false, value: NaN };
    return { ok: true, empty: false, value: v };
  }

  function createOption(text, correct) {
    return { id: uid('o'), text: text || '', correct: !!correct };
  }

  function createQuestion(type) {
    if (TYPES.indexOf(type) === -1) type = 'single';
    return {
      id: uid('q'),
      type: type,
      text: '',
      points: 1,
      explanation: '',
      options: [createOption('', false), createOption('', false)],
      answer: null,
      tolerance: 0,
      words: [''],
      caseSensitive: false
    };
  }

  function createEmptyQuiz() {
    return { title: '', description: '', questions: [] };
  }

  /** Смена типа вопроса с сохранением общих полей. */
  function changeType(q, type) {
    if (TYPES.indexOf(type) === -1 || q.type === type) return;
    if (!Array.isArray(q.options) || q.options.length === 0) q.options = [createOption(), createOption()];
    if (type === 'single') {
      var found = false;
      q.options.forEach(function (o) {
        if (o.correct && !found) { found = true; } else { o.correct = false; }
      });
    }
    if (!Array.isArray(q.words) || q.words.length === 0) q.words = [''];
    if (!isFiniteNum(q.tolerance)) q.tolerance = 0;
    q.type = type;
  }

  /* ---------- Валидация квиза для прохождения ---------- */

  /**
   * Возвращает массив ошибок {q: индекс вопроса или -1, message}.
   * Пустой массив — квиз готов к прохождению.
   */
  function validateQuiz(quiz) {
    var errors = [];
    function add(qi, msg) { errors.push({ q: qi, message: msg }); }
    if (!quiz || !String(quiz.title || '').trim()) add(-1, 'Введите название квиза.');
    var qs = (quiz && quiz.questions) || [];
    if (qs.length === 0) add(-1, 'Добавьте хотя бы один вопрос.');
    qs.forEach(function (q, i) {
      if (!String(q.text || '').trim()) add(i, 'Введите текст вопроса.');
      if (!isFiniteNum(q.points) || q.points <= 0) add(i, 'Баллы должны быть числом больше 0.');
      else if (q.points > LIMITS.points) add(i, 'Баллы не могут быть больше ' + LIMITS.points + '.');
      if (q.type === 'single' || q.type === 'multiple') {
        var opts = q.options || [];
        if (opts.length < 2) add(i, 'Нужно минимум 2 варианта ответа.');
        var emptyIdx = [];
        var seen = {}, dup = false;
        opts.forEach(function (o, oi) {
          var t = String(o.text || '').trim();
          if (!t) emptyIdx.push(oi + 1);
          else {
            var key = t.toLowerCase();
            if (seen[key]) dup = true;
            seen[key] = true;
          }
        });
        if (emptyIdx.length) add(i, 'Заполните текст вариантов: ' + emptyIdx.join(', ') + '.');
        if (dup) add(i, 'Варианты ответа не должны повторяться.');
        var nCorrect = opts.filter(function (o) { return o.correct; }).length;
        if (nCorrect === 0) add(i, 'Отметьте хотя бы один правильный вариант.');
        if (q.type === 'single' && nCorrect > 1) add(i, 'В вопросе с одним ответом правильным может быть только один вариант.');
      } else if (q.type === 'number') {
        if (!isFiniteNum(q.answer)) add(i, 'Укажите правильный ответ числом (например, 42 или 3,14).');
        if (!isFiniteNum(q.tolerance) || q.tolerance < 0) add(i, 'Погрешность должна быть неотрицательным числом.');
      } else if (q.type === 'word') {
        var words = q.words || [];
        if (!String(words[0] || '').trim()) add(i, 'Укажите правильное слово.');
        words.forEach(function (w, wi) {
          var t = String(w || '').trim();
          if (wi > 0 && !t) add(i, 'Альтернативный вариант ' + wi + ' пуст — заполните или удалите его.');
          if (t && hasWhitespace(t)) add(i, 'Слово «' + t + '» содержит пробел — допустимо только одно слово без пробелов.');
        });
      } else {
        add(i, 'Неизвестный тип вопроса.');
      }
    });
    return errors;
  }

  /* ---------- Проверка ответов при прохождении ---------- */

  /** Проверка введённого ответа перед переходом к следующему вопросу. */
  function validateAnswer(q, raw) {
    if (q.type === 'single') {
      if (raw == null || raw === '') return { ok: false, message: 'Выберите один вариант ответа.' };
      return { ok: true, value: raw };
    }
    if (q.type === 'multiple') {
      if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: 'Выберите хотя бы один вариант ответа.' };
      return { ok: true, value: raw.slice() };
    }
    if (q.type === 'number') {
      var p = parseNumber(raw);
      if (p.empty) return { ok: false, message: 'Введите число.' };
      if (!p.ok) return { ok: false, message: 'Ответ должен быть числом, например 42 или 3,14.' };
      return { ok: true, value: p.value };
    }
    if (q.type === 'word') {
      var s = String(raw == null ? '' : raw).trim();
      if (!s) return { ok: false, message: 'Введите слово.' };
      if (hasWhitespace(s)) return { ok: false, message: 'Ответ должен быть одним словом без пробелов.' };
      return { ok: true, value: s };
    }
    return { ok: false, message: 'Неизвестный тип вопроса.' };
  }

  function normWord(w, caseSensitive) {
    var s = String(w == null ? '' : w).trim();
    return caseSensitive ? s : s.toLocaleLowerCase('ru');
  }

  /** Проверяет ответ (уже провалидированное значение). */
  function isCorrect(q, value) {
    if (value == null) return false;
    if (q.type === 'single') {
      return q.options.some(function (o) { return o.id === value && o.correct; });
    }
    if (q.type === 'multiple') {
      if (!Array.isArray(value)) return false;
      var correctIds = q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.id; });
      if (correctIds.length !== value.length) return false;
      return correctIds.every(function (id) { return value.indexOf(id) !== -1; });
    }
    if (q.type === 'number') {
      if (!isFiniteNum(value) || !isFiniteNum(q.answer)) return false;
      var tol = isFiniteNum(q.tolerance) && q.tolerance > 0 ? q.tolerance : 0;
      var eps = 1e-9 * Math.max(1, Math.abs(q.answer));
      return Math.abs(value - q.answer) <= tol + eps;
    }
    if (q.type === 'word') {
      var s = String(value).trim();
      if (!s || hasWhitespace(s)) return false;
      var a = normWord(s, q.caseSensitive);
      return (q.words || []).some(function (w) {
        return String(w || '').trim() !== '' && normWord(w, q.caseSensitive) === a;
      });
    }
    return false;
  }

  /** Подсчёт результатов. answers — массив провалидированных значений (или null). */
  function score(quiz, answers) {
    var total = 0, earned = 0, correctCount = 0;
    var items = quiz.questions.map(function (q, i) {
      var v = answers[i] == null ? null : answers[i];
      var ok = isCorrect(q, v);
      total += q.points;
      if (ok) { earned += q.points; correctCount += 1; }
      return { question: q, value: v, correct: ok, earned: ok ? q.points : 0 };
    });
    var percent = total > 0 ? Math.round((earned / total) * 1000) / 10 : 0;
    return { total: total, earned: earned, percent: percent, correctCount: correctCount, count: items.length, items: items };
  }

  function optionText(q, id) {
    for (var i = 0; i < q.options.length; i++) if (q.options[i].id === id) return q.options[i].text;
    return '';
  }

  function formatUserAnswer(q, value) {
    if (value == null) return '— нет ответа —';
    if (q.type === 'single') return optionText(q, value);
    if (q.type === 'multiple') {
      // В порядке вариантов вопроса
      return q.options.filter(function (o) { return value.indexOf(o.id) !== -1; })
        .map(function (o) { return o.text; }).join('; ');
    }
    if (q.type === 'number') return formatNumber(value);
    return String(value);
  }

  function formatCorrectAnswer(q) {
    if (q.type === 'single' || q.type === 'multiple') {
      return q.options.filter(function (o) { return o.correct; }).map(function (o) { return o.text; }).join('; ');
    }
    if (q.type === 'number') {
      var s = formatNumber(q.answer);
      if (isFiniteNum(q.tolerance) && q.tolerance > 0) s += ' (±' + formatNumber(q.tolerance) + ')';
      return s;
    }
    if (q.type === 'word') {
      var ws = (q.words || []).map(function (w) { return String(w).trim(); }).filter(Boolean);
      var s2 = ws.join(' / ');
      if (q.caseSensitive) s2 += ' (с учётом регистра)';
      return s2;
    }
    return '';
  }

  /* ---------- Экспорт / импорт JSON ---------- */

  function exportQuiz(quiz) {
    return {
      format: FORMAT,
      version: VERSION,
      title: String(quiz.title || ''),
      description: String(quiz.description || ''),
      questions: quiz.questions.map(function (q) {
        var out = { type: q.type, text: q.text, points: q.points };
        if (q.explanation) out.explanation = q.explanation;
        if (q.type === 'single' || q.type === 'multiple') {
          out.options = q.options.map(function (o) { return { text: o.text, correct: !!o.correct }; });
        } else if (q.type === 'number') {
          out.answer = isFiniteNum(q.answer) ? q.answer : null;
          out.tolerance = isFiniteNum(q.tolerance) ? q.tolerance : 0;
        } else if (q.type === 'word') {
          out.words = q.words.slice();
          out.caseSensitive = !!q.caseSensitive;
        }
        return out;
      })
    };
  }

  /**
   * Проверка схемы импортируемого JSON и нормализация в внутреннюю модель.
   * Возвращает {ok, quiz, errors[]}. Неизвестные поля отбрасываются.
   */
  function importQuiz(data) {
    var errors = [];
    function err(m) { if (errors.length < 50) errors.push(m); }
    function str(v, name, max, required) {
      if (v === undefined || v === null) { if (required) err(name + ': обязательное текстовое поле.'); return ''; }
      if (typeof v !== 'string') { err(name + ': должно быть строкой.'); return ''; }
      if (v.length > max) { err(name + ': слишком длинный текст (максимум ' + max + ' символов).'); return v.slice(0, max); }
      return v;
    }

    if (!isObj(data)) return { ok: false, quiz: null, errors: ['Файл должен содержать JSON-объект квиза.'] };
    if (data.format !== undefined && data.format !== FORMAT) err('Неизвестный формат файла: ожидается "' + FORMAT + '".');
    if (data.version !== undefined && data.version !== VERSION) err('Неподдерживаемая версия формата: ' + String(data.version).slice(0, 20) + '.');

    var quiz = createEmptyQuiz();
    quiz.title = str(data.title, 'Название квиза (title)', LIMITS.title, false);
    quiz.description = str(data.description, 'Описание (description)', LIMITS.description, false);

    if (!Array.isArray(data.questions)) {
      err('Поле "questions" должно быть массивом вопросов.');
    } else if (data.questions.length > LIMITS.questions) {
      err('Слишком много вопросов (максимум ' + LIMITS.questions + ').');
    } else {
      data.questions.forEach(function (src, i) {
        var p = 'Вопрос ' + (i + 1);
        if (!isObj(src)) { err(p + ': должен быть объектом.'); return; }
        if (TYPES.indexOf(src.type) === -1) {
          err(p + ': неизвестный тип "' + String(src.type).slice(0, 30) + '" (допустимо: ' + TYPES.join(', ') + ').');
          return;
        }
        var q = createQuestion(src.type);
        q.text = str(src.text, p + ', текст (text)', LIMITS.text, true);
        q.explanation = str(src.explanation, p + ', пояснение (explanation)', LIMITS.explanation, false);
        if (src.points === undefined) q.points = 1;
        else if (!isFiniteNum(src.points) || src.points < 0 || src.points > LIMITS.points) err(p + ': баллы (points) должны быть числом от 0 до ' + LIMITS.points + '.');
        else q.points = src.points;

        if (src.type === 'single' || src.type === 'multiple') {
          if (!Array.isArray(src.options)) { err(p + ': поле "options" должно быть массивом вариантов.'); }
          else if (src.options.length > LIMITS.options) { err(p + ': слишком много вариантов (максимум ' + LIMITS.options + ').'); }
          else {
            q.options = [];
            src.options.forEach(function (o, oi) {
              var op = p + ', вариант ' + (oi + 1);
              if (!isObj(o)) { err(op + ': должен быть объектом {text, correct}.'); return; }
              if (o.correct !== undefined && typeof o.correct !== 'boolean') err(op + ': поле "correct" должно быть true или false.');
              q.options.push(createOption(str(o.text, op + ', текст', LIMITS.option, true), o.correct === true));
            });
          }
        } else if (src.type === 'number') {
          if (src.answer === null || src.answer === undefined) q.answer = null;
          else if (!isFiniteNum(src.answer)) err(p + ': правильный ответ (answer) должен быть числом.');
          else q.answer = src.answer;
          if (src.tolerance === undefined || src.tolerance === null) q.tolerance = 0;
          else if (!isFiniteNum(src.tolerance) || src.tolerance < 0) err(p + ': погрешность (tolerance) должна быть неотрицательным числом.');
          else q.tolerance = src.tolerance;
        } else if (src.type === 'word') {
          if (!Array.isArray(src.words)) err(p + ': поле "words" должно быть массивом слов.');
          else if (src.words.length > LIMITS.words) err(p + ': слишком много вариантов слова (максимум ' + LIMITS.words + ').');
          else {
            q.words = src.words.map(function (w, wi) { return str(w, p + ', слово ' + (wi + 1), LIMITS.word, true); });
            if (q.words.length === 0) q.words = [''];
          }
          if (src.caseSensitive !== undefined && typeof src.caseSensitive !== 'boolean') err(p + ': поле "caseSensitive" должно быть true или false.');
          q.caseSensitive = src.caseSensitive === true;
        }
        quiz.questions.push(q);
      });
    }
    return { ok: errors.length === 0, quiz: errors.length === 0 ? quiz : null, errors: errors };
  }

  /* ---------- Ссылка: base64url(UTF-8 JSON) ---------- */

  function bytesToBase64Url(bytes) {
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*$/.test(b64)) throw new Error('bad base64');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function encodeShare(quiz) {
    var json = JSON.stringify(exportQuiz(quiz));
    return bytesToBase64Url(new TextEncoder().encode(json));
  }

  /** Возвращает {ok, quiz, errors}. */
  function decodeShare(str) {
    var data;
    try {
      var text = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(decodeURIComponent(str)));
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, quiz: null, errors: ['Ссылка повреждена или обрезана.'] };
    }
    return importQuiz(data);
  }

  /* ---------- Пример квиза ---------- */

  function sampleQuiz() {
    var raw = {
      format: FORMAT,
      version: VERSION,
      title: 'Пример: проверь свой кругозор',
      description: 'Небольшой квиз, в котором есть все четыре типа вопросов: один ответ, несколько ответов, число и слово.',
      questions: [
        {
          type: 'single', points: 1,
          text: 'Какой город является столицей Австралии?',
          explanation: 'Канберра — столица Австралии с 1913 года, хотя Сидней и Мельбурн крупнее.',
          options: [
            { text: 'Сидней', correct: false },
            { text: 'Канберра', correct: true },
            { text: 'Мельбурн', correct: false },
            { text: 'Перт', correct: false }
          ]
        },
        {
          type: 'multiple', points: 2,
          text: 'Какие из этих чисел — простые?',
          explanation: 'Простое число делится только на 1 и на себя: 2, 7 и 11. 9 = 3 × 3, 15 = 3 × 5.',
          options: [
            { text: '2', correct: true },
            { text: '7', correct: true },
            { text: '9', correct: false },
            { text: '11', correct: true },
            { text: '15', correct: false }
          ]
        },
        {
          type: 'number', points: 1,
          text: 'Чему примерно равно число π? Ответ засчитывается с точностью ±0,01.',
          explanation: 'π ≈ 3,14159… Подойдёт любое значение от 3,13 до 3,15.',
          answer: 3.14, tolerance: 0.01
        },
        {
          type: 'word', points: 1,
          text: 'Как называется самая большая планета Солнечной системы? Ответ — одно слово.',
          explanation: 'Юпитер — газовый гигант, его масса больше массы всех остальных планет вместе взятых.',
          words: ['Юпитер', 'Jupiter'], caseSensitive: false
        }
      ]
    };
    return importQuiz(raw).quiz;
  }

  global.QuizCore = {
    FORMAT: FORMAT, VERSION: VERSION, TYPES: TYPES, TYPE_LABELS: TYPE_LABELS, LIMITS: LIMITS,
    uid: uid, plural: plural, formatNumber: formatNumber, parseNumber: parseNumber, hasWhitespace: hasWhitespace,
    createOption: createOption, createQuestion: createQuestion, createEmptyQuiz: createEmptyQuiz, changeType: changeType,
    validateQuiz: validateQuiz, validateAnswer: validateAnswer, isCorrect: isCorrect, score: score,
    formatUserAnswer: formatUserAnswer, formatCorrectAnswer: formatCorrectAnswer,
    exportQuiz: exportQuiz, importQuiz: importQuiz, encodeShare: encodeShare, decodeShare: decodeShare,
    sampleQuiz: sampleQuiz
  };
})(window);
