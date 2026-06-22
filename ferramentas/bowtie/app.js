/* ============================================================
   BOWTIE SGI — Editor visual de diagramas de risco
   Modelo segue NBR IEC 31010:2021 (6 elementos):
   Perigo, Evento Topo, Ameaças, Consequências,
   Barreiras (controles) e Fatores de Degradação.

   Cada controle/barreira carrega: tipo, Controle Crítico (CC),
   status de operação (ativo/inativo) e implementação.
   Cada risco carrega: status (ativo/inativo), cenário e
   etiquetas de operação (tags) para filtros no inventário.
   ============================================================ */

const App = (() => {
  // ---------- Estado do diagrama atual ----------
  let state = novoEstado();
  let sb = null;              // cliente Supabase (ou null se não configurado)
  let drawerCtx = null;       // controle aberto na gaveta { obj, onExcluir }

  function novoEstado() {
    return UI.normalizarDados({
      id: null,
      nome: "",
      ameacas: [],
      consequencias: [],
    });
  }

  function novoControle(texto) {
    return UI.normCtl({ id: UI.uid("b"), texto: texto || "Controle / barreira", fatores: [] });
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const canvas = () => document.getElementById("canvas");
  const wires = () => document.getElementById("wires");
  const status = (msg) => (document.getElementById("status").textContent = msg || "");
  const q = (sel) => canvas().querySelector(sel);
  const el = (id) => document.getElementById(id);

  // ---------- Inicialização ----------
  function init() {
    const keyOk = CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_ANON_KEY.startsWith("eyJ");
    if (keyOk && window.supabase) {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } else {
      el("avisoConfig").classList.remove("escondido");
    }

    // botões da barra
    el("btnNovo").addEventListener("click", novo);
    el("btnAmeaca").addEventListener("click", addAmeaca);
    el("btnConsequencia").addEventListener("click", addConsequencia);
    el("btnSalvar").addEventListener("click", salvar);
    el("btnAbrir").addEventListener("click", abrirPainel);
    el("btnImprimir").addEventListener("click", () => window.print());
    el("painelFechar").addEventListener("click", fecharPainel);
    el("nomeDiagrama").addEventListener("input", (e) => (state.nome = e.target.value));

    // propriedades do risco
    el("statusRisco").addEventListener("click", () => {
      state.statusRisco = state.statusRisco === "ativo" ? "inativo" : "ativo";
      atualizarPropsUI();
    });
    el("cenario").addEventListener("change", (e) => (state.cenario = e.target.value));
    el("tagInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(e.target.value);
        e.target.value = "";
      }
    });
    // tag digitada mas sem Enter não pode se perder
    el("tagInput").addEventListener("blur", (e) => {
      if (e.target.value.trim()) { addTag(e.target.value); e.target.value = ""; }
    });

    // gaveta de detalhes do controle
    const selTipo = el("dTipo");
    UI.TIPOS_CONTROLE.forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = label;
      selTipo.appendChild(o);
    });
    el("drawerFechar").addEventListener("click", fecharDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { fecharDrawer(); fecharPainel(); } });
    el("dTexto").addEventListener("input", (e) => { if (drawerCtx) { drawerCtx.obj.texto = e.target.value; render(); } });
    el("dTipo").addEventListener("change", (e) => { if (drawerCtx) { drawerCtx.obj.tipo = e.target.value; render(); } });
    el("dCC").addEventListener("change", (e) => { if (drawerCtx) { drawerCtx.obj.cc = e.target.checked; render(); } });
    el("dStatusOp").addEventListener("change", (e) => { if (drawerCtx) { drawerCtx.obj.statusOp = e.target.value; render(); } });
    el("dStatusImpl").addEventListener("change", (e) => { if (drawerCtx) { drawerCtx.obj.statusImpl = e.target.value; render(); } });
    el("dExcluir").addEventListener("click", () => {
      if (!drawerCtx) return;
      if (!confirm("Excluir este controle? Esta ação não pode ser desfeita.")) return;
      const fn = drawerCtx.onExcluir;
      fecharDrawer();
      fn();
    });

    atualizarPropsUI();
    render();

    // abrir diagrama vindo do inventário (?id=...)
    const idParam = new URLSearchParams(location.search).get("id");
    if (idParam && sb) carregar(idParam);
  }

  // ---------- Propriedades do risco (status, cenário, tags) ----------
  function atualizarPropsUI() {
    const pill = el("statusRisco");
    pill.classList.toggle("ativo", state.statusRisco === "ativo");
    pill.classList.toggle("inativo", state.statusRisco !== "ativo");
    pill.textContent = state.statusRisco === "ativo" ? "Risco ativo" : "Risco inativo";
    el("cenario").value = state.cenario || "";
    renderTags();
  }

  function addTag(valor) {
    const tag = (valor || "").trim().replace(/\s+/g, " ");
    if (!tag) return;
    if (state.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      UI.toast("Esta operação já foi adicionada.", "info");
      return;
    }
    state.tags.push(tag);
    renderTags();
  }

  function renderTags() {
    const box = el("tagsChips");
    box.innerHTML = "";
    state.tags.forEach((tag, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const txt = document.createElement("span");
      txt.textContent = tag;
      const x = document.createElement("i");
      x.className = "chip-x";
      x.textContent = "✕";
      x.title = "Remover";
      x.onclick = () => { state.tags.splice(i, 1); renderTags(); };
      chip.append(txt, x);
      box.appendChild(chip);
    });
  }

  // ---------- Adicionar elementos ----------
  function addAmeaca() {
    // nasce sempre abaixo do cartão mais baixo, nunca em cima de outro
    const ys = state.ameacas.map((a) => a.y || 0);
    const y = ys.length ? Math.max(...ys) + 170 : 130;
    state.ameacas.push({ id: UI.uid("a"), texto: "Causa / ameaça", x: 90, y, barreiras: [] });
    render();
  }

  function addConsequencia() {
    const ys = state.consequencias.map((c) => c.y || 0);
    const y = ys.length ? Math.max(...ys) + 170 : 130;
    state.consequencias.push({ id: UI.uid("c"), texto: "Consequência", x: 930, y, barreiras: [] });
    render();
  }

  function addBarreira(lado, parentId) {
    const lista = lado === "ameaca" ? state.ameacas : state.consequencias;
    const item = lista.find((x) => x.id === parentId);
    if (item) { item.barreiras.push(novoControle()); render(); }
  }

  function addFator(b) {
    b.fatores.push({ id: UI.uid("f"), texto: "Fator de degradação", dx: 0, dy: 0, barreiras: [] });
    render();
  }

  function addFatorBarreira(f) {
    f.barreiras.push(UI.normCtl({ id: UI.uid("fb"), texto: "Barreira do fator" }));
    render();
  }

  // ---------- Remover ----------
  function removerNode(lado, id) {
    if (lado === "ameaca") state.ameacas = state.ameacas.filter((x) => x.id !== id);
    else state.consequencias = state.consequencias.filter((x) => x.id !== id);
    render();
  }
  function removerBarreira(lado, parentId, bId) {
    const lista = lado === "ameaca" ? state.ameacas : state.consequencias;
    const item = lista.find((x) => x.id === parentId);
    if (item) item.barreiras = item.barreiras.filter((b) => b.id !== bId);
    render();
  }
  function removerFator(b, fid) {
    b.fatores = b.fatores.filter((f) => f.id !== fid);
    render();
  }
  function removerFatorBarreira(f, fbid) {
    f.barreiras = f.barreiras.filter((x) => x.id !== fbid);
    render();
  }

  // ---------- Gaveta de detalhes ----------
  function abrirDrawer(obj, titulo, onExcluir) {
    drawerCtx = { obj, onExcluir };
    el("drawerTitulo").textContent = titulo;
    el("dTexto").value = obj.texto || "";
    el("dTipo").value = obj.tipo || "";
    el("dCC").checked = !!obj.cc;
    el("dStatusOp").value = obj.statusOp || "ativo";
    el("dStatusImpl").value = obj.statusImpl || "";
    el("drawer").classList.add("aberto");
  }
  function fecharDrawer() {
    drawerCtx = null;
    el("drawer").classList.remove("aberto");
  }

  // verifica se o controle aberto na gaveta ainda existe no estado
  function controleExiste(obj) {
    for (const lista of [state.ameacas, state.consequencias]) {
      for (const n of lista) {
        for (const b of n.barreiras) {
          if (b === obj) return true;
          for (const f of b.fatores) {
            for (const fb of f.barreiras) if (fb === obj) return true;
          }
        }
      }
    }
    return false;
  }

  // ---------- Renderização ----------
  function render() {
    [...canvas().querySelectorAll(".node, .barreira, .fator, .fbarreira")].forEach((n) => n.remove());

    // PERIGO (fonte de risco)
    const perigoEl = criarNode({
      classe: "perigo",
      texto: state.perigoTexto,
      x: state.perigoX, y: state.perigoY,
      idNode: "perigo",
      onTexto: (t) => (state.perigoTexto = t),
      onDrag: (x, y) => { state.perigoX = x; state.perigoY = y; },
    });
    perigoEl.querySelector(".cabeca").innerHTML = '<span class="chip-perigo">Perigo</span>';

    // EVENTO TOPO
    criarNode({
      classe: "evento",
      cabeca: "Evento topo",
      texto: state.eventoTexto,
      x: state.eventoX, y: state.eventoY,
      idNode: "evento",
      onTexto: (t) => (state.eventoTexto = t),
      onDrag: (x, y) => { state.eventoX = x; state.eventoY = y; },
    });

    // AMEAÇAS
    state.ameacas.forEach((a) => {
      criarNode({
        classe: "ameaca", cabeca: "Ameaça", texto: a.texto, x: a.x, y: a.y,
        idNode: a.id, parentId: a.id, lado: "ameaca",
        onTexto: (t) => (a.texto = t),
        onDrag: (x, y) => { a.x = x; a.y = y; },
      });
      renderControles("ameaca", a.id, a.barreiras);
    });

    // CONSEQUÊNCIAS
    state.consequencias.forEach((c) => {
      criarNode({
        classe: "consequencia", cabeca: "Consequência", texto: c.texto, x: c.x, y: c.y,
        idNode: c.id, parentId: c.id, lado: "consequencia",
        onTexto: (t) => (c.texto = t),
        onDrag: (x, y) => { c.x = x; c.y = y; },
      });
      renderControles("consequencia", c.id, c.barreiras);
    });

    layout();

    // se o controle aberto na gaveta foi excluído pelo cartão, fecha a gaveta
    if (drawerCtx && !controleExiste(drawerCtx.obj)) fecharDrawer();
  }

  function renderControles(lado, parentId, barreiras) {
    barreiras.forEach((b) => {
      criarBarreira(lado, parentId, b);
      b.fatores.forEach((f) => {
        criarFator(b, f);
        f.barreiras.forEach((fb) => criarFatorBarreira(f, fb));
      });
    });
  }

  // ---------- Criação de caixas (DOM) ----------
  function criarNode(o) {
    const div = document.createElement("div");
    div.className = "node " + o.classe;
    div.style.left = o.x + "px";
    div.style.top = o.y + "px";
    div.dataset.id = o.idNode;

    const cabeca = document.createElement("div");
    cabeca.className = "cabeca";
    cabeca.textContent = o.cabeca || "";
    cabeca.title = "Arraste para mover";

    const corpo = document.createElement("div");
    corpo.className = "corpo";
    corpo.contentEditable = "plaintext-only";
    corpo.textContent = o.texto;
    corpo.addEventListener("input", () => o.onTexto(corpo.textContent));

    div.append(cabeca, corpo);

    if (o.lado) {
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      acoes.append(
        mini("+ controle", () => addBarreira(o.lado, o.parentId)),
        miniX("excluir", () => {
          if (confirm("Excluir este item e todos os seus controles?")) removerNode(o.lado, o.parentId);
        })
      );
      div.append(acoes);
    }

    arrastarNode(div, cabeca, o.onDrag);
    canvas().appendChild(div);
    return div;
  }

  function badgesDe(ctl) {
    const box = document.createElement("div");
    box.className = "badges";
    const add = (classe, texto) => {
      const s = document.createElement("span");
      s.className = "badge " + classe;
      s.textContent = texto;
      box.appendChild(s);
    };
    add(ctl.tipo ? "neutro" : "warn", UI.TIPO_LABEL[ctl.tipo] || "definir tipo");
    if (ctl.cc) add("cc", "CC");
    add(ctl.statusOp === "ativo" ? "ok" : "off", ctl.statusOp === "ativo" ? "Ativo" : "Inativo");
    if (ctl.statusImpl === "implementado") add("ok", "Implementado");
    else if (ctl.statusImpl === "nao_implementado") add("bad", "Não implementado");
    else add("warn", "implantação?");
    return box;
  }

  function criarBarreira(lado, parentId, b) {
    const div = document.createElement("div");
    div.className = "barreira";
    div.dataset.bid = b.id;

    const grip = document.createElement("div");
    grip.className = "grip";
    grip.innerHTML = UI.icon("grip");
    grip.title = "Arraste para mover · duplo clique para realinhar na linha";
    arrastarComOffset(div, grip, b);

    // mantém a gaveta sincronizada se este controle estiver aberto nela
    const txt = campoTexto(b.texto, (t) => {
      b.texto = t;
      if (drawerCtx && drawerCtx.obj === b) el("dTexto").value = t;
    });

    const acoes = document.createElement("div");
    acoes.className = "card-acoes";
    acoes.append(
      icone("gear", "Detalhes do controle", () =>
        abrirDrawer(b, "Detalhes do controle", () => removerBarreira(lado, parentId, b.id))
      ),
      mini("+ fator", () => addFator(b)),
      icone("x", "Excluir controle", () => {
        if (confirm("Excluir este controle?")) removerBarreira(lado, parentId, b.id);
      }, "x")
    );

    div.append(grip, txt, badgesDe(b), acoes);
    canvas().appendChild(div);
    return div;
  }

  function criarFator(b, f) {
    const div = document.createElement("div");
    div.className = "fator";
    div.dataset.fid = f.id;

    const grip = document.createElement("div");
    grip.className = "grip";
    grip.innerHTML = UI.icon("grip");
    grip.title = "Arraste para mover · duplo clique para realinhar";
    arrastarComOffset(div, grip, f);

    const txt = campoTexto(f.texto, (t) => (f.texto = t));

    const acoes = document.createElement("div");
    acoes.className = "card-acoes";
    acoes.append(
      mini("+ barreira", () => addFatorBarreira(f)),
      icone("x", "Excluir fator", () => {
        if (confirm("Excluir este fator de degradação?")) removerFator(b, f.id);
      }, "x")
    );

    div.append(grip, txt, acoes);
    canvas().appendChild(div);
    return div;
  }

  function criarFatorBarreira(f, fb) {
    const div = document.createElement("div");
    div.className = "fbarreira";
    div.dataset.fbid = fb.id;

    const grip = document.createElement("div");
    grip.className = "grip";
    grip.innerHTML = UI.icon("grip");
    grip.title = "Arraste para mover · duplo clique para realinhar na linha";
    arrastarComOffset(div, grip, fb);

    const txt = campoTexto(fb.texto, (t) => {
      fb.texto = t;
      if (drawerCtx && drawerCtx.obj === fb) el("dTexto").value = t;
    });

    const acoes = document.createElement("div");
    acoes.className = "card-acoes";
    acoes.append(
      icone("gear", "Detalhes da barreira", () =>
        abrirDrawer(fb, "Barreira do fator", () => removerFatorBarreira(f, fb.id))
      ),
      icone("x", "Excluir", () => {
        if (confirm("Excluir esta barreira?")) removerFatorBarreira(f, fb.id);
      }, "x")
    );

    div.append(grip, txt, badgesDe(fb), acoes);
    canvas().appendChild(div);
    return div;
  }

  // ---------- mini construtores de UI ----------
  function mini(txt, fn) {
    const b = document.createElement("button");
    b.className = "mini"; b.textContent = txt; b.onclick = fn; return b;
  }
  function miniX(txt, fn) {
    const b = mini(txt, fn); b.classList.add("x"); return b;
  }
  function icone(nome, titulo, fn, extra) {
    const b = document.createElement("button");
    b.className = "icone" + (extra ? " " + extra : "");
    b.innerHTML = UI.icon(nome);
    b.title = titulo;
    b.onclick = fn;
    return b;
  }
  function campoTexto(valor, onTexto) {
    const t = document.createElement("div");
    t.className = "txt";
    t.contentEditable = "plaintext-only";
    t.textContent = valor;
    t.addEventListener("input", () => onTexto(t.textContent));
    return t;
  }

  // ---------- Layout: linhas e posicionamento ----------
  function layout() {
    const svg = wires();
    // mede a extensão real do conteúdo (sem incluir o próprio SVG,
    // senão a área de rolagem só cresce e nunca encolhe)
    const cv = canvas();
    let w = cv.clientWidth, h = cv.clientHeight;
    cv.querySelectorAll(".node, .barreira, .fator, .fbarreira").forEach((n) => {
      w = Math.max(w, n.offsetLeft + n.offsetWidth);
      h = Math.max(h, n.offsetTop + n.offsetHeight);
    });
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.innerHTML = "";

    const eventoEl = q(".node.evento");
    if (!eventoEl) return;
    const ev = centros(eventoEl);

    // Perigo -> Evento topo
    const perigoEl = q(".node.perigo");
    if (perigoEl) {
      const pg = centros(perigoEl);
      linha(pg.bottom, ev.top, "#2b3138", 2);
    }

    // Ameaças -> evento (controles preventivos na linha)
    state.ameacas.forEach((a) => {
      const elA = q(`.node.ameaca[data-id="${a.id}"]`);
      if (!elA) return;
      const p = centros(elA);
      linha(p.right, ev.left, "#8aa6a3", 2);
      posicionarControles(p.right, ev.left, a.barreiras);
    });

    // Evento -> consequências (controles reativos na linha)
    state.consequencias.forEach((c) => {
      const elC = q(`.node.consequencia[data-id="${c.id}"]`);
      if (!elC) return;
      const p = centros(elC);
      linha(ev.right, p.left, "#8aa6a3", 2);
      posicionarControles(ev.right, p.left, c.barreiras);
    });
  }

  function centros(elemento) {
    const x = parseFloat(elemento.style.left);
    const y = parseFloat(elemento.style.top);
    const w = elemento.offsetWidth;
    const h = elemento.offsetHeight;
    return {
      left:   { x: x,         y: y + h / 2 },
      right:  { x: x + w,     y: y + h / 2 },
      top:    { x: x + w / 2, y: y },
      bottom: { x: x + w / 2, y: y + h },
    };
  }

  function linha(p1, p2, cor, largura, tracejada) {
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", p1.x); l.setAttribute("y1", p1.y);
    l.setAttribute("x2", p2.x); l.setAttribute("y2", p2.y);
    l.setAttribute("stroke", cor || "#8aa6a3");
    l.setAttribute("stroke-width", largura || 2);
    if (tracejada) l.setAttribute("stroke-dasharray", "5,4");
    wires().appendChild(l);
  }

  function ponto(x, y, cor) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y);
    c.setAttribute("r", 3.2);
    c.setAttribute("fill", cor || "#8aa6a3");
    wires().appendChild(c);
  }

  // posiciona os controles ao longo da linha (com offset de arraste) e seus fatores
  function posicionarControles(p1, p2, barreiras) {
    const n = barreiras.length;
    barreiras.forEach((b, i) => {
      const t = (i + 1) / (n + 1);
      const ax = p1.x + (p2.x - p1.x) * t;   // ponto de ancoragem na linha
      const ay = p1.y + (p2.y - p1.y) * t;
      const bar = q(`.barreira[data-bid="${b.id}"]`);
      if (!bar) return;
      const left = ax - bar.offsetWidth / 2 + (b.dx || 0);
      const top = ay - bar.offsetHeight / 2 + (b.dy || 0);
      bar.style.left = left + "px";
      bar.style.top = top + "px";
      bar.dataset.baseLeft = ax - bar.offsetWidth / 2;
      bar.dataset.baseTop = ay - bar.offsetHeight / 2;

      // se o usuário arrastou o cartão pra fora da linha, mostra o "fio condutor"
      if (b.dx || b.dy) {
        linha({ x: ax, y: ay }, { x: left + bar.offsetWidth / 2, y: top + bar.offsetHeight / 2 }, "#aab9b9", 1.5, true);
        ponto(ax, ay);
      }

      posicionarFatores(bar, b.fatores);
    });
  }

  function posicionarFatores(barEl, fatores) {
    const bx = parseFloat(barEl.style.left) + barEl.offsetWidth / 2;
    const bBottom = parseFloat(barEl.style.top) + barEl.offsetHeight;
    fatores.forEach((f, i) => {
      const fEl = q(`.fator[data-fid="${f.id}"]`);
      if (!fEl) return;
      const baseX = bx + (i - (fatores.length - 1) / 2) * 160;
      const baseY = bBottom + 78;
      const fx = baseX + (f.dx || 0);
      const fy = baseY + (f.dy || 0);
      fEl.style.left = fx - fEl.offsetWidth / 2 + "px";
      fEl.style.top = fy + "px";
      fEl.dataset.baseLeft = baseX - fEl.offsetWidth / 2;
      fEl.dataset.baseTop = baseY;

      // linha tracejada amarela: barreira -> fator
      const alvo = { x: fx, y: fy };
      linha({ x: bx, y: bBottom }, alvo, "#d4af00", 2, true);

      // barreiras do fator, ao longo dessa linha (com offset de arraste)
      f.barreiras.forEach((fb, j) => {
        const fbEl = q(`.fbarreira[data-fbid="${fb.id}"]`);
        if (!fbEl) return;
        const tt = (j + 1) / (f.barreiras.length + 1);
        const ax = bx + (alvo.x - bx) * tt;       // ancoragem na linha tracejada
        const ay = bBottom + (alvo.y - bBottom) * tt;
        const cx = ax + (fb.dx || 0);
        const cy = ay + (fb.dy || 0);
        fbEl.style.left = cx - fbEl.offsetWidth / 2 + "px";
        fbEl.style.top = cy - fbEl.offsetHeight / 2 + "px";
        if (fb.dx || fb.dy) {
          linha({ x: ax, y: ay }, { x: cx, y: cy }, "#aab9b9", 1.5, true);
          ponto(ax, ay);
        }
      });
    });
  }

  // ---------- Arrastar ----------
  function arrastarNode(node, alca, onDrag) {
    alca.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const origX = parseFloat(node.style.left);
      const origY = parseFloat(node.style.top);
      function mover(ev) {
        const nx = Math.max(0, origX + (ev.clientX - startX));
        const ny = Math.max(0, origY + (ev.clientY - startY));
        node.style.left = nx + "px";
        node.style.top = ny + "px";
        onDrag(nx, ny);
        layout();
      }
      function soltar() {
        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", soltar);
      }
      document.addEventListener("mousemove", mover);
      document.addEventListener("mouseup", soltar);
    });
  }

  // arraste de barreiras/fatores: guarda só o DESLOCAMENTO em relação à linha
  function arrastarComOffset(card, alca, obj) {
    alca.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const origDx = obj.dx || 0, origDy = obj.dy || 0;
      function mover(ev) {
        obj.dx = origDx + (ev.clientX - startX);
        obj.dy = origDy + (ev.clientY - startY);
        layout();
      }
      function soltar() {
        document.removeEventListener("mousemove", mover);
        document.removeEventListener("mouseup", soltar);
      }
      document.addEventListener("mousemove", mover);
      document.addEventListener("mouseup", soltar);
    });
    alca.addEventListener("dblclick", () => { obj.dx = 0; obj.dy = 0; layout(); });
  }

  // ---------- Persistência (Supabase) ----------
  function dadosParaSalvar() {
    return {
      statusRisco: state.statusRisco,
      cenario: state.cenario,
      tags: state.tags,
      perigoTexto: state.perigoTexto, perigoX: state.perigoX, perigoY: state.perigoY,
      eventoTexto: state.eventoTexto, eventoX: state.eventoX, eventoY: state.eventoY,
      ameacas: state.ameacas,
      consequencias: state.consequencias,
    };
  }

  async function salvar() {
    if (!sb) {
      UI.toast("Salvar está desativado: configure a chave do Supabase no config.js.", "erro");
      return;
    }
    if (!state.nome.trim()) {
      UI.toast("Dê um nome ao diagrama (campo no topo) antes de salvar.", "erro");
      el("nomeDiagrama").focus();
      return;
    }
    // consome tag digitada que ficou sem Enter
    if (el("tagInput").value.trim()) { addTag(el("tagInput").value); el("tagInput").value = ""; }
    status("Salvando…");
    try {
      if (state.id) {
        const { error } = await sb.from("bowties")
          .update({ nome: state.nome, dados: dadosParaSalvar(), atualizado_em: new Date().toISOString() })
          .eq("id", state.id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("bowties")
          .insert({ nome: state.nome, dados: dadosParaSalvar() }).select().single();
        if (error) throw error;
        state.id = data.id;
      }
      status("Salvo às " + new Date().toLocaleTimeString());
      UI.toast("Diagrama salvo!", "ok");
    } catch (err) {
      console.error(err);
      status("");
      UI.toast("Erro ao salvar: " + err.message, "erro");
    }
  }

  async function abrirPainel() {
    if (!sb) {
      UI.toast("A lista de salvos depende do Supabase. Configure a chave no config.js.", "erro");
      return;
    }
    el("painel").classList.add("aberto");
    const lista = el("listaSalvos");
    lista.innerHTML = "Carregando…";
    const { data, error } = await sb.from("bowties")
      .select("id, nome, dados, atualizado_em")
      .order("atualizado_em", { ascending: false });
    if (error) { lista.textContent = "Erro: " + error.message; return; }
    if (!data.length) { lista.innerHTML = "<p style='padding:10px'>Nenhum diagrama salvo ainda.</p>"; return; }
    lista.innerHTML = "";
    data.forEach((d) => {
      const dd = d.dados || {};
      const item = document.createElement("div");
      item.className = "item";
      const dt = new Date(d.atualizado_em).toLocaleString("pt-BR");
      const tagsHtml = (dd.tags || []).map((t) => `<span class="chip">${UI.escapar(t)}</span>`).join("");
      const st = dd.statusRisco === "inativo" ? "inativo" : "ativo";
      item.innerHTML =
        `<i class="del" title="Excluir">🗑</i><b>${UI.escapar(d.nome)}</b><small>${dt}</small>` +
        `<div class="item-meta"><span class="pill-mini ${st}">${st}</span>${tagsHtml}</div>`;
      item.querySelector(".del").onclick = (e) => { e.stopPropagation(); excluir(d.id); };
      item.onclick = () => carregar(d.id);
      lista.appendChild(item);
    });
  }

  function fecharPainel() {
    el("painel").classList.remove("aberto");
  }

  async function carregar(id) {
    const { data, error } = await sb.from("bowties").select("*").eq("id", id).single();
    if (error) { UI.toast("Erro ao abrir: " + error.message, "erro"); return; }
    state = novoEstado();
    state.id = data.id;
    state.nome = data.nome;
    Object.assign(state, data.dados);
    UI.normalizarDados(state);   // retrocompatibilidade com diagramas antigos
    el("nomeDiagrama").value = state.nome;
    fecharPainel();
    fecharDrawer();
    atualizarPropsUI();
    render();
    status("Aberto: " + data.nome);
  }

  async function excluir(id) {
    if (!confirm("Excluir este diagrama? Esta ação não pode ser desfeita.")) return;
    const { error } = await sb.from("bowties").delete().eq("id", id);
    if (error) { UI.toast("Erro ao excluir: " + error.message, "erro"); return; }
    UI.toast("Diagrama excluído.", "ok");
    if (state.id === id) {
      state = novoEstado();
      el("nomeDiagrama").value = "";
      atualizarPropsUI();
      render();
    }
    abrirPainel();
  }

  function novo() {
    if (!confirm("Começar um diagrama novo? Alterações não salvas serão perdidas.")) return;
    state = novoEstado();
    el("nomeDiagrama").value = "";
    status("");
    fecharDrawer();
    atualizarPropsUI();
    render();
  }

  return {
    init, novo, addAmeaca, addConsequencia, salvar, abrirPainel, fecharPainel,
    _debug: () => JSON.parse(JSON.stringify(state)),
  };
})();

window.addEventListener("DOMContentLoaded", App.init);
