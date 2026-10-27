/* Quiz-Ai — сохранение в localStorage. Экспортирует QuizStorage. */
(function (global) {
  'use strict';
  var DRAFT_KEY = 'quiz-ai:draft';
  var THEME_KEY = 'quiz-ai:theme';

  function safeGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function safeRemove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  /** Сохраняет черновик (в формате экспорта, чтобы при загрузке пройти ту же валидацию). */
  function saveDraft(quiz) {
    return safeSet(DRAFT_KEY, JSON.stringify(global.QuizCore.exportQuiz(quiz)));
  }

  /** Загружает черновик; при повреждённых данных возвращает null. */
  function loadDraft() {
    var raw = safeGet(DRAFT_KEY);
    if (!raw) return null;
    try {
      var res = global.QuizCore.importQuiz(JSON.parse(raw));
      return res.ok ? res.quiz : null;
    } catch (e) {
      return null;
    }
  }

  global.QuizStorage = {
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: function () { safeRemove(DRAFT_KEY); },
    getTheme: function () { var t = safeGet(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; },
    setTheme: function (t) { safeSet(THEME_KEY, t); }
  };
})(window);
