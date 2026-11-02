/* 英単語力診断 (/shindan/): 30 questions, 6 for each of 5 axes, and the speed of every answer.
   Each axis is adaptive: it starts at tier 3 of 5, a right answer moves it up, a wrong one down (smaller steps later),
   and where it ends is the axis' score. The questions come from /assets/shindan.5d0bd37d.json (build.py shindan_data):
   {pool: {axis: [tier 1 items … tier 5 items]}, words: [estimated vocabulary at tier 0 … 5]}, an item being
   [prompt, sentence, answer, [wrong options], note]. Nothing is sent anywhere; the result is drawn here and on a canvas. */
(function () {
  var URL_DATA = '/assets/shindan.5d0bd37d.json', SITE = 'https://kiwami-eitango.com/shindan/';
  var AX = ['vocab', 'poly', 'deriv', 'idiom', 'usage'];
  var NAME = { vocab: '単語力', poly: '多義語力', deriv: '派生語力', idiom: '熟語力', usage: '語法力', speed: 'スピード' };
  var CHIP = { vocab: '単語', poly: '多義語', deriv: '派生語', idiom: '熟語', usage: '語法' };
  var ASK = { vocab: '次の単語の意味は？', poly: 'この文での意味は？', deriv: '空所に入るのは？', idiom: '次の熟語の意味は？', usage: '空所に入るのは？' };
  var HEX = ['vocab', 'poly', 'deriv', 'idiom', 'usage', 'speed'];
  var EXPECT = { vocab: 4000, idiom: 4500, poly: 7000, deriv: 7500, usage: 7500 };   // ms a quick, sure answer takes
  var STEP = [1, 1, .5, .5, .5, .5];
  var ADVICE = {
    vocab: '覚えている単語の数をふやすのが先決です。アプリの受験英単語を、毎日少しずつ進めましょう。',
    poly: '知っている単語の「2つ目・3つ目の意味」で落としています。アプリは意味を1つずつ覚えるので、多義語に強くなれます。',
    deriv: '派生語（名詞・形容詞・副詞の形）があいまいです。アプリでは見出し語のあとに派生語も出てくるので、まとめて覚えられます。',
    idiom: '熟語が弱点です。アプリの「熟語」で、よく出るものから固めましょう。',
    usage: '語法（前置詞・to do／doing など）で落としています。単語ページの「語法チェック」とアプリの4択で練習できます。',
    speed: '知識はあるのに、答えるまでに時間がかかっています。アプリの4択の復習で、見た瞬間にわかる単語をふやしましょう。'
  };
  var root = document.getElementById('sd');
  if (!root) return;
  var D = null, S = null;
  var E = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var markup = function (s) { return E(s).replace(/⟦(.*?)⟧/g, '<b>$1</b>').replace(/___/g, '<span class="sd-blank" aria-label="空所">　　　</span>'); };
  var shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var load = function () { return D ? Promise.resolve(D) : fetch(URL_DATA).then(function (r) { return r.json(); }).then(function (j) { D = j; return j; }); };

  function start() {
    var btn = root.querySelector('.sd-start');
    if (btn) { btn.disabled = true; btn.textContent = '読みこみ中…'; }
    load().then(function () {
      S = { i: 0, log: [], ax: {} };
      AX.forEach(function (a) { S.ax[a] = { lv: 3, k: 0, used: {} }; });
      next();
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'もう一度読みこむ'; }
    });
  }

  function pick(a) {
    var st = S.ax[a], t = clamp(Math.round(st.lv), 1, 5);
    for (var d = 0; d < 5; d++) {   // the tier it is at; if that one ran out, the nearest one
      var ts = [t + d, t - d];
      for (var x = 0; x < 2; x++) {
        var tt = ts[x];
        if (tt < 1 || tt > 5) continue;
        var items = D.pool[a][tt - 1].filter(function (it, n) { return !st.used[tt + ':' + n]; });
        if (items.length) {
          var it = items[Math.floor(Math.random() * items.length)];
          st.used[tt + ':' + D.pool[a][tt - 1].indexOf(it)] = 1;
          return { tier: tt, it: it };
        }
      }
    }
    return null;
  }

  function next() {
    if (S.i >= AX.length * 6) return result();
    var a = AX[S.i % AX.length], q = pick(a);
    if (!q) { S.i++; return next(); }
    var it = q.it, opts = shuffle([it[2]].concat(it[3]));
    S.cur = { a: a, tier: q.tier, it: it, opts: opts, t0: 0 };
    var n = S.i + 1, total = AX.length * 6;
    var head = (a === 'vocab' || a === 'idiom') ? '<p class="sd-word" lang="en">' + E(it[0]) + '</p>'
      : '<p class="sd-sen" lang="en">' + markup(it[1]) + '</p>' + (a === 'deriv' && it[4] ? '<p class="sd-ja">' + E(it[4]) + '</p>' : '');
    var en = a === 'deriv' || a === 'usage';
    root.innerHTML = '<div class="sd-q"><div class="sd-top"><span class="sd-chip">' + CHIP[a] + '</span><span class="sd-n" aria-live="polite">' + n + ' / ' + total + '</span></div>'
      + '<div class="sd-bar" aria-hidden="true"><i style="width:' + (100 * (n - 1) / total) + '%"></i></div>'
      + '<p class="sd-ask">' + ASK[a] + '</p>' + head
      + '<div class="sd-opts">' + opts.map(function (o, k) { return '<button type="button" class="sd-o" data-k="' + k + '"' + (en ? ' lang="en"' : '') + '><span class="sd-k">' + (k + 1) + '</span>' + E(o) + '</button>'; }).join('') + '</div>'
      + '<button type="button" class="sd-skip">わからない</button></div>';
    S.cur.t0 = performance.now();
    var first = root.querySelector('.sd-o');
    if (first && !matchMedia('(hover: none)').matches) first.focus({ preventScroll: true });
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
  }

  function answer(k) {
    var c = S.cur;
    if (!c || c.done) return;
    c.done = true;
    var ms = performance.now() - c.t0, chosen = k < 0 ? '' : c.opts[k], ok = chosen === c.it[2];
    var st = S.ax[c.a];
    st.lv = clamp(st.lv + (ok ? 1 : -1) * STEP[st.k], 0, 7);
    st.k++;
    S.log.push({ a: c.a, tier: c.tier, it: c.it, ok: ok, ms: ms, chosen: chosen });
    var bs = root.querySelectorAll('.sd-o');
    for (var i = 0; i < bs.length; i++) {
      bs[i].disabled = true;
      if (c.opts[i] === c.it[2]) bs[i].classList.add('ok');
      else if (i === k) bs[i].classList.add('ng');
    }
    var sk = root.querySelector('.sd-skip');
    if (sk) sk.disabled = true;
    S.i++;
    setTimeout(next, ok ? 350 : 900);
  }

  function scores() {
    var sc = {};
    AX.forEach(function (a) { sc[a] = Math.round(clamp(S.ax[a].lv / 5 * 100, 5, 100)); });
    var r = S.log.filter(function (l) { return l.ok; }).map(function (l) { return l.ms / EXPECT[l.a]; }).sort(function (x, y) { return x - y; });
    var med = r.length ? r[Math.floor(r.length / 2)] : 3;
    sc.speed = Math.round(clamp(100 - (med - 0.5) * 80, 10, 100));
    sc.total = Math.round(HEX.reduce(function (s, a) { return s + sc[a]; }, 0) / HEX.length);
    var L = clamp(S.ax.vocab.lv, 0, 5), f = Math.floor(L), w = D.words;
    sc.words = Math.round((f >= 5 ? w[5] : w[f] + (w[f + 1] - w[f]) * (L - f)) / 10) * 10;
    sc.title = sc.total >= 90 ? '極（きわみ）' : sc.total >= 75 ? '難関レベル' : sc.total >= 60 ? '標準レベル' : sc.total >= 45 ? '基礎レベル' : 'これから伸びる';
    return sc;
  }

  function hexPoints(sc, cx, cy, R) {
    return HEX.map(function (a, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3, v = sc ? sc[a] / 100 : 1;
      return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v];
    });
  }

  function hexSVG(sc) {
    var cx = 160, cy = 150, R = 100, rings = [.25, .5, .75, 1].map(function (f) {
      return '<polygon points="' + hexPoints(null, cx, cy, R * f).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" class="sd-ring"/>';
    }).join('');
    var spokes = hexPoints(null, cx, cy, R).map(function (p) { return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" class="sd-ring"/>'; }).join('');
    var poly = '<polygon points="' + hexPoints(sc, cx, cy, R).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" class="sd-area"/>';
    var labels = hexPoints(null, cx, cy, R + 26).map(function (p, i) {
      var a = HEX[i];
      return '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + (i === 0 ? -4 : i === 3 ? 12 : 4)).toFixed(1) + '" text-anchor="middle" class="sd-lab">' + NAME[a] + '<tspan class="sd-labn" x="' + p[0].toFixed(1) + '" dy="15">' + sc[a] + '</tspan></text>';
    }).join('');
    return '<svg class="sd-hex" viewBox="0 0 320 310" role="img" aria-label="' + HEX.map(function (a) { return NAME[a] + ' ' + sc[a]; }).join('、') + '">' + rings + spokes + poly + labels + '</svg>';
  }

  function result() {
    var sc = scores();
    S.sc = sc;
    var weak = HEX.slice().sort(function (x, y) { return sc[x] - sc[y]; })[0];
    var best = HEX.slice().sort(function (x, y) { return sc[y] - sc[x]; })[0];
    var miss = S.log.filter(function (l) { return !l.ok; });
    var rows = HEX.map(function (a) { return '<li><span>' + NAME[a] + '</span><i class="sd-trk"><i style="width:' + sc[a] + '%"></i></i><b class="num">' + sc[a] + '</b></li>'; }).join('');
    var review = miss.map(function (l) {
      var it = l.it, q = (l.a === 'vocab' || l.a === 'idiom') ? '<b lang="en">' + E(it[0]) + '</b>' : '<span lang="en">' + markup(it[1]) + '</span>';
      return '<li><span class="sd-chip">' + CHIP[l.a] + '</span><p>' + q + '</p><p class="sd-ans">正解：<b' + (l.a === 'deriv' || l.a === 'usage' ? ' lang="en"' : '') + '>' + E(it[2]) + '</b>'
        + (l.chosen ? '<span>あなたの答え：' + E(l.chosen) + '</span>' : '<span>わからない</span>') + '</p>'
        + (it[4] ? '<p class="sd-note">' + E(it[4]) + '</p>' : '')
        + '<a href="/search/?q=' + encodeURIComponent(it[0]) + '" lang="en">' + E(it[0]) + ' の意味と例文 →</a></li>';
    }).join('');
    root.innerHTML = '<div class="sd-res">'
      + '<p class="sd-rl">あなたの英単語力</p><p class="sd-total"><b class="num">' + sc.total + '</b><small>点</small><span class="sd-title">' + E(sc.title) + '</span></p>'
      + '<p class="sd-words">推定語彙数 <b class="num">約' + sc.words.toLocaleString('ja-JP') + '語</b><small>（中学の単語＋受験英単語の範囲で）</small></p>'
      + hexSVG(sc)
      + '<ul class="sd-rows">' + rows + '</ul>'
      + '<div class="sd-adv"><b>伸ばすなら「' + NAME[weak] + '」</b><p>' + ADVICE[weak] + '</p><a class="sd-app" href="/app/">無料アプリで覚える →</a></div>'
      + '<div class="sd-share"><a class="sd-x" target="_blank" rel="noopener">Xでシェア</a><button type="button" class="sd-img">結果の画像を保存</button></div>'
      + (miss.length ? '<details class="sd-rev"><summary>まちがえた問題（' + miss.length + '問）</summary><ol>' + review + '</ol></details>' : '<p class="sd-perfect">全問正解です。</p>')
      + '<button type="button" class="sd-again">もう一度うける</button>'
      + '<p class="sd-cn">問題は毎回ちがいます。点数は30問から出した目安です。</p></div>';
    var text = '英単語力診断の結果：総合' + sc.total + '点（' + sc.title + '）、推定語彙数 約' + sc.words.toLocaleString('ja-JP') + '語。いちばん得意なのは' + NAME[best] + '。\n#英単語力診断';
    root.querySelector('.sd-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SITE);
    S.text = text;
    root.scrollIntoView({ block: 'start' });
  }

  function drawImage() {
    var sc = S.sc, W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), jp = '"Noto Sans JP","Hiragino Sans","Yu Gothic UI",sans-serif', en = 'Figtree,' + jp;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#083FF9'; g.fillRect(0, 0, W, 12);
    g.fillStyle = '#1a1a1a'; g.font = '700 40px ' + jp; g.textBaseline = 'alphabetic';
    g.fillText('英単語力診断', 72, 110);
    g.fillStyle = '#5f5f5f'; g.font = '500 26px ' + jp; g.fillText('あなたの英単語力', 72, 190);
    g.fillStyle = '#083FF9'; g.font = '700 150px ' + en; g.fillText(String(sc.total), 64, 340);
    var tw = g.measureText(String(sc.total)).width;
    g.fillStyle = '#1a1a1a'; g.font = '700 40px ' + jp; g.fillText('点', 72 + tw, 336);
    g.font = '700 38px ' + jp; g.fillText(sc.title, 72, 412);
    g.fillStyle = '#5f5f5f'; g.font = '500 28px ' + jp; g.fillText('推定語彙数 約' + sc.words.toLocaleString('ja-JP') + '語', 72, 470);
    g.fillStyle = '#5f5f5f'; g.font = '500 24px ' + en; g.fillText('kiwami-eitango.com/shindan/', 72, 568);
    var cx = 870, cy = 305, R = 172;
    g.strokeStyle = '#e5e5e5'; g.lineWidth = 2;
    [.25, .5, .75, 1].forEach(function (f) { var p = hexPoints(null, cx, cy, R * f); g.beginPath(); p.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke(); });
    hexPoints(null, cx, cy, R).forEach(function (q) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(q[0], q[1]); g.stroke(); });
    var p = hexPoints(sc, cx, cy, R);
    g.beginPath(); p.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
    g.fillStyle = 'rgba(8,63,249,.22)'; g.fill(); g.strokeStyle = '#083FF9'; g.lineWidth = 4; g.stroke();
    g.textAlign = 'center';
    hexPoints(null, cx, cy, R + 48).forEach(function (q, i) {
      var y = q[1] + (i === 0 ? -6 : i === 3 ? 18 : 6);
      g.fillStyle = '#1a1a1a'; g.font = '700 24px ' + jp; g.fillText(NAME[HEX[i]], q[0], y);
      g.fillStyle = '#083FF9'; g.font = '700 24px ' + en; g.fillText(String(sc[HEX[i]]), q[0], y + 28);
    });
    g.textAlign = 'left';
    g.fillStyle = '#1a1a1a'; g.font = '700 28px ' + jp; g.fillText('極（きわみ）', 72, 610 - 6);
    return c;
  }

  function saveImage() {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      drawImage().toBlob(function (blob) {
        if (!blob) return;
        var file = null;
        try { file = new File([blob], 'kiwami-shindan.png', { type: 'image/png' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: S.text + '\n' + SITE }).catch(function () {});
          return;
        }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'kiwami-shindan.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    });
  }

  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t) return;
    if (t.classList.contains('sd-start') || t.classList.contains('sd-again')) start();
    else if (t.classList.contains('sd-o')) answer(+t.dataset.k);
    else if (t.classList.contains('sd-skip')) answer(-1);
    else if (t.classList.contains('sd-img')) saveImage();
  });
  document.addEventListener('keydown', function (ev) {
    if (!S || !S.cur || S.cur.done || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = '1234'.indexOf(ev.key);
    if (k >= 0 && k < S.cur.opts.length) { ev.preventDefault(); answer(k); }
  });
  load().catch(function () {});   // fetched while the intro is read
})();
