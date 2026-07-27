/* dovi0129.github.io — progressive enhancement only.
   Section highlighting, keyboard navigation, publication filter, copy buttons.
   Nothing here is required to read the document. */
(function () {
  'use strict';

  var doc = document;
  var $  = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---------------------------------------------------- section highlight */

  var tocLinks = $$('.toc a[href^="#"]');
  var targets  = tocLinks
    .map(function (a) {
      var el = doc.getElementById(a.getAttribute('href').slice(1));
      return el ? { link: a, el: el } : null;
    })
    .filter(Boolean);

  var topLevel = targets.filter(function (t) { return t.el.tagName === 'SECTION'; });
  var current  = -1;

  function highlight() {
    var line = 80;                       // a hair below the sticky offset
    var best = 0;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].el.getBoundingClientRect().top <= line) { best = i; }
    }
    if (window.scrollY + window.innerHeight >= doc.documentElement.scrollHeight - 4) {
      best = targets.length - 1;         // pinned to the bottom: last entry wins
    }
    if (best === current) { return; }
    if (current >= 0) { targets[current].link.removeAttribute('aria-current'); }
    current = best;
    targets[current].link.setAttribute('aria-current', 'true');

    /* a subsection also lights up the section it belongs to */
    var prev = $('.toc a.is-parent');
    if (prev) { prev.classList.remove('is-parent'); }
    var li = targets[current].link.parentNode;
    if (li && li.parentNode && li.parentNode.parentNode &&
        li.parentNode.parentNode.tagName === 'LI') {
      var parentLink = $('a', li.parentNode.parentNode);
      if (parentLink) { parentLink.classList.add('is-parent'); }
    }
  }

  var throttle = 0;
  function onScroll() {
    if (throttle) { return; }
    throttle = window.setTimeout(function () { throttle = 0; highlight(); }, 100);
  }

  if (targets.length) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    highlight();
  }

  /* ------------------------------------------------------------- filter */

  var input  = $('#pubfilter');
  var counter = $('#pubcount');
  var lists  = $$('.pubs');
  var items  = $$('.pubs > li');

  function headingFor(list) {
    var el = list.previousElementSibling;
    while (el && el.tagName !== 'H3') { el = el.previousElementSibling; }
    return el;
  }

  function applyFilter() {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var hit = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
      li.hidden = !hit;
      if (hit) { shown++; }
    });
    lists.forEach(function (list) {
      var any = $$('li', list).some(function (li) { return !li.hidden; });
      var h = headingFor(list);
      list.hidden = !any;
      if (h) { h.hidden = !any; }
    });
    counter.textContent = q
      ? shown + ' of ' + items.length + ' shown'
      : items.length + ' entries';
  }

  if (input && items.length) {
    counter.textContent = items.length + ' entries';
    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; applyFilter(); input.blur(); }
    });
  }

  /* -------------------------------------------------------------- BibTeX */

  $$('.js-bib').forEach(function (a) {
    var pre = doc.getElementById(a.dataset.target);
    if (!pre) { return; }
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-controls', pre.id);
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var open = pre.hidden;
      pre.hidden = !open;
      a.textContent = open ? 'hide BibTeX' : 'BibTeX';
      a.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------------------------------------------------------------- copy */

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    var ta = doc.createElement('textarea');           // http:// and file:// fallback
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px';
    doc.body.appendChild(ta);
    ta.select();
    try { doc.execCommand('copy'); } finally { doc.body.removeChild(ta); }
    return Promise.resolve();
  }

  $$('.js-copy').forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      copy(btn.dataset.copy).then(function () {
        btn.textContent = 'copied';
        btn.dataset.done = '1';
        window.setTimeout(function () {
          btn.textContent = label;
          btn.removeAttribute('data-done');
        }, 1200);
      });
    });
  });

  /* ------------------------------------------------------------ keyboard */

  function typing(el) {
    return el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  }

  /* Where j/k start from. Read the layout directly rather than trusting the
     highlight above, which is throttled; but remember the last jump so that
     two quick presses advance two sections instead of fighting the animation. */
  var pending = null;
  var pendingTimer = 0;

  function sectionAtLine() {
    var best = 0;
    for (var i = 0; i < topLevel.length; i++) {
      if (topLevel[i].el.getBoundingClientRect().top <= 80) { best = i; }
    }
    if (window.scrollY + window.innerHeight >= doc.documentElement.scrollHeight - 4) {
      best = topLevel.length - 1;
    }
    return best;
  }

  function markPending(idx) {
    pending = idx;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(function () { pending = null; }, 700);
  }

  function goto(idx) {
    if (!topLevel.length) { return; }
    idx = Math.max(0, Math.min(topLevel.length - 1, idx));
    markPending(idx);
    topLevel[idx].el.scrollIntoView({ block: 'start' });
    var h = $('h2', topLevel[idx].el);
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function indexOfCurrent() {
    return pending === null ? sectionAtLine() : pending;
  }

  doc.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) { return; }
    switch (e.key) {
      case 'j': goto(indexOfCurrent() + 1); break;
      case 'k': goto(indexOfCurrent() - 1); break;
      case 'g':
        markPending(0);
        window.scrollTo({ top: 0 });
        break;
      case 'G':
        markPending(topLevel.length - 1);
        window.scrollTo({ top: doc.documentElement.scrollHeight });
        break;
      case '/':
        if (input) { e.preventDefault(); input.focus(); input.select(); }
        return;
      default: return;
    }
    e.preventDefault();
  });
})();
