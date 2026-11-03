/* 英単語力診断 (/shindan/): 30 questions, 6 for each of 5 axes, and the speed of every answer.
   Each axis is adaptive: it starts at tier 3 of 5, a right answer moves it up, a wrong one down (smaller steps later),
   and where it ends is the axis' score. The questions come from /assets/shindan.09baa955.json (build.py shindan_data):
   {pool: {axis: [tier 1 items … tier 5 items]}, words: [estimated vocabulary at tier 0 … 5]}, an item being
   [prompt, sentence, answer, [wrong options], note]. Nothing is sent anywhere; the result is drawn here and on a canvas. */
(function () {
  var URL_DATA = '/assets/shindan.09baa955.json', SITE = 'https://kiwami-eitango.com/shindan/';
  var AX = ['vocab', 'poly', 'deriv', 'idiom', 'usage'];
  var NAME = { vocab: '単語力', poly: '多義語力', deriv: '派生語力', idiom: '熟語力', usage: '語法力', speed: 'スピード' };
  var CHIP = { vocab: '単語', poly: '多義語', deriv: '派生語', idiom: '熟語', usage: '語法' };
  var ASK = { vocab: '次の単語の意味は？', poly: 'この文での意味は？', deriv: '空所に入るのは？', idiom: '次の熟語の意味は？', usage: '空所に入るのは？' };
  var HEX = ['vocab', 'poly', 'deriv', 'idiom', 'usage', 'speed'];
  var EXPECT = { vocab: 4000, idiom: 4500, poly: 7000, deriv: 7500, usage: 7500 };   // ms a quick, sure answer takes
  var STEP = [1, .8, .6, .5, .4, .3];   // how far an answer moves the axis: less each time, so the scores spread out (and every grade can come up)
  var ADVICE = {
    vocab: '覚えている単語の数をふやすのが先決です。アプリの受験英単語を、毎日少しずつ進めましょう。',
    poly: '知っている単語の「2つ目・3つ目の意味」で落としています。アプリは意味を1つずつ覚えるので、多義語に強くなれます。',
    deriv: '派生語（名詞・形容詞・副詞の形）があいまいです。アプリでは見出し語のあとに派生語も出てくるので、まとめて覚えられます。',
    idiom: '熟語が弱点です。アプリの「熟語」で、よく出るものから固めましょう。',
    usage: '語法（前置詞・to do／doing など）で落としています。単語ページの「語法チェック」とアプリの4択で練習できます。',
    speed: '知識はあるのに、答えるまでに時間がかかっています。アプリの4択の復習で、見た瞬間にわかる単語をふやしましょう。'
  };
  // the result's type and level (src/site/shindan_types.json): the type is the strongest axis (all of them within 20
  // points: オールラウンダー), the level the estimated vocabulary (中学＋受験英単語) as the university it reads: about the
  // words that cover 95% of the exam texts (see /articles/how-many-words/: 共通テスト 3,755, 私立 4,473, 国立 4,928; 早慶 need more).
  // Each pair has a page of its own, /shindan/r/<level>-<type>/, with its own link picture: that is the address shared
  var TY = {"types":[{"k":"vocab","name":"歩く辞書型","desc":"知っている単語の数で勝負するタイプ。見たことのない単語に出会うと、つい調べたくなる。"},{"k":"poly","name":"行間読み型","desc":"1つの単語の、2つ目・3つ目の意味まで読みとれるタイプ。長文の「その意味で来たか」に強い。"},{"k":"deriv","name":"品詞職人型","desc":"名詞・形容詞・副詞の形を正しく使い分けるタイプ。空所補充や英作文で点を落とさない。"},{"k":"idiom","name":"熟語ハンター型","desc":"単語を組み合わせた熟語に強いタイプ。会話文や並べかえの問題で力を出せる。"},{"k":"usage","name":"語法マニア型","desc":"前置詞や to do／doing の使い分けまで気にするタイプ。文法問題で差をつけられる。"},{"k":"speed","name":"瞬発力型","desc":"見た瞬間に答えが浮かぶタイプ。時間の足りない長文で、いちばん頼りになる。"},{"k":"all","name":"オールラウンダー型","desc":"6つの力に大きな穴がないタイプ。苦手がないのが、いちばんの武器。"}],"levels":[{"k":"sokei","min":5600,"name":"早慶・旧帝大レベル","words":"5,600語以上"},{"k":"march","min":5000,"name":"MARCH・関関同立レベル","words":"5,000〜5,600語"},{"k":"nikkoma","min":4400,"name":"日東駒専・産近甲龍レベル","words":"4,400〜5,000語"},{"k":"kyotsu","min":3700,"name":"共通テストレベル","words":"3,700〜4,400語"},{"k":"kiso","min":2700,"name":"高校基礎レベル","words":"2,700〜3,700語"},{"k":"chugaku","min":0,"name":"中学レベル","words":"2,700語未満"}]};
  var tyOf = function (k) { return TY.types.filter(function (t) { return t.k === k; })[0]; };
  var typeOf = function (sc) {
    var by = HEX.slice().sort(function (x, y) { return sc[y] - sc[x] || HEX.indexOf(x) - HEX.indexOf(y); });
    return sc[by[0]] - sc[by[by.length - 1]] < 20 ? 'all' : by[0];
  };
  var levelOf = function (words) { for (var i = 0; words < TY.levels[i].min; i++); return TY.levels[i]; };
  var titleOf = function (t) { return t >= 90 ? '極（きわみ）' : t >= 75 ? '上級者' : t >= 60 ? '中級者' : t >= 45 ? '初級者' : 'これから伸びる'; };
  var totalOf = function (sc) { return Math.round(HEX.reduce(function (s, a) { return s + sc[a]; }, 0) / HEX.length); };
  // a result as the share link carries it: the 6 scores and the words, "78.90.65.50.80.70.5200"
  var code = function (sc) { return HEX.map(function (a) { return sc[a]; }).concat([sc.words]).join('.'); };
  var uncode = function (s) {
    var v = String(s || '').split('.').map(Number);
    if (v.length !== 7 || v.some(function (x, i) { return !(x === Math.floor(x) && x >= 0 && x <= (i < 6 ? 100 : 20000)); })) return null;
    var sc = { words: v[6] };
    HEX.forEach(function (a, i) { sc[a] = v[i]; });
    sc.total = totalOf(sc); sc.title = titleOf(sc.total); sc.type = typeOf(sc); sc.lv = levelOf(sc.words);
    return sc;
  };
  // a friend's result, from the link they shared (kept for this tab: their chart goes beside mine when I finish)
  var FR_KEY = 'kiwami.sd.friend';
  var friend = function () { try { return uncode(sessionStorage.getItem(FR_KEY)); } catch (e) { return null; } };
  var MK = {
    perfect: ['満点？ はいはい、答え見たんでしょ', 'ぼくの出番ゼロ。もう帰っていい？', '満点でドヤ顔してるの、画面ごしに見えてる', '強すぎ。正直ちょっと気持ち悪い',
              'カンニング疑惑。あとで職員室に来て', 'で、満点とって何が言いたいの？'],
    90: ['{weak}だけ落とすの、逆に才能', '満点じゃないんだ。へえ〜、ふーん', 'おしい。おしいけど、負けは負け', 'ドヤる前に{weak}やり直しな？',
         '1問ミスで悔しがる顔、いちばん好き', 'ここまで来て満点じゃないの、ださくない？'],
    75: ['やるじゃん。…で、{weak}のそれは何？', 'できる人っぽい点数。っぽいだけ', 'この点数で自慢すると、上の人に笑われるよ', '中途半端に頭いい人の点数だ',
         '{weak}は見なかったことにしてあげる', '惜しい！…って言ってほしそうな顔してる'],
    60: ['ふつう。おどろくほど、ふつう', '自慢するには低い。隠すには高い。いちばん困るやつ', 'ザ・平均。教科書に載せたいくらい平均', '紙で言うとコピー用紙。白くて、うすい',
         '話題にならない点数、おめでとう', '{weak}がなければ…いや、あってもふつうか'],
    45: ['今日、調子悪かった？ そういうことにしとく', '単語帳、表紙だけきれいなタイプでしょ', 'ぼくのこと、一回もめくってないよね？', '惜しい。何がとは言わないけど、全部',
         'この点数、親に見せられる？', 'スマホの言語設定、英語にするのはまだ早い'],
    0: ['体調悪い？ もう寝な。英語も寝てる', '鉛筆転がしたほうが高くない？ これ', '単語たちが「知らない人」って言ってる', '大丈夫、伸びしろしかない。本当にしかない',
        'ぼく（単語カード）、見たことある？', '受験って知ってる？ 英語あるんだよ'],
    gap: ['{best}は{bg}、{weak}は{wg}。別人が解いた？', '{best}だけ強すぎ。{weak}が置いてけぼりで泣いてる', '{weak}が{wg}って、わざとでしょ？'],
    fast: ['スピードだけは一流。…問題、読んだ？', '速い。速いけど、合ってない', '早押しクイズじゃないんだよ、これ']
  };
  // a line cut where it can break: after 、。？！… or a space (so a bubble never wraps in the middle of a phrase)
  var phrases = function (t) { return t.match(/[^、。？！… ]+[、。？！… ]*|[、。？！… ]+/g) || [t]; };
  // #sd: the 診断 itself (/shindan/); #sdf: a shared result (/shindan/r/<level>-<type>/?s=…), drawn at the end of this file
  var root = document.getElementById('sd'), frRoot = root ? null : document.getElementById('sdf');
  if (!root && !frRoot) return;
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
    sc.total = totalOf(sc);
    var L = clamp(S.ax.vocab.lv, 0, 5), f = Math.floor(L), w = D.words;
    sc.words = Math.round((f >= 5 ? w[5] : w[f] + (w[f + 1] - w[f]) * (L - f)) / 10) * 10;
    sc.title = titleOf(sc.total);
    sc.type = typeOf(sc); sc.lv = levelOf(sc.words);
    return sc;
  }

  // what めくる says about the result: teasing on purpose (the line people share), by the total, or about the gap
  // between the best and the worst axis when it is wide
  function mekuruSays(sc) {
    var by = HEX.slice().sort(function (x, y) { return sc[y] - sc[x]; }), hi = by[0], lo = by[by.length - 1];
    var any = function (a) { return a[Math.floor(Math.random() * a.length)]; }, ls;
    if (sc[hi] - sc[lo] >= 60 && Math.random() < 0.5) ls = MK.gap;
    else if (sc.total < 60 && sc.speed >= 85 && Math.random() < 0.5) ls = MK.fast;
    else ls = sc.total >= 100 ? MK.perfect : sc.total >= 90 ? MK[90] : sc.total >= 75 ? MK[75] : sc.total >= 60 ? MK[60] : sc.total >= 45 ? MK[45] : MK[0];
    return any(ls).replace(/\{best\}/g, NAME[hi]).replace(/\{weak\}/g, NAME[lo]).replace(/\{bg\}/g, grade(sc[hi])).replace(/\{wg\}/g, grade(sc[lo]));
  }

  // grades, as on a status card: each score is a letter with + or − (E− … A+, 15 steps), and S for full marks; the chart
  // puts it on its step: each letter is a band between two rings (E inside … A outside) with −, plain and + in it, and S is
  // the outer ring itself
  var GRADES = ['E', 'D', 'C', 'B', 'A'];
  var STEPS = [[100, 'S'], [97, 'A+'], [90, 'A'], [85, 'A−'], [80, 'B+'], [75, 'B'], [70, 'B−'], [63, 'C+'], [57, 'C'], [50, 'C−'],
               [43, 'D+'], [37, 'D'], [30, 'D−'], [20, 'E+'], [10, 'E'], [0, 'E−']];
  var step = function (v) { for (var i = 0; i < STEPS.length; i++) if (v >= STEPS[i][0]) return i; return STEPS.length - 1; };
  var grade = function (v) { return STEPS[step(v)][1]; };
  var ring = function (v) { var i = step(v); return i ? 0.95 - Math.floor((i - 1) / 3) * 0.2 - (i - 1) % 3 * 0.05 : 1; };

  function hexPoints(sc, cx, cy, R, f) {
    return HEX.map(function (a, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3, v = (sc ? ring(sc[a]) : 1) * (f == null ? 1 : f);
      return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v];
    });
  }
  var pts = function (ps) { return ps.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); };

  // the chart; fr: a friend's result drawn under mine (dashed); still: drawn where it ends (no opening out)
  function hexSVG(sc, fr, still) {
    var cx = 170, cy = 165, R = 104;
    var rings = [1, 2, 3, 4, 5].map(function (k) { return '<polygon points="' + pts(hexPoints(null, cx, cy, R * k / 5)) + '" class="sd-ring' + (k === 5 ? ' out' : '') + '"/>'; }).join('');
    var frArea = fr ? '<polygon points="' + pts(hexPoints(fr, cx, cy, R)) + '" class="sd-fra"/>' : '';
    var spokes = hexPoints(null, cx, cy, R).map(function (p) { return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" class="sd-ring"/>'; }).join('');
    var marks = GRADES.map(function (g, k) { return '<text x="' + (cx + 5) + '" y="' + (cy - R * (k + 1) / 5 + 9).toFixed(1) + '" class="sd-gm">' + g + '</text>'; }).join('');
    var labels = hexPoints(null, cx, cy, R + 34).map(function (p, i) {
      var a = HEX[i], y = p[1] + (i === 0 ? -14 : i === 3 ? 4 : -6);
      return '<g class="sd-pop" style="animation-delay:' + (0.9 + i * 0.09).toFixed(2) + 's"><text x="' + p[0].toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" class="sd-lab">' + NAME[a] + '</text>'
        + '<text x="' + p[0].toFixed(1) + '" y="' + (y + 27).toFixed(1) + '" text-anchor="middle" class="sd-grade g' + grade(sc[a])[0] + '">' + grade(sc[a]) + '</text></g>';
    }).join('');
    return '<svg class="sd-hex' + (still ? ' sd-still' : '') + '" viewBox="0 0 340 340" role="img" aria-label="' + HEX.map(function (a) { return NAME[a] + ' ' + grade(sc[a]); }).join('、') + '">'
      + rings + spokes + marks + frArea + '<polygon points="' + pts(hexPoints(sc, cx, cy, R, still ? 1 : 0)) + '" class="sd-area"/>' + labels + '</svg>';
  }

  // the chart opens out from the middle, overshooting a little before it settles
  function grow(sc) {
    var poly = root.querySelector('.sd-area'), cx = 170, cy = 165, R = 104;
    if (!poly) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { poly.setAttribute('points', pts(hexPoints(sc, cx, cy, R, 1))); root.classList.add('sd-still'); return; }
    var t0 = 0, D = 1100, back = function (t) { var c = 1.9; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };
    var frame = function (now) {
      if (!t0) t0 = now;
      var t = Math.min(1, (now - t0) / D);
      poly.setAttribute('points', pts(hexPoints(sc, cx, cy, R, back(t))));
      if (t < 1) requestAnimationFrame(frame);
    };
    setTimeout(function () { requestAnimationFrame(frame); }, 250);
  }

  function result() {
    var sc = scores();
    sc.mk = mekuruSays(sc);
    S.sc = sc;
    S.mkImg = new Image(); S.mkImg.src = '/assets/mekuru.svg';
    var weak = HEX.slice().sort(function (x, y) { return sc[x] - sc[y]; })[0];
    var best = HEX.slice().sort(function (x, y) { return sc[y] - sc[x]; })[0];
    var miss = S.log.filter(function (l) { return !l.ok; });
    var rows = HEX.map(function (a) { return '<li><span>' + NAME[a] + '</span><i class="sd-trk"><i style="width:' + sc[a] + '%"></i></i><b class="sd-rg g' + grade(sc[a])[0] + '">' + grade(sc[a]) + '</b><small class="num">' + sc[a] + '</small></li>'; }).join('');
    var review = miss.map(function (l) {
      var it = l.it, q = (l.a === 'vocab' || l.a === 'idiom') ? '<b lang="en">' + E(it[0]) + '</b>' : '<span lang="en">' + markup(it[1]) + '</span>';
      return '<li><span class="sd-chip">' + CHIP[l.a] + '</span><p>' + q + '</p><p class="sd-ans">正解：<b' + (l.a === 'deriv' || l.a === 'usage' ? ' lang="en"' : '') + '>' + E(it[2]) + '</b>'
        + (l.chosen ? '<span>あなたの答え：' + E(l.chosen) + '</span>' : '<span>わからない</span>') + '</p>'
        + (it[4] ? '<p class="sd-note">' + E(it[4]) + '</p>' : '')
        + '<a href="/search/?q=' + encodeURIComponent(it[0]) + '" lang="en">' + E(it[0]) + ' の意味と例文 →</a></li>';
    }).join('');
    var ty = tyOf(sc.type), fr = friend();
    var vs = fr ? '<div class="sd-vs"><p class="sd-vs-h">' + (sc.total > fr.total ? '友達に勝ちました' : sc.total < fr.total ? '友達の勝ち…' : '友達と引き分け') + '</p>'
      + '<p class="sd-vs-n"><span class="me"><i></i>あなた <b class="num">' + sc.total + '</b>点・' + E(ty.name) + '</span><span class="fr"><i></i>友達 <b class="num">' + fr.total + '</b>点・' + E(tyOf(fr.type).name) + '</span></p></div>' : '';
    root.innerHTML = '<div class="sd-res">'
      + '<p class="sd-rl">あなたの英単語力</p><p class="sd-total"><b class="num">' + sc.total + '</b><small>点</small><span class="sd-title">' + E(sc.title) + '</span></p>'
      + '<p class="sd-words">推定語彙数 <b class="num">約' + sc.words.toLocaleString('ja-JP') + '語</b><span class="sd-univ">' + E(sc.lv.name) + '</span><small>（中学の単語＋受験英単語の範囲で）</small></p>'
      + '<div class="sd-ty"><span class="sd-chip">タイプ</span><b>' + E(ty.name) + '</b><p>' + E(ty.desc) + '</p></div>'
      + '<div class="sd-mk"><img src="/assets/mekuru.svg" alt="めくる" width="60" height="60"><p>' + phrases(sc.mk).map(function (x) { return '<span class="nw">' + E(x) + '</span>'; }).join('') + '</p></div>'
      + vs + hexSVG(sc, fr)
      + '<ul class="sd-rows">' + rows + '</ul>'
      + '<div class="sd-share"><p class="sd-share-h">結果をシェアして、友達と比べよう</p><a class="sd-x" target="_blank" rel="noopener">Xでシェア</a><a class="sd-line" target="_blank" rel="noopener">LINEで送る</a>'
      + '<button type="button" class="sd-img">結果の画像</button><button type="button" class="sd-img sd-story">ストーリー用の画像</button></div>'
      + '<div class="sd-adv"><b>伸ばすなら「' + NAME[weak] + '」</b><p>' + ADVICE[weak] + '</p><a class="sd-app" href="/app/">無料アプリで覚える →</a></div>'
      + (miss.length ? '<details class="sd-rev"><summary>まちがえた問題（' + miss.length + '問）</summary><ol>' + review + '</ol></details>' : '<p class="sd-perfect">全問正解です。</p>')
      + '<button type="button" class="sd-again">もう一度うける</button>'
      + '<p class="sd-cn">問題は毎回ちがいます。点数は30問から出した目安です。</p></div>';
    var url = SITE + 'r/' + sc.lv.k + '-' + sc.type + '/?s=' + code(sc);
    var text = '英単語力診断の結果は「' + ty.name + '」\n' + sc.lv.name + '（推定語彙数 約' + sc.words.toLocaleString('ja-JP') + '語）・' + sc.total + '点\n'
      + 'めくる「' + sc.mk + '」\n#英単語力診断';
    root.querySelector('.sd-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    root.querySelector('.sd-line').href = 'https://line.me/R/share?text=' + encodeURIComponent(text.replace(/\n#.*$/, '') + '\nあなたは何型？\n' + url);
    S.text = text; S.url = url;
    root.scrollIntoView({ block: 'start' });
    grow(sc);
  }

  // the share pictures: 1200×630 (for X, as the link's own picture is) and 1080×1920 (an Instagram/LINE story)
  var JP = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Noto Sans CJK JP","Yu Gothic UI","Meiryo",sans-serif', EN = 'Figtree,' + JP;
  var BLUE = '#083FF9', INKC = '#1a1a1a', SUBC = '#5f5f5f';
  var gradeColor = function (gr) { return gr === 'S' ? '#C98A00' : gr[0] === 'A' ? BLUE : gr[0] === 'E' ? '#9a9a9a' : INKC; };
  // the largest font size (at most fs) that keeps text within w
  function fitFont(g, text, weight, fs, family, w) {
    for (; fs > 14; fs--) { g.font = weight + ' ' + fs + 'px ' + family; if (g.measureText(text).width <= w) break; }
    return fs;
  }
  function drawHex(g, sc, cx, cy, R, fl, fg) {
    [1, 2, 3, 4, 5].forEach(function (k) { var p = hexPoints(null, cx, cy, R * k / 5); g.beginPath(); p.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.strokeStyle = k === 5 ? '#c9c9c9' : '#e5e5e5'; g.lineWidth = 2; g.stroke(); });
    g.strokeStyle = '#e5e5e5';
    hexPoints(null, cx, cy, R).forEach(function (q) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(q[0], q[1]); g.stroke(); });
    g.fillStyle = '#9a9a9a'; g.font = '700 ' + Math.round(fl * 0.72) + 'px ' + EN; g.textAlign = 'left';
    GRADES.forEach(function (gr, k) { g.fillText(gr, cx + 7, cy - R * (k + 1) / 5 + fl * 0.64); });
    var p = hexPoints(sc, cx, cy, R);
    g.beginPath(); p.forEach(function (q, i) { i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath();
    g.fillStyle = 'rgba(8,63,249,.28)'; g.fill(); g.strokeStyle = BLUE; g.lineWidth = 4; g.lineJoin = 'round'; g.stroke();
    g.textAlign = 'center';
    hexPoints(null, cx, cy, R + fg * 1.4).forEach(function (q, i) {
      var y = q[1] + (i === 0 ? -fg * 0.55 : i === 3 ? fg * 0.1 : -fg * 0.2), gr = grade(sc[HEX[i]]);
      g.fillStyle = INKC; g.font = '700 ' + fl + 'px ' + JP; g.fillText(NAME[HEX[i]], q[0], y);
      g.fillStyle = gradeColor(gr); g.font = '800 ' + fg + 'px ' + EN; g.fillText(gr, q[0], y + fg * 1.05);
    });
    g.textAlign = 'left';
  }
  // めくる at (x, y), size s, and what it says in a bubble to its right, lines at most w wide
  function drawMekuru(g, text, x, y, s, fs, w) {
    if (S.mkImg && S.mkImg.complete && S.mkImg.naturalWidth) g.drawImage(S.mkImg, x, y, s, s);
    g.font = '700 ' + fs + 'px ' + JP;
    var lines = [], cur = '', lh = Math.round(fs * 1.44);
    phrases(text).forEach(function (t) {
      if (g.measureText(cur + t).width <= w || !cur) cur += t; else { lines.push(cur); cur = t; }
      while (g.measureText(cur).width > w) { var k = cur.length - 1; while (k > 1 && g.measureText(cur.slice(0, k)).width > w) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
    });
    lines.push(cur);
    var bx = x + s + 6, bw = Math.max.apply(null, lines.map(function (l) { return g.measureText(l).width; })) + fs * 1.76, bh = fs + lines.length * lh, by = y + s / 2 - bh / 2, r = 18;
    g.beginPath(); g.moveTo(bx + r, by); g.lineTo(bx + bw - r, by); g.arcTo(bx + bw, by, bx + bw, by + r, r); g.lineTo(bx + bw, by + bh - r);
    g.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r); g.lineTo(bx + r, by + bh); g.arcTo(bx, by + bh, bx, by + bh - r, r);
    g.lineTo(bx, by + bh / 2 + 10); g.lineTo(bx - 14, by + bh / 2); g.lineTo(bx, by + bh / 2 - 10); g.lineTo(bx, by + r); g.arcTo(bx, by, bx + r, by, r); g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = INKC; g.textAlign = 'left';
    lines.forEach(function (l, k) { g.fillText(l, bx + fs * 0.88, by + fs * 0.5 + lh * 0.5 + fs * 0.36 + k * lh); });
  }
  function pill(g, text, x, y, fs, center) {
    g.font = '700 ' + fs + 'px ' + JP;
    var w = g.measureText(text).width + fs * 1.3, h = fs * 1.7, x0 = center ? x - w / 2 : x;
    g.fillStyle = BLUE; g.beginPath(); g.roundRect ? g.roundRect(x0, y, w, h, h / 2) : g.rect(x0, y, w, h); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(text, x0 + w / 2, y + h / 2 + fs * 0.36); g.textAlign = 'left';
  }

  function drawImage() {
    var sc = S.sc, ty = tyOf(sc.type), W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = BLUE; g.fillRect(0, 0, W, 12);
    g.textBaseline = 'alphabetic';
    g.fillStyle = SUBC; g.font = '500 26px ' + JP; g.fillText('英単語力診断の結果', 72, 74);
    g.fillStyle = INKC; fitFont(g, ty.name, '800', 76, JP, 560); g.fillText(ty.name, 68, 158);
    fitFont(g, sc.lv.name, '700', 30, JP, 520); pill(g, sc.lv.name, 72, 186, +g.font.match(/(\d+)px/)[1]);
    g.fillStyle = SUBC; g.font = '500 24px ' + JP; g.fillText('推定語彙数 約' + sc.words.toLocaleString('ja-JP') + '語', 74, 290);
    g.fillStyle = BLUE; g.font = '700 84px ' + EN; g.fillText(String(sc.total), 70, 380);
    var tw = g.measureText(String(sc.total)).width;
    g.fillStyle = INKC; g.font = '700 30px ' + JP; g.fillText('点　' + sc.title, 78 + tw, 376);
    drawMekuru(g, sc.mk, 54, 410, 112, 24, 360);
    g.font = '700 24px ' + JP; g.fillStyle = INKC; g.fillText('極（きわみ）', 72, 604);
    var bw2 = g.measureText('極（きわみ）').width;
    g.fillStyle = SUBC; g.font = '500 20px ' + EN; g.fillText('kiwami-eitango.com/shindan/', 72 + bw2 + 16, 603);
    drawHex(g, sc, 870, 318, 168, 22, 40);
    return c;
  }

  function drawStory() {
    var sc = S.sc, ty = tyOf(sc.type), W = 1080, H = 1920, c = document.createElement('canvas'), mid = W / 2;
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = BLUE; g.fillRect(0, 0, W, 18);
    g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    g.fillStyle = SUBC; g.font = '500 40px ' + JP; g.fillText('英単語力診断の結果', mid, 200);
    g.fillStyle = INKC; fitFont(g, ty.name, '800', 120, JP, 940); g.textAlign = 'center'; g.fillText(ty.name, mid, 340);
    fitFont(g, sc.lv.name, '700', 50, JP, 860); pill(g, sc.lv.name, mid, 392, +g.font.match(/(\d+)px/)[1], true);
    g.textAlign = 'center';
    g.fillStyle = SUBC; g.font = '500 40px ' + JP; g.fillText('推定語彙数 約' + sc.words.toLocaleString('ja-JP') + '語', mid, 560);
    g.fillStyle = BLUE; g.font = '700 120px ' + EN;
    var t = String(sc.total), tw = g.measureText(t).width;
    g.font = '700 44px ' + JP;
    var sw = g.measureText('点　' + sc.title).width, x0 = mid - (tw + 8 + sw) / 2;
    g.textAlign = 'left'; g.fillStyle = BLUE; g.font = '700 120px ' + EN; g.fillText(t, x0, 700);
    g.fillStyle = INKC; g.font = '700 44px ' + JP; g.fillText('点　' + sc.title, x0 + tw + 8, 694);
    drawHex(g, sc, mid, 1120, 240, 34, 60);
    drawMekuru(g, sc.mk, 90, 1570, 170, 38, 640);
    g.textAlign = 'center';
    g.fillStyle = INKC; g.font = '700 46px ' + JP; g.fillText('あなたは何型？', mid, 1812);
    g.fillStyle = SUBC; g.font = '500 34px ' + EN; g.fillText('kiwami-eitango.com/shindan/', mid, 1866);
    g.textAlign = 'left';
    return c;
  }

  function saveImage(story) {
    var pic = S.mkImg && S.mkImg.decode ? S.mkImg.decode().catch(function () {}) : Promise.resolve();
    Promise.all([document.fonts && document.fonts.ready ? document.fonts.ready : null, pic]).then(function () {
      var name = story ? 'kiwami-shindan-story.png' : 'kiwami-shindan.png';
      (story ? drawStory() : drawImage()).toBlob(function (blob) {
        if (!blob) return;
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: S.text + '\n' + S.url }).catch(function () {});
          return;
        }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    });
  }

  // a shared result (/shindan/r/<level>-<type>/?s=…): the friend's numbers and chart over the type's own text, and kept
  // for this tab so their chart goes beside mine at the end of my 診断. Without ?s= (or a bad one) the page stays as built
  function friendPage(el) {
    var sc = uncode((location.search.match(/[?&]s=([\d.]+)/) || [])[1]), box = el.querySelector('.sd-frx');
    if (!sc || !box) return;
    try { sessionStorage.setItem(FR_KEY, code(sc)); } catch (e) {}
    box.innerHTML = '<p class="sd-rl">友達の結果</p><p class="sd-total"><b class="num">' + sc.total + '</b><small>点</small><span class="sd-title">' + E(sc.title) + '</span></p>'
      + '<p class="sd-words">推定語彙数 <b class="num">約' + sc.words.toLocaleString('ja-JP') + '語</b></p>' + hexSVG(sc, null, true);
    var go = el.querySelector('.sd-go');
    if (go) go.textContent = 'あなたも診断して、比べる';
  }

  if (frRoot) { friendPage(frRoot); return; }
  // came from a friend's result: say so above the start button
  var frs = friend(), startBtn = root.querySelector('.sd-start');
  if (frs && startBtn) startBtn.insertAdjacentHTML('beforebegin', '<p class="sd-frb">友達の結果は <b>' + frs.total + '点・' + E(tyOf(frs.type).name) + '</b>。あなたは勝てる？</p>');
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('button');
    if (!t) return;
    if (t.classList.contains('sd-start') || t.classList.contains('sd-again')) start();
    else if (t.classList.contains('sd-o')) answer(+t.dataset.k);
    else if (t.classList.contains('sd-skip')) answer(-1);
    else if (t.classList.contains('sd-img')) saveImage(t.classList.contains('sd-story'));
  });
  document.addEventListener('keydown', function (ev) {
    if (!S || !S.cur || S.cur.done || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var k = '1234'.indexOf(ev.key);
    if (k >= 0 && k < S.cur.opts.length) { ev.preventDefault(); answer(k); }
  });
  load().catch(function () {});   // fetched while the intro is read
})();
