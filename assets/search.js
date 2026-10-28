/* WenServer Wiki 通用搜索：分词/排序/高亮/别名/历史/精确跳转/滚动修复 */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var box = document.getElementById("searchBox");
    if (!box) return;

    // 用克隆替换输入框/按钮，剥离旧脚本绑定的监听，避免重复处理
    var clone = box.cloneNode(true);
    if (box.parentNode) box.parentNode.replaceChild(clone, box);
    box = clone;

    var oldBtn = document.getElementById("searchBtn");
    if (oldBtn && oldBtn.parentNode) {
      var btnClone = oldBtn.cloneNode(true);
      oldBtn.parentNode.replaceChild(btnClone, oldBtn);
    }

    var panel = document.getElementById("searchPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "searchPanel";
      panel.className = "search-panel";
      panel.hidden = true;
      document.body.appendChild(panel);
    }
    panel.innerHTML = "";

    var articles = Array.prototype.slice.call(document.querySelectorAll("article.article, main .article"));
    if (!articles.length) articles = Array.prototype.slice.call(document.querySelectorAll("[data-search]"));

    var ALIAS = {
      "luck": ["幸运方块","luckyblocks"], "lucky": ["幸运方块","luckyblocks"],
      "electric": ["电力","电"], "electricity": ["电力"], "power": ["电力","发电","发电机"],
      "generator": ["发电机","发电"], "energy": ["电力","能量","能源"],
      "ore": ["矿石","矿","矿物"], "crystal": ["结晶","水晶"], "rune": ["符文"],
      "recipe": ["配方","合成"], "craft": ["合成","配方","工作台"],
      "storage": ["存储","背包","仓库"], "backpack": ["背包"], "chest": ["箱","箱子","末影箱"],
      "talisman": ["护符","护身符"], "android": ["机器人"], "robot": ["机器人"],
      "cargo": ["货运","运输"], "gps": ["gps","导航"], "radiation": ["辐射","放射性"], "radioactive": ["辐射","放射性"],
      "smeltery": ["冶炼","冶炼炉"], "alloy": ["合金"], "machine": ["机器"], "multiblock": ["多方块"],
      "food": ["食物","美食"], "cook": ["烹饪","美食","厨师"], "seed": ["种子"],
      "farmer": ["农夫","农业"], "miner": ["矿工","矿机"], "chicken": ["鸡","基因鸡"], "gene": ["基因"],
      "space": ["星际","太空"], "rocket": ["火箭"], "missile": ["导弹"], "gun": ["枪","枪械"],
      "warfare": ["战争"], "boss": ["首领","boss"], "ender": ["末影"], "magic": ["魔法","魔法结晶"],
      "alchemy": ["炼金"], "soul": ["灵魂"], "nether": ["下界"], "chunk": ["区块"],
      "singularity": ["奇点"], "emc": ["emc","等价交换"], "tinker": ["匠魂"],
      "reactor": ["反应堆"], "solar": ["太阳能","太阳"], "wind": ["风力","风"],
      "pump": ["泵","抽取"], "elevator": ["电梯"], "teleporter": ["传送","传送器"],
      "quarry": ["矿机","采石"], "infinity": ["无尽"], "chick": ["鸡","基因鸡"],
      "mcmmo": ["mcmmo","技能"], "skill": ["技能"], "level": ["等级","经验"],
      "dungeon": ["地牢","副本"], "structure": ["结构","建筑"], "world": ["世界","地形"]
    };

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function norm(s) { return (s || "").trim().toLowerCase(); }
    function reEscape(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    var index = articles.map(function (art) {
      var titleEl = art.querySelector("h1, h2");
      var crumbs = art.querySelector(".breadcrumbs");
      var hs = Array.prototype.slice.call(art.querySelectorAll("h3"));
      var sections = hs.map(function (h, i) {
        var id = (art.id || "art") + "__s" + i;
        if (!h.id) h.id = id;
        return { id: h.id || id, text: norm(h.textContent) };
      });
      var heads = sections.map(function (s) { return s.text; }).join(" ");
      var kw = art.getAttribute("data-search") || "";
      var body = art.textContent || "";
      return {
        id: art.id || "art",
        title: titleEl ? titleEl.textContent.trim() : (art.id || "未命名"),
        crumbs: crumbs ? crumbs.textContent.trim() : "",
        sections: sections,
        fields: [
          { w: 100, t: norm(titleEl ? titleEl.textContent : "") },
          { w: 55, t: norm(kw) },
          { w: 35, t: heads },
          { w: 6, t: norm(body) }
        ],
        body: body
      };
    });

    function hi(s, toks) {
      var safe = esc(s);
      var pat = toks.map(function (t) { return reEscape(t); }).join("|");
      if (!pat) return safe;
      return safe.replace(new RegExp("(" + pat + ")", "gi"), "<mark>$1</mark>");
    }

    function snippet(body, toks) {
      var b = norm(body);
      var idx = -1;
      toks.forEach(function (t) { var i = b.indexOf(t); if (i >= 0 && (idx < 0 || i < idx)) idx = i; });
      if (idx < 0) return "";
      var start = Math.max(0, idx - 40);
      var end = Math.min(b.length, idx + 90);
      var s = body.slice(start, end);
      if (start > 0) s = "… " + s;
      if (end < b.length) s = s + " …";
      return hi(s.replace(/\s+/g, " "), toks);
    }

    function tokenGroups(q) {
      return norm(q).split(/\s+/).filter(Boolean).map(function (t) {
        var g = [t];
        var ex = ALIAS[t];
        if (ex) ex.forEach(function (x) { if (g.indexOf(x) === -1) g.push(x); });
        return g;
      });
    }

    function fieldHit(fieldText, tk, prefix) {
      if (fieldText.indexOf(tk) !== -1) return true;
      if (prefix && tk.length >= 2) {
        return new RegExp("(^|[\\s/])" + reEscape(tk)).test(fieldText);
      }
      return false;
    }

    function matchScore(e, groups, prefix) {
      var total = 0;
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g], best = 0, found = false;
        for (var t = 0; t < grp.length && !found; t++) {
          var tk = grp[t];
          for (var j = 0; j < e.fields.length; j++) {
            if (fieldHit(e.fields[j].t, tk, prefix)) {
              found = true;
              if (e.fields[j].w > best) best = e.fields[j].w;
            }
          }
        }
        if (!found) return 0;
        total += best;
      }
      return total;
    }

    function bestSection(e, plain) {
      for (var i = 0; i < plain.length; i++) {
        var tk = plain[i];
        for (var j = 0; j < e.sections.length; j++) {
          if (e.sections[j].text.indexOf(tk) !== -1) return e.sections[j].id;
        }
      }
      return e.id;
    }

    function clearMarks(root) {
      var marks = (root || document).querySelectorAll("mark.search-mark");
      Array.prototype.forEach.call(marks, function (m) {
        var p = m.parentNode;
        if (p) { p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); }
      });
    }

    function markTokens(art, toks) {
      var pat = toks.map(reEscape).join("|");
      if (!pat) return;
      var re = new RegExp("(" + pat + ")", "gi");
      var walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.tagName;
          if (tag === "MARK" || tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          re.lastIndex = 0;
          return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        var text = node.nodeValue;
        var parent = node.parentNode;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          var mark = document.createElement("mark");
          mark.className = "search-mark";
          mark.textContent = m[0];
          frag.appendChild(mark);
          last = m.index + m[0].length;
          if (m.index === re.lastIndex) re.lastIndex++;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        parent.replaceChild(frag, node);
      });
    }

    function jumpToMatch(aid, q) {
      clearMarks(document);
      var art = document.getElementById(aid);
      if (!art) return;
      var toks = tokenGroups(q).map(function (g) { return g[0]; });
      markTokens(art, toks);
      var first = art.querySelector("mark.search-mark");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      else art.scrollIntoView({ behavior: "smooth", block: "start" });
      try { history.replaceState(null, "", "#" + aid); } catch (err) {}
    }

    // —— 搜索历史 ——
    var HIST_KEY = "wiki_search_history_v1";
    function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; } }
    function saveHist(q) {
      if (!q) return;
      var h = loadHist().filter(function (x) { return x !== q; });
      h.unshift(q);
      h = h.slice(0, 8);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {}
    }
    function clearHist() { try { localStorage.removeItem(HIST_KEY); } catch (e) {} }

    function renderHistory() {
      var h = loadHist();
      if (!h.length) return "";
      return '<div class="sr-history">' + h.map(function (q) {
        return '<button type="button" class="hist-tag" data-q="' + esc(q) + '">' + esc(q) + '</button>';
      }).join("") + '</div>';
    }

    function positionPanel() {
      if (panel.hidden) return;
      var r = box.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var w = Math.min(440, vw - 16);
      var left = r.right - w;
      if (left < 8) left = 8;
      if (left + w > vw - 8) left = vw - 8 - w;
      panel.style.top = (r.bottom + 6) + "px";
      panel.style.left = left + "px";
      panel.style.width = w + "px";
    }

    function lockScroll(lock) {
      if (lock) {
        document.documentElement.classList.add("searching");
        if (document.body) document.body.classList.add("search-lock");
      } else {
        document.documentElement.classList.remove("searching");
        if (document.body) document.body.classList.remove("search-lock");
      }
    }

    function bindPanel() {
      var c = document.getElementById("srClear");
      if (c) c.addEventListener("click", function () { clearMarks(document); box.value = ""; panel.hidden = true; panel.innerHTML = ""; box.focus(); });
      var hc = document.getElementById("histClear");
      if (hc) hc.addEventListener("click", function () { clearHist(); showHistory(); });
      var tags = panel.querySelectorAll(".hist-tag");
      Array.prototype.forEach.call(tags, function (t) {
        t.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          box.value = t.getAttribute("data-q");
          if (box.focus) box.focus({ preventScroll: true });
          runSearch();
        });
      });
    }

    function showHistory() {
      var h = loadHist();
      if (!h.length) { panel.hidden = true; panel.innerHTML = ""; return; }
      panel.hidden = false;
      panel.innerHTML = '<div class="sr-head"><span class="sr-meta">最近搜索</span><button type="button" class="hist-clear" id="histClear">清除记录</button></div>' + renderHistory();
      bindPanel();
      positionPanel();
    }

    function runSearch() {
      var q = norm(box.value);
      if (!q) { showHistory(); return; }
      var groups = tokenGroups(q);
      var plain = groups.map(function (g) { return g[0]; });
      var results = [];
      index.forEach(function (e) {
        var s = matchScore(e, groups, false);
        if (s) results.push({ e: e, score: s });
      });
      if (!results.length) {
        index.forEach(function (e) {
          var s = matchScore(e, groups, true);
          if (s) results.push({ e: e, score: s - 30 });
        });
      }
      results.sort(function (a, b) { return b.score - a.score; });
      panel.hidden = false;
      positionPanel();
      var head = '<div class="sr-head"><span class="sr-meta">共 ' + results.length + ' 个结果</span><button type="button" class="sr-clear" id="srClear">清空</button></div>';
      var list;
      if (results.length) {
        list = '<ul class="sr-list">' + results.slice(0, 50).map(function (r) {
          var anchor = bestSection(r.e, plain);
          var snip = snippet(r.e.body, plain);
          return '<li><a href="#' + anchor + '" data-aid="' + r.e.id + '" data-q="' + esc(q) + '">' + hi(r.e.title, plain) + '</a>' +
            (r.e.crumbs ? '<div class="sr-snip">' + esc(r.e.crumbs) + '</div>' : '') +
            (snip ? '<div class="sr-snip">' + snip + '</div>' : '') + '</li>';
        }).join("") + '</ul>';
      } else {
        list = '<div class="search-empty">无匹配结果。试试更短的关键词、中文名或英文名。</div>';
      }
      panel.innerHTML = head + list;
      bindPanel();
      var links = panel.querySelectorAll(".sr-list a");
      Array.prototype.forEach.call(links, function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          saveHist(a.getAttribute("data-q") || q);
          panel.hidden = true;
          jumpToMatch(a.getAttribute("data-aid"), a.getAttribute("data-q") || q);
        });
      });
    }

    var tmr = null;
    var guardY = null;
    function guardScroll() {
      var y = guardY;
      if (y === null) return;
      requestAnimationFrame(function () {
        if (guardY !== null && Math.abs((window.scrollY || 0) - guardY) > 2) {
          window.scrollTo(0, guardY);
        }
      });
    }

    box.addEventListener("mousedown", function (e) {
      guardY = window.scrollY || window.pageYOffset;
      if (document.activeElement !== box) {
        e.preventDefault();
        box.focus({ preventScroll: true });
      }
    });
    box.addEventListener("input", function () {
      guardY = window.scrollY || window.pageYOffset;
      clearTimeout(tmr);
      tmr = setTimeout(function () { runSearch(); guardScroll(); }, 120);
    });
    box.addEventListener("focus", function () {
      lockScroll(true);
      if (!norm(box.value)) showHistory();
      var y = guardY;
      if (y !== null) {
        window.scrollTo(0, y);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (Math.abs((window.scrollY || 0) - y) > 2) window.scrollTo(0, y);
          });
        });
      }
    });
    box.addEventListener("blur", function () { guardY = null; lockScroll(false); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var a = panel.querySelector(".sr-list a");
        if (a) { saveHist(norm(box.value)); panel.hidden = true; jumpToMatch(a.getAttribute("data-aid"), norm(box.value)); }
      }
      if (e.key === "Escape") { clearMarks(document); box.value = ""; panel.hidden = true; panel.innerHTML = ""; lockScroll(false); if (box.blur) box.blur(); }
    });
    document.addEventListener("click", function (e) {
      if (panel && !panel.hidden) {
        var inSearch = e.target && e.target.closest && (e.target.closest(".wiki-search") || e.target.closest(".search-panel"));
        if (!inSearch) panel.hidden = true;
      }
    });
    var sbtn = document.getElementById("searchBtn");
    if (sbtn) sbtn.addEventListener("click", runSearch);
    window.addEventListener("resize", function () { if (panel && !panel.hidden) positionPanel(); });
  });
})();
