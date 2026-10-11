(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('mf-data').textContent);

  /* ---------------- helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function money(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(n >= 1e13 ? 1 : 3).replace(/\.?0+$/, '') + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    return '$' + fmtInt(n);
  }

  /* ---------------- sources ---------------- */
  var SRC = {};
  D.sources.forEach(function (s, i) { s.n = i + 1; SRC[s.id] = s; });
  function refs(ids) {
    if (!ids || !ids.length) return null;
    var sup = el('span', { class: 'refs' });
    ids.forEach(function (id) {
      var s = SRC[id]; if (!s) return;
      sup.appendChild(el('a', { href: s.url, target: '_blank', rel: 'noopener', title: s.pub + ': ' + s.title + ' (' + s.date + ')', 'aria-label': 'Source ' + s.n + ', ' + s.pub }, String(s.n)));
    });
    return sup;
  }
  function srcLine(ids) { return ids.map(function (id) { return SRC[id]; }).filter(Boolean); }

  /* ---------------- people, companies, photos ---------------- */
  var PEOPLE = {}, ORDER = [];
  D.people.forEach(function (p) { PEOPLE[p.id] = p; });
  (D.tree.order || D.people.map(function (p) { return p.id; })).forEach(function (id) { if (PEOPLE[id] && !PEOPLE[id].connector) ORDER.push(id); });
  var CENTER = PEOPLE[D.meta.center];
  var CO = {};
  D.companies.concat(D.companiesExtra).forEach(function (c) { CO[c.id] = c; });

  function initials(p) {
    if (p.initials) return p.initials;
    var w = p.name.replace(/[^A-Za-z .'-]/g, '').split(/[\s-]+/).filter(Boolean);
    return (w[0] ? w[0][0] : '') + (w.length > 1 ? w[w.length - 1][0] : '');
  }
  function photoURL(ph) {
    var name = encodeURIComponent(ph.file.replace(/ /g, '_'));
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + name + (ph.w > 400 ? '?width=400' : '');
  }
  function filePage(ph) { return 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(ph.file.replace(/ /g, '_')); }
  function photoStyle(ph) {
    // place the face at (50%, 46%) of the circle, zoomed, without exposing edges
    var r = ph.h / ph.w, w = Math.max(1, ph.w / ph.h) * ph.zoom, h = w * r;
    var left = Math.min(0, Math.max(1 - w, 0.5 - ph.fx * w));
    var top = Math.min(0, Math.max(1 - h, 0.46 - ph.fy * h));
    return 'width:' + (w * 100).toFixed(2) + '%;left:' + (left * 100).toFixed(2) + '%;top:' + (top * 100).toFixed(2) + '%';
  }
  function face(p) {
    var f = el('span', { class: 'face', 'data-initials': initials(p) });
    var ph = p.photo ? D.photos[p.photo] : null;
    if (ph) {
      var img = el('img', { src: photoURL(ph), alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', style: photoStyle(ph) });
      img.addEventListener('error', function () { img.remove(); });
      f.appendChild(img);
    }
    return f;
  }

  /* ---------------- hero ---------------- */
  $$('[data-asof]').forEach(function (n) { n.textContent = D.meta.asOfLabel; });
  var HIS = D.meta.pronoun || 'his', W = CENTER.worth || {};
  if (W.by) add($('#hero-worth-src'), [W.by + (W.date ? ', ' + W.date : ''), refs(W.src), W.also ? ' · ' + (W.also.short || W.also.by) + ': ' + W.also.value : null, W.also ? refs(W.also.src) : null]);
  var perSec = D.pace ? D.pace.yoy / (365.25 * 86400) : 0;
  if (D.pace) {
    add($('#pace-line'), ['Over the past year ' + HIS + ' fortune grew ', el('b', null, money(D.pace.yoy).replace('B', ' billion')), refs(D.pace.src.slice(0, 1)), '. That works out to about ', el('b', { class: 'gold' }, '$' + fmtInt(perSec) + ' every second'), ', on average.']);
    var t0 = Date.now(), since = $('#since');
    var tick = function () { since.value = since.textContent = '+$' + fmtInt(perSec * (Date.now() - t0) / 1000); };
    tick(); setInterval(tick, 250);
  } else { $('.pace').hidden = true; }

  /* ---------------- family board ---------------- */
  var GROUPS = D.tree.groups;
  (function autoX() {
    var rows = {};
    D.people.forEach(function (p) { var L = p.layout || (p.layout = {}); if (L.row == null) L.row = 2; (rows[L.row] = rows[L.row] || []).push(p); });
    Object.keys(rows).forEach(function (r) {
      var list = rows[r], n = list.length, part = list.some(function (p) { return p.layout.partner; }), sp = Math.min(100 / n, part ? 21 : 16);
      list.forEach(function (p, i) { if (p.layout.x == null) p.layout.x = +(50 + (i - (n - 1) / 2) * sp).toFixed(2); });
    });
  })();
  var board = $('#board');
  function nodeFor(p) {
    var L = p.layout || {};
    var cls = 'node' + (L.big ? ' big' : '') + (L.small ? ' small' : '') + (L.partner ? ' partner' : '') + (p.connector ? ' connector' : '');
    var b = p.connector
      ? el('div', { class: cls, 'data-id': p.id, 'data-row': L.row, style: '--x:' + L.x + ';--top:0px', title: p.summary ? p.summary.t : null })
      : el('button', { class: cls, type: 'button', 'data-id': p.id, 'data-row': L.row, style: '--x:' + L.x + ';--top:0px', 'aria-label': 'Open the file on ' + p.name });
    var text = el('span', { class: 'n-text' },
      el('span', { class: 'n-name' }, p.name),
      el('span', { class: 'n-rel' }, p.rel),
      p.tag ? el('span', { class: 'n-tag' + (p.tagKind === 'money' ? ' money' : '') }, p.tag) : null);
    if (L.partner) {
      b.appendChild(el('span', { class: 'p-head' }, face(p), text));
      var kids = el('span', { class: 'kids' }, el('span', { class: 'kids-label' }, p.kidsLabel || 'Children with ' + CENTER.short));
      if (p.kids && p.kids.length) p.kids.forEach(function (k) { kids.appendChild(el('span', { class: 'kid' + (k.note && /died/.test(k.note) ? ' gone' : ''), title: k.note || null }, k.name + (k.note && /died/.test(k.note) ? ' †' : ''))); });
      else kids.appendChild(el('span', { class: 'kids-none' }, p.kidsText || 'None together'));
      b.appendChild(kids);
    } else {
      b.appendChild(face(p)); b.appendChild(text);
    }
    if (p.connector) return b;
    b.addEventListener('click', function () { openFile(p.id, true); });
    b.addEventListener('mouseenter', function () { heat(p.id); });
    b.addEventListener('mouseleave', function () { heat(null); });
    b.addEventListener('focus', function () { heat(p.id); });
    b.addEventListener('blur', function () { heat(null); });
    return b;
  }
  GROUPS.forEach(function (g) {
    var wrap = el('div', { class: 'group g-' + g[0] }, el('h3', { class: 'group-title' }, g[1], g[2] ? el('span', null, ' · ' + g[2]) : null));
    var list = el('div', { class: 'group-list' });
    D.people.filter(function (p) { return p.group === g[0]; }).forEach(function (p) { list.appendChild(nodeFor(p)); });
    wrap.appendChild(list); board.appendChild(wrap);
  });
  if (CENTER.kidsNote) add($('#board-note'), [CENTER.kidsNote.t, refs(CENTER.kidsNote.src)]);

  var wires = $('#wires'), desk = window.matchMedia('(min-width: 1040px)');
  function heat(id) {
    $$('.wire', wires).forEach(function (w) { w.classList.toggle('hot', !!id && (' ' + w.getAttribute('data-rel') + ' ').indexOf(' ' + id + ' ') > -1); });
  }
  function drawWires() {
    while (wires.firstChild) wires.removeChild(wires.firstChild);
    if (!desk.matches) { board.style.height = ''; return; }
    var byRow = {}, top = 0;
    $$('.node', board).forEach(function (n) { var r = n.getAttribute('data-row'); (byRow[r] = byRow[r] || []).push(n); });
    Object.keys(byRow).sort(function (a, b) { return a - b; }).forEach(function (r) {
      var h = 0;
      byRow[r].forEach(function (n) { n.style.setProperty('--top', top + 'px'); h = Math.max(h, n.offsetHeight); });
      top += h + 66;
    });
    board.style.height = (top - 54) + 'px';
    var B = board.getBoundingClientRect();
    function R(id) {
      var n = $('.node[data-id="' + id + '"]', board), f = $('.face', n), nr = n.getBoundingClientRect(), fr = f.getBoundingClientRect();
      return { cx: fr.left + fr.width / 2 - B.left, top: fr.top - B.top, mid: fr.top + fr.height / 2 - B.top, l: fr.left - B.left, r: fr.right - B.left, bottom: nr.bottom - B.top, ntop: nr.top - B.top };
    }
    function path(d, rel) { wires.appendChild(sv('path', { d: d, class: 'wire', 'data-rel': rel })); }
    function fork(x, y, kids, rel, toNodeTop, above) {
      var tops = kids.map(function (k) { return toNodeTop ? k.ntop : k.top; });
      var bus = ((above == null ? y : above) + Math.min.apply(null, tops)) / 2;
      var xs = kids.map(function (k) { return k.cx; }).concat([x]);
      var d = 'M' + x + ',' + y + ' V' + bus + ' M' + Math.min.apply(null, xs) + ',' + bus + ' H' + Math.max.apply(null, xs);
      kids.forEach(function (k, i) { d += ' M' + k.cx + ',' + bus + ' V' + (tops[i] - 3); });
      path(d, rel);
      return bus;
    }
    var T = D.tree, CM = {};
    (T.couples || []).forEach(function (c) {
      var a = R(c[0]), b = R(c[1]), y = a.mid, x1 = a.r + 5, x2 = b.l - 5, mx = (x1 + x2) / 2;
      path('M' + x1 + ',' + (y - 2) + ' H' + x2 + ' M' + x1 + ',' + (y + 2) + ' H' + x2, c[0] + ' ' + c[1]);
      if (c[2]) wires.appendChild(sv('text', { x: mx, y: y - 9, 'text-anchor': 'middle', class: 'wire-label' }, c[2]));
      CM[c[0] + '+' + c[1]] = { x: mx, y: y + 2, above: Math.max(a.bottom, b.bottom) };
    });
    (T.forks || []).forEach(function (f) {
      var kids = f.kids.map(R), rel = [].concat(f.frm, f.kids).join(' '), bus;
      if (Array.isArray(f.frm)) { var c = CM[f.frm.join('+')]; bus = fork(c.x, c.y, kids, rel, f.toNodeTop, c.above); }
      else { var q = R(f.frm); bus = fork(q.cx, q.bottom + 2, kids, rel, f.toNodeTop); }
      if (f.label) {
        var xs = kids.map(function (k) { return k.cx; });
        wires.appendChild(sv('text', { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: bus + 15, 'text-anchor': 'middle', class: 'wire-label' }, f.label));
      }
    });
  }
  var wireTimer;
  function scheduleWires() { clearTimeout(wireTimer); wireTimer = setTimeout(drawWires, 60); }
  if (window.ResizeObserver) new ResizeObserver(scheduleWires).observe(board);
  window.addEventListener('resize', scheduleWires);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleWires);
  drawWires();

  /* ---------------- dossier ---------------- */
  var dossier = $('#dossier'), scrim = $('#scrim'), lastFocus = null, current = null;
  function chipFor(c) {
    var s = c.status, label = c.chip || { public: 'Public · ' + (c.ticker || ''), private: 'Private', absorbed: c.into ? 'Part of ' + c.into : 'Absorbed', nostake: 'No family stake', gone: c.gone || 'Acquired' }[s] || s;
    return el('span', { class: 'chip ' + s }, label);
  }
  function section(title, kids) { return kids && kids.length ? el('div', { class: 'd-sec' }, el('h3', null, title), kids) : null; }
  function item(h, obj) { return el('div', { class: 'd-item' }, h ? el('p', { class: 'h' }, h) : null, el('p', null, obj.t, refs(obj.src))); }
  function kidsBlock(p) {
    if (p.id === CENTER.id) {
      if (!p.kidsNote && !(D.tree.coParents || []).length) return null;
      return (D.tree.coParents || []).map(function (id) {
        var m = PEOPLE[id];
        return el('div', { class: 'd-kids-group' }, el('span', { class: 'label' }, 'With ' + m.name), (m.kids ? el('span', { class: 'kids' }, m.kids.map(function (k) { return el('span', { class: 'kid' + (/died/.test(k.note || '') ? ' gone' : ''), title: k.note || null }, k.name + (/died/.test(k.note || '') ? ' †' : '')); })) : el('p', { class: 'kids-none' }, m.kidsText)), refs(m.kidsSrc));
      });
    }
    if (!p.kids) return p.kidsText ? [el('p', { class: 'kids-none' }, p.kidsText, refs(p.kidsSrc))] : null;
    if (!p.kids.length) return [el('p', { class: 'kids-none' }, 'No children together.', refs(p.kidsSrc))];
    return [el('span', { class: 'kids' }, p.kids.map(function (k) { return el('span', { class: 'kid' + (/died/.test(k.note || '') ? ' gone' : '') }, k.name + (/died/.test(k.note || '') ? ' †' : '')); })),
      el('p', { class: 'fine', style: 'margin-top:8px' }, p.kids.filter(function (k) { return k.note; }).map(function (k) { return k.name + ': ' + k.note + '. '; }).join(''), refs(p.kidsSrc))];
  }
  function collectSrc(p) {
    var seen = [], push = function (ids) { (ids || []).forEach(function (i) { if (seen.indexOf(i) < 0) seen.push(i); }); };
    push(p.bornSrc); push(p.summary && p.summary.src);
    if (p.worth) { push(p.worth.src); if (p.worth.also) push(p.worth.also.src); }
    ['owns', 'record', 'facts', 'disputed'].forEach(function (k) { (p[k] || []).forEach(function (x) { push(x.src); }); });
    if (p.id === CENTER.id) { if (D.holdings) push(D.holdings.src); if (p.kidsNote) push(p.kidsNote.src); (D.tree.coParents || []).forEach(function (id) { push(PEOPLE[id].kidsSrc); }); }
    push(p.kidsSrc);
    return seen.sort(function (a, b) { return SRC[a].n - SRC[b].n; });
  }
  function renderFile(p) {
    while (dossier.firstChild) dossier.removeChild(dossier.firstChild);
    var i = ORDER.indexOf(p.id), prev = PEOPLE[ORDER[(i - 1 + ORDER.length) % ORDER.length]], next = PEOPLE[ORDER[(i + 1) % ORDER.length]];
    var close = el('button', { class: 'icon-btn', type: 'button', onclick: function () { closeFile(true); } }, 'Close ×');
    add(dossier, [
      el('div', { class: 'd-bar' }, el('p', { class: 'd-file' }, 'File · ' + p.name), close),
      el('div', { class: 'd-top' + (p.id === CENTER.id ? ' elon' : '') }, face(p), el('div', null,
        el('h2', { class: 'd-name', id: 'd-title' }, p.name),
        el('p', { class: 'd-rel' }, p.rel),
        p.born ? el('p', { class: 'd-born' }, p.born, refs(p.bornSrc)) : null)),
      p.summary ? el('p', { class: 'd-summary' }, p.summary.t, refs(p.summary.src)) : null
    ]);
    if (p.worth && p.worth.value) {
      dossier.appendChild(el('div', { class: 'd-worth' }, el('span', { class: 'label' }, 'Net worth'), el('p', { class: 'v' }, p.worth.value),
        el('p', { class: 'by' }, p.worth.by + ', ' + p.worth.date, refs(p.worth.src)),
        p.worth.also ? el('p', { class: 'by' }, p.worth.also.by + ': ' + p.worth.also.value, refs(p.worth.also.src)) : null));
    } else if (p.worth && p.worth.none) {
      dossier.appendChild(el('div', { class: 'd-worth none' }, el('span', { class: 'label' }, 'Net worth'), el('p', null, p.worth.none)));
    }
    if (p.id === CENTER.id && D.holdings) dossier.appendChild(el('div', { class: 'hold-mini' }, holdingsBar(true)));
    add(dossier, [
      section('Owns & runs', (p.owns || []).map(function (o) {
        var c = CO[o.co] || { name: o.co, status: '' };
        return el('div', { class: 'd-item' }, el('div', { class: 'co-row' }, el('span', { class: 'co-name' }, c.name), c.status ? chipFor(c) : null), el('p', null, o.t, refs(o.src)));
      })),
      section('On the record', (p.record || []).map(function (r) { return item(r.h, r); })),
      section('Disputed', (p.disputed || []).map(function (r) { return el('div', { class: 'd-item' }, el('span', { class: 'stamp' }, 'Disputed'), el('p', { class: 'h' }, r.h), el('p', null, r.t, refs(r.src))); })),
      section('Wow facts', (p.facts || []).map(function (f) { return item(null, f); })),
      section(p.id === CENTER.id ? 'Children' : (p.kidsLabel || 'Children with ' + CENTER.short), kidsBlock(p)),
      p.note ? el('p', { class: 'd-note' }, p.note) : null,
      section('Sources in this file', [el('div', { class: 'd-src' }, el('ol', null, collectSrc(p).map(function (id) {
        var s = SRC[id];
        return el('li', { value: s.n }, el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.pub), ': ' + s.title + ' (' + s.date + ')');
      })))]),
      el('div', { class: 'd-nav' },
        el('button', { class: 'icon-btn', type: 'button', onclick: function () { openFile(prev.id, false); } }, '← ' + prev.short),
        el('button', { class: 'icon-btn', type: 'button', onclick: function () { openFile(next.id, false); } }, next.short + ' →'))
    ]);
  }
  function openFile(id, push) {
    var p = PEOPLE[id]; if (!p || p.connector) return;
    if (dossier.hidden) lastFocus = document.activeElement;
    current = id;
    renderFile(p);
    dossier.hidden = false; scrim.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    dossier.scrollTop = 0;
    $$('.node', board).forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-id') === id); });
    var btn = $('.d-bar .icon-btn', dossier); if (btn) btn.focus({ preventScroll: true });
    try {
      if (push) history.pushState({ file: id }, '', '#' + id);
      else history.replaceState({ file: id }, '', '#' + id);
    } catch (e) { /* sandboxed viewers may refuse history changes */ }
  }
  function closeFile(fromUser) {
    if (dossier.hidden) return;
    dossier.hidden = true; scrim.hidden = true; current = null;
    document.documentElement.style.overflow = '';
    $$('.node.on', board).forEach(function (n) { n.classList.remove('on'); });
    if (fromUser) {
      try {
        if (history.state && history.state.file) history.back();
        else history.replaceState(null, '', location.pathname + location.search);
      } catch (e) { }
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  scrim.addEventListener('click', function () { closeFile(true); });
  document.addEventListener('keydown', function (e) {
    if (dossier.hidden) return;
    if (e.key === 'Escape') { closeFile(true); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href], button', dossier).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  function syncHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (PEOPLE[id] && !PEOPLE[id].connector) { if (current !== id) openFile(id, false); }
    else if (!dossier.hidden) closeFile(false);
  }
  window.addEventListener('popstate', syncHash);
  window.addEventListener('hashchange', syncHash);

  /* ---------------- invest ---------------- */
  if (!(D.companies || []).length) $('#invest').hidden = true;
  (D.companies || []).forEach(function (c) {
    if (c.status === 'public') {
      $('#invest-big').appendChild(el('article', { class: 'inv big' },
        el('div', { class: 'tick', style: 'color:' + c.color }, c.ticker),
        el('p', { class: 'nm' }, c.name + ' · ' + c.exchange + (c.since ? ' since ' + c.since : '')),
        el('span', { class: 'yes' }, 'Yes, you can buy it'),
        c.includes ? el('p', { class: 'incl' }, 'Includes ' + c.includes + '.') : null,
        el('p', { class: 't' }, c.t, refs(c.src)),
        el('p', { class: 'who' }, 'Family: ' + c.who),
        el('a', { class: 'quote', href: c.quote, target: '_blank', rel: 'noopener' }, 'Live ' + c.ticker + ' quote ↗')));
    } else {
      $('#invest-rest').appendChild(el('article', { class: 'inv small' },
        el('div', { class: 'bar', style: '--c:' + c.color }),
        el('p', { class: 'nm' }, c.name), chipFor(c),
        el('p', { class: 't' }, c.t, refs(c.src)),
        el('p', { class: 'who' }, c.who)));
    }
  });

  /* ---------------- money ---------------- */
  function holdingsBar(compact) {
    var H = D.holdings, tot = H.items.reduce(function (a, b) { return a + b.v; }, 0);
    var stack = el('div', { class: 'stack', role: 'img', 'aria-label': H.items.map(function (x) { return x.name + ' $' + x.v + ' billion'; }).join(', ') });
    H.items.forEach(function (x) { stack.appendChild(el('span', { style: 'width:' + (x.v / tot * 100).toFixed(2) + '%;--c:' + x.color, title: x.name + ': $' + x.v + 'B' })); });
    if (compact) {
      return [el('span', { class: 'label' }, 'Biggest holdings (Bloomberg estimate)'), stack,
        el('p', { class: 'fine', style: 'margin-top:8px' }, H.items.map(function (x) { return x.name + ' $' + x.v + 'B'; }).join(' · '), refs(H.src))];
    }
    return { stack: stack, tot: tot };
  }
  if (!D.holdings) $('#hold-legend').closest('.panel').hidden = true;
  else (function () {
    var H = D.holdings, hb = holdingsBar(false), host = $('#hold-stack');
    host.parentNode.replaceChild(hb.stack, host);
    add($('#hold-src'), ['Bloomberg Billionaires Index estimate, ' + H.date + '. Shares of the four, not of ' + HIS + ' total net worth.', refs(H.src)]);
    H.items.forEach(function (x) {
      $('#hold-legend').appendChild(el('li', { style: '--c:' + x.color }, el('span', { class: 'k' }, x.name), el('span', { class: 'v' }, '$' + x.v + 'B'), el('span', { class: 'p' }, (x.v / hb.tot * 100).toFixed(1) + '% of the four')));
    });
  })();

  var climbHost = $('#climb');
  function drawClimb() {
    while (climbHost.firstChild) climbHost.removeChild(climbHost.firstChild);
    var W = Math.max(300, climbHost.clientWidth), narrow = W < 620, H = narrow ? 300 : 360;
    var m = { l: narrow ? 46 : 58, r: narrow ? 14 : 24, t: 30, b: 36 };
    var t0 = Date.parse('2025-09-10'), t1 = Date.parse('2026-10-25'), vmax = 1400;
    function x(d) { return m.l + (Date.parse(d) - t0) / (t1 - t0) * (W - m.l - m.r); }
    function y(v) { return H - m.b - v / vmax * (H - m.t - m.b); }
    var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Line chart of Elon Musk’s net worth at Forbes milestones, from $500 billion in October 2025 to $1.046 trillion in October 2026' });
    var defs = sv('defs'), lg = sv('linearGradient', { id: 'gold-fade', x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(sv('stop', { offset: '0%', 'stop-color': '#FFB020', 'stop-opacity': '.28' }));
    lg.appendChild(sv('stop', { offset: '100%', 'stop-color': '#FFB020', 'stop-opacity': '0' }));
    defs.appendChild(lg); s.appendChild(defs);
    var g = sv('g', { class: 'grid' }), ax = sv('g', { class: 'axis' });
    [0, 250, 500, 750, 1000, 1250].forEach(function (v) {
      g.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      ax.appendChild(sv('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, v === 0 ? '$0' : v >= 1000 ? '$' + (v / 1000) + 'T' : '$' + v + 'B'));
    });
    [['2025-10-01', 'Oct ’25'], ['2026-01-01', 'Jan ’26'], ['2026-04-01', 'Apr ’26'], ['2026-07-01', 'Jul ’26'], ['2026-10-01', 'Oct ’26']].forEach(function (t) {
      ax.appendChild(sv('text', { x: x(t[0]), y: H - 10, 'text-anchor': 'middle' }, t[1]));
    });
    s.appendChild(g); s.appendChild(ax);
    s.appendChild(sv('line', { class: 'tline', x1: m.l, x2: W - m.r, y1: y(1000), y2: y(1000) }));
    s.appendChild(sv('text', { class: 'tlabel', x: m.l + 8, y: y(1000) - 8 }, '$1 TRILLION'));
    var pts = D.climb, line = '', area = '';
    pts.forEach(function (p, i) { line += (i ? 'L' : 'M') + x(p.d).toFixed(1) + ',' + y(p.v).toFixed(1); });
    area = line + 'L' + x(pts[pts.length - 1].d).toFixed(1) + ',' + y(0) + 'L' + x(pts[0].d).toFixed(1) + ',' + y(0) + 'Z';
    s.appendChild(sv('path', { class: 'area', d: area }));
    s.appendChild(sv('path', { class: 'line', d: line }));
    // label placement: [dx, dy, anchor], tuned so neighbours don't collide
    var place = {
      '2025-10-01': [0, -14, 'middle'], '2025-12-15': [8, 18, 'start'], '2025-12-19': [-6, -12, 'end'], '2026-02-03': [0, -14, 'middle'],
      '2026-06-12': [-8, 4, 'end'], '2026-06-15': [0, -14, 'middle'], '2026-06-23': [8, 16, 'start'], '2026-10-06': [-2, -14, 'end']
    };
    var hideNarrow = { '2025-12-15': 1, '2025-12-19': 1, '2026-06-12': 1 };
    if (narrow) place['2026-02-03'] = [0, 20, 'middle'];
    pts.forEach(function (p, i) {
      var cx = x(p.d), cy = y(p.v), last = i === pts.length - 1;
      var c = sv('circle', { class: 'pt' + (last ? ' last' : ''), cx: cx, cy: cy, r: last ? 6 : 4.5 });
      c.appendChild(sv('title', null, p.d + ': ' + p.label + (p.note ? ' (' + p.note + ')' : '')));
      s.appendChild(c);
      if (narrow && hideNarrow[p.d]) return;
      var pl = place[p.d] || [0, -12, 'middle'];
      s.appendChild(sv('text', { class: 'plabel', x: cx + pl[0], y: cy + pl[1], 'text-anchor': pl[2] }, p.label));
    });
    climbHost.appendChild(s);
  }
  if (D.climb) {
  drawClimb();
  var climbTimer;
  window.addEventListener('resize', function () { clearTimeout(climbTimer); climbTimer = setTimeout(drawClimb, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawClimb);
  D.climb.forEach(function (p) {
    var d = new Date(p.d + 'T12:00:00Z');
    $('#climb-points').appendChild(el('li', null, el('span', { class: 'd' }, d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })), el('span', { class: 'v' }, p.label), el('span', null, p.note || '', refs(p.src))));
  });
  } else $('#climb').closest('.panel').hidden = true;
  (function () {
    var L = D.ladder, lad = $('#ladder');
    if (!L) { lad.closest('.panel').hidden = true; return; }
    var top = L.items[0], n = L.items.length;
    $('#ladder-note').textContent = L.note || ((n === 1 ? 'Only one fortune on this map has a published estimate.' : (n === 2 ? 'Only two people on this map have' : n + ' people on this map have') + ' a published net worth estimate.') + ' Bars are drawn to scale.');
    L.items.forEach(function (r, i) {
      var pc = r.v / top.v * 100;
      lad.appendChild(el('div', { class: 'rung' }, el('div', { class: 'top-line' }, el('span', null, r.name), el('b', null, r.label)), el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + pc.toFixed(3) + '%' })),
        i ? el('p', { class: 'scribble' }, (pc < 1 ? '↑ that sliver is ' : '↑ that’s ') + pc.toFixed(2) + '% of ' + (top.short || top.name) + '’s fortune') : null, i ? refs(r.src.concat(top.src)) : null));
    });
    if (L.rest) lad.appendChild(el('div', { class: 'rung muted' }, el('div', { class: 'top-line' }, el('span', null, L.rest), el('b', null, 'No reliable estimate'))));
  })();

  /* ---------------- homes ---------------- */
  (function () {
    var Hm = D.homes;
    if (!Hm) { $('#homes').hidden = true; return; }
    if (Hm.totals) {
      add($('#homes-flip'), [el('span', { class: 'v' }, '$' + Hm.totals.b + 'M'), el('span', { class: 'arrow' }, '→'), el('span', { class: 'v gold' }, '$' + Hm.totals.s + 'M')]);
      add($('#homes-flip-src'), ['Seven homes bought from Dec 2012 to Jan 2019, all sold from June 2020 to November 2021. Roughly $' + Hm.totals.profit + 'M profit before mortgage costs, per the Wall Street Journal.', refs(Hm.totals.src)]);
    } else if (Hm.summary) {
      add($('#homes-flip'), el('span', { class: 'v gold' }, Hm.summary.value));
      add($('#homes-flip-src'), [Hm.summary.note, refs(Hm.summary.src)]);
    }
    if (Hm.quotes && Hm.quotes.length) Hm.quotes.forEach(function (q) {
      $('#homes-quotes').appendChild(el('blockquote', { class: 'quote' }, el('p', null, '“' + q.q + '”'), el('footer', null, CENTER.name + ', ' + q.when, refs(q.src))));
    }); else $('#homes-quotes').hidden = true;
    var vals = [], anySold = false;
    Hm.props.forEach(function (h) { vals.push(h.b); if (h.s != null) { vals.push(h.s); anySold = true; } });
    var hi0 = Math.max.apply(null, vals), step = hi0 > 100 ? 50 : 10, max = Math.ceil(hi0 * 1.08 / step) * step, dumb = $('#dumb');
    function pct(v) { return (v / max * 100).toFixed(2) + '%'; }
    Hm.props.forEach(function (h) {
      var sold = h.s != null, lo = sold ? Math.min(h.b, h.s) : h.b, hi = sold ? Math.max(h.b, h.s) : h.b;
      dumb.appendChild(el('div', { class: 'drow' },
        el('div', { class: 'lbl' }, el('div', { class: 'nm', title: h.note || null }, h.name, refs(h.src)), el('div', { class: 'ar' }, h.area + ' · street ', el('span', { class: 'redact', title: 'We don’t publish street addresses', 'aria-label': 'street address withheld' }))),
        el('div', { class: 'dtrack', 'aria-hidden': 'true' },
          sold ? el('span', { class: 'dseg', style: 'left:' + pct(lo) + ';width:calc(' + pct(hi) + ' - ' + pct(lo) + ')' }) : null,
          el('span', { class: 'ddot ' + (sold ? 'b' : 's'), style: 'left:' + pct(h.b), title: 'Bought ' + h.by + ': $' + h.b + 'M' }),
          sold ? el('span', { class: 'ddot s', style: 'left:' + pct(h.s), title: 'Sold ' + h.sy + ': $' + h.s + 'M' }) : null),
        el('div', { class: 'vals' }, sold ? [(h.bApprox ? '≈' : '') + '$' + h.b + 'M ', '→ ', el('b', null, '$' + h.s + 'M'), el('br'), h.by + ' → ' + h.sy]
          : [el('b', null, '$' + h.b + 'M'), el('br'), h.by === 'reported' ? 'price as reported' : 'bought ' + h.by])));
    });
    if (Hm.rent) dumb.appendChild(el('div', { class: 'drow rent' },
      el('div', { class: 'lbl' }, el('div', { class: 'nm' }, Hm.rent.name, refs(Hm.rent.src)), el('div', { class: 'ar' }, Hm.rent.area)),
      el('div', { class: 'dtrack', 'aria-hidden': 'true' }, el('span', { class: 'ddot rent', style: 'left:' + pct(Hm.rent.v) })),
      el('div', { class: 'vals' }, el('b', { style: 'color:var(--green)' }, Hm.rent.label), el('br'), Hm.rent.sub)));
    var tk = [];
    for (var v = 0; v < max; v += step * (max / step > 6 ? 2 : 1)) tk.push(v);
    dumb.appendChild(el('div', { class: 'dscale', 'aria-hidden': 'true' }, el('div'), el('div', { class: 'ticks' }, tk.map(function (v) { return el('span', { style: 'left:' + pct(v) }, '$' + v + 'M'); })), el('div')));
    add($('#dkey'), [anySold ? el('span', null, el('i', { style: 'border:2px solid var(--ink-2)' }), 'Bought') : null, el('span', null, el('i', { style: 'background:var(--gold)' }), anySold ? 'Sold' : 'Price paid'),
      Hm.rent ? el('span', null, el('i', { style: 'background:var(--green)' }), Hm.rent.name) : null]);
    if (Hm.wilder) add($('#wilder'), el('p', null, Hm.wilder.t, refs(Hm.wilder.src))); else $('#wilder').hidden = true;
    (Hm.extra || []).forEach(function (f) { $('#homes-facts').appendChild(el('li', null, f.t, refs(f.src))); });
    if (Hm.hq) Hm.hq.forEach(function (q) { $('#hq').appendChild(el('div', { class: 'mini' }, el('h4', null, q.h), el('p', null, q.t, refs(q.src)))); });
    else { $('#hq-head').hidden = true; $('#hq').hidden = true; }
  })();

  /* ---------------- ledger ---------------- */
  (function () {
    var tb = $('#ledger tbody');
    if (!(D.ledger || []).length) { $('#record').hidden = true; return; }
    D.ledger.forEach(function (r) {
      tb.appendChild(el('tr', null, el('td', { class: 'who' }, r.who), el('td', null, r.what), el('td', { class: 'amt' }, r.amt), el('td', { class: 'when' }, r.when), el('td', null, refs(r.src))));
    });
  })();

  /* ---------------- trail ---------------- */
  if (!(D.trail || []).length) $('#trail').hidden = true;
  (D.trail || []).forEach(function (t) {
    $('#trail-list').appendChild(el('li', null, el('time', null, t.when), el('div', null,
      el('h3', null, t.h, t.t ? null : refs(t.src)),
      t.amt ? el('span', { class: 'amt' }, t.amt) : null,
      t.t ? el('p', null, t.t, refs(t.src)) : null)));
  });

  /* ---------------- perspective ---------------- */
  (function () {
    var C = D.calc || { worth: D.ladder ? D.ladder.items[0].v : 0 }, worth = C.worth, inp = $('#income');
    if (!worth) { $('#perspective').hidden = true; return; }
    if (!C.compareV) $('#o-kimbal').closest('.out').hidden = true;
    [['$35K', 35000], ['$60K', 60000], ['$100K', 100000], ['$250K', 250000], ['$1M', 1000000]].forEach(function (p) {
      $('#presets').appendChild(el('button', { type: 'button', onclick: function () { inp.value = p[1]; calc(); } }, p[0]));
    });
    function yearsText(y) {
      if (y >= 1e9) return (y / 1e9).toFixed(1) + ' billion years';
      if (y >= 1e6) return (y / 1e6).toFixed(1) + ' million years';
      return fmtInt(y) + ' years';
    }
    function calc() {
      var v = parseFloat(inp.value);
      if (!(v > 0)) { $('#o-years').textContent = '—'; $('#o-secs').textContent = '—'; return; }
      $('#o-years').textContent = yearsText(worth / v);
      if (!perSec) return;
      var secs = v / perSec;
      $('#o-secs').textContent = secs < 60 ? secs.toFixed(1) + ' seconds' : secs < 3600 ? (secs / 60).toFixed(1) + ' minutes' : (secs / 3600).toFixed(1) + ' hours';
    }
    if (!perSec) $('#o-secs').closest('.out').hidden = true;
    $('#o-spend').textContent = fmtInt(worth / 1e6 / 365.25) + ' years';
    if (C.compareV) $('#o-kimbal').textContent = (C.compareV / worth * 100).toFixed(2) + '%';
    $('#o-kimbal-k').textContent = C.compareK || ''; $('#o-kimbal-s').textContent = C.compareS || '';
    inp.addEventListener('input', calc);
    calc();
  })();

  /* ---------------- cases ---------------- */
  function prettyUrl(u) {
    try { var x = new URL(u); var p = x.pathname.replace(/\/$/, ''); return x.hostname.replace(/^www\./, '') + (p.length > 38 ? p.slice(0, 36) + '…' : p); }
    catch (e) { return u; }
  }
  if (D.cases && $('#case-list')) D.cases.forEach(function (c) {
    var chain = el('p', { class: 'chain' });
    c.chain.forEach(function (s, i) { if (i) chain.appendChild(el('i', { 'aria-hidden': 'true' }, '→')); chain.appendChild(el('span', { class: 'link' }, s)); });
    $('#case-list').appendChild(el('article', { class: 'case' },
      el('img', { src: c.img, alt: 'Cover of ' + c.title, loading: 'lazy', width: 540, height: 960 }),
      el('div', null,
        el('p', { class: 'n' }, c.n === 'MASTER' ? 'The master file' : 'Case ' + c.n),
        el('h3', null, c.title),
        el('p', { class: 'hook' }, c.hook),
        chain,
        el('details', null, el('summary', null, 'Sources (' + c.links.length + ')'), el('ol', null, c.links.map(function (u) { return el('li', null, el('a', { href: u, target: '_blank', rel: 'noopener' }, prettyUrl(u))); }))))));
  });

  /* ---------------- sources + credits ---------------- */
  var GROUP_NAMES = { family: 'The family', money: 'The money', record: 'On the record', homes: 'The homes' };
  Object.keys(GROUP_NAMES).forEach(function (g) {
    var list = D.sources.filter(function (s) { return s.group === g; });
    if (!list.length) return;
    var ol = el('ol', { start: list[0].n });
    list.forEach(function (s) { ol.appendChild(el('li', { id: 's-' + s.n }, el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.pub), ': ' + s.title + ' (' + s.date + ')')); });
    $('#src-list').appendChild(el('div', { class: 'src-group' }, el('h3', null, GROUP_NAMES[g]), ol));
  });
  Object.keys(D.photos).forEach(function (k) {
    var ph = D.photos[k], who = PEOPLE[k] ? PEOPLE[k].name : k;
    $('#credits').appendChild(el('li', null, who + ': ', el('a', { href: filePage(ph), target: '_blank', rel: 'noopener' }, 'photo'), ' by ' + ph.author + ' (' + ph.year + '), ',
      el('a', { href: D.licenses[ph.license], target: '_blank', rel: 'noopener' }, ph.license), ', cropped'));
  });
  $('#repo-link').href = D.meta.repo;
  $('#issues-link').href = D.meta.repo + '/issues';

  if ($('#money .panel:not([hidden])') == null) $('#money').hidden = true;
  $$('.nav a[href^="#"]').forEach(function (a) { var t = $(a.getAttribute('href')); if (t && t.hidden) a.hidden = true; });
  /* deep link to a file, e.g. #kimbal */
  syncHash();
})();
