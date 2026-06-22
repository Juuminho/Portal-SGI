/* ============================================================
   BOWTIE SGI — Inventário de Riscos
   Lista todos os bowties em tabela editável: dá pra mudar
   status do risco, ameaças, consequências e controles SEM
   abrir o desenho. Tudo grava na mesma tabela `bowties`,
   então as mudanças aparecem automaticamente no editor.
   ============================================================ */

const Inv = (() => {
  let sb = null;
  let todos = [];                 // [{id, nome, dados, atualizado_em}]
  const abertos = new Set();      // ids com a linha de edição expandida
  const clones = {};              // edições pendentes por id: {nome, dados}

  const el = (id) => document.getElementById(id);

  // textos-padrão que não contam como conteúdo real
  const PLACEHOLDERS = new Set([
    "causa / ameaça", "consequência", "evento topo", "perigo (fonte de risco)",
    "controle / barreira", "fator de degradação", "barreira do fator", "nova ameaça", "nova consequência",
  ]);

  // ---------- Inicialização ----------
  async function init() {
    const keyOk = CONFIG.SUPABASE_ANON_KEY && CONFIG.SUPABASE_ANON_KEY.startsWith("eyJ");
    if (keyOk && window.supabase) {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } else {
      el("avisoConfig").classList.remove("escondido");
      el("contagem").textContent = "Sem conexão com o banco.";
      return;
    }

    el("fBusca").addEventListener("input", renderTabela);
    el("fTag").addEventListener("change", renderTabela);
    el("fCenario").addEventListener("change", renderTabela);
    el("fStatus").addEventListener("change", renderTabela);
    el("tabLista").addEventListener("click", () => trocarAba("lista"));
    el("tabComum").addEventListener("click", () => trocarAba("comum"));

    await carregarTudo();
  }

  function trocarAba(qual) {
    el("tabLista").classList.toggle("ativo", qual === "lista");
    el("tabComum").classList.toggle("ativo", qual === "comum");
    el("viewLista").classList.toggle("escondido", qual !== "lista");
    el("filtros").classList.toggle("escondido", qual !== "lista");
    el("viewComum").classList.toggle("escondido", qual !== "comum");
    if (qual === "comum") renderComum();
  }

  async function carregarTudo() {
    el("contagem").textContent = "Carregando…";
    const { data, error } = await sb.from("bowties")
      .select("id, nome, dados, atualizado_em")
      .order("atualizado_em", { ascending: false });
    if (error) {
      el("contagem").textContent = "";
      UI.toast("Erro ao carregar: " + error.message, "erro");
      return;
    }
    todos = data.map((d) => ({ ...d, dados: UI.normalizarDados(d.dados) }));
    popularFiltroTags();
    renderTabela();
  }

  function popularFiltroTags() {
    const sel = el("fTag");
    const atual = sel.value;
    const tags = new Map(); // lowercase -> exibição
    todos.forEach((d) => (d.dados.tags || []).forEach((t) => {
      const k = t.toLowerCase();
      if (!tags.has(k)) tags.set(k, t);
    }));
    sel.innerHTML = '<option value="">Todas as operações</option>';
    [...tags.values()].sort((a, b) => a.localeCompare(b)).forEach((t) => {
      const o = document.createElement("option");
      o.value = t.toLowerCase(); o.textContent = t;
      sel.appendChild(o);
    });
    sel.value = atual;
    // se a tag selecionada deixou de existir, volta para "Todas as operações"
    if (sel.selectedIndex === -1) sel.value = "";
  }

  // ---------- Filtros ----------
  function textosDe(dd) {
    const ts = [];
    ["ameacas", "consequencias"].forEach((lado) =>
      (dd[lado] || []).forEach((n) => {
        ts.push(n.texto || "");
        (n.barreiras || []).forEach((b) => {
          ts.push(b.texto || "");
          (b.fatores || []).forEach((f) => {
            ts.push(f.texto || "");
            (f.barreiras || []).forEach((fb) => ts.push(fb.texto || ""));
          });
        });
      })
    );
    return ts;
  }

  function filtrados() {
    const qy = el("fBusca").value.trim().toLowerCase();
    const tag = el("fTag").value;
    const cen = el("fCenario").value;
    const stat = el("fStatus").value;
    return todos.filter((d) => {
      const dd = d.dados;
      if (stat && (dd.statusRisco || "ativo") !== stat) return false;
      if (cen === "_indef") { if (dd.cenario) return false; }
      else if (cen && dd.cenario !== cen) return false;
      if (tag && !(dd.tags || []).some((t) => t.toLowerCase() === tag)) return false;
      if (qy) {
        const blob = [d.nome, dd.eventoTexto, dd.perigoTexto, ...(dd.tags || []), ...textosDe(dd)]
          .join(" ").toLowerCase();
        if (!blob.includes(qy)) return false;
      }
      return true;
    });
  }

  // ---------- Tabela ----------
  function contar(dd) {
    let ameacas = (dd.ameacas || []).length;
    let conseq = (dd.consequencias || []).length;
    let ctl = 0;
    ["ameacas", "consequencias"].forEach((lado) =>
      (dd[lado] || []).forEach((n) => (ctl += (n.barreiras || []).length))
    );
    return { ameacas, conseq, ctl };
  }

  function renderTabela() {
    const tbody = el("tbody");
    tbody.innerHTML = "";
    const lista = filtrados();
    el("contagem").textContent = `${lista.length} de ${todos.length} risco(s)`;

    if (!lista.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.style.cssText = "text-align:center;color:#5b6f6f;padding:36px";
      td.textContent = todos.length
        ? "Nenhum risco corresponde aos filtros."
        : "Nenhum risco cadastrado ainda — crie o primeiro no Editor.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    lista.forEach((d) => {
      const dd = d.dados;
      const c = contar(dd);
      const tr = document.createElement("tr");
      tr.className = "linha";

      // status (clique alterna e salva na hora)
      const tdSt = document.createElement("td");
      const pill = document.createElement("button");
      const st = dd.statusRisco === "inativo" ? "inativo" : "ativo";
      pill.className = "pill pill-status " + st;
      pill.textContent = st === "ativo" ? "Ativo" : "Inativo";
      pill.title = "Clique para alternar o status do risco";
      pill.onclick = () => alternarStatus(d);
      tdSt.appendChild(pill);

      // nome (clique expande)
      const tdNome = document.createElement("td");
      const nome = document.createElement("span");
      nome.className = "nome-risco";
      nome.textContent = d.nome;
      nome.title = dd.eventoTexto || "";
      nome.onclick = () => alternarDetalhe(d.id);
      tdNome.appendChild(nome);

      // tags
      const tdTags = document.createElement("td");
      (dd.tags || []).forEach((t) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.style.marginRight = "4px";
        chip.textContent = t;
        tdTags.appendChild(chip);
      });

      // cenário
      const tdCen = document.createElement("td");
      tdCen.style.fontSize = "12px";
      tdCen.style.color = "#5b6f6f";
      tdCen.textContent = dd.cenario === "independente" ? "Independente da produção"
        : dd.cenario === "dependente" ? "Dependente da produção" : "—";

      // contagens
      const tdA = document.createElement("td"); tdA.className = "num"; tdA.textContent = c.ameacas;
      const tdC = document.createElement("td"); tdC.className = "num"; tdC.textContent = c.ctl;
      const tdQ = document.createElement("td"); tdQ.className = "num"; tdQ.textContent = c.conseq;

      // data
      const tdDt = document.createElement("td");
      tdDt.className = "data";
      tdDt.textContent = new Date(d.atualizado_em).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
      });

      // ações
      const tdAc = document.createElement("td");
      const box = document.createElement("div");
      box.className = "acao-linha";
      const bEdit = document.createElement("button");
      bEdit.className = "icone" + (abertos.has(d.id) ? " aberto-rot" : "");
      bEdit.innerHTML = UI.icon("chevron");
      bEdit.title = abertos.has(d.id) ? "Recolher" : "Editar aqui (sem abrir o desenho)";
      bEdit.onclick = () => alternarDetalhe(d.id);
      const aAbrir = document.createElement("a");
      aAbrir.className = "icone";
      aAbrir.innerHTML = UI.icon("external");
      aAbrir.title = "Abrir no editor visual";
      aAbrir.href = "index.html?id=" + encodeURIComponent(d.id);
      aAbrir.onclick = (ev) => {
        if (temPendencias(d) &&
            !confirm("Há alterações não salvas nesta linha. Sair sem salvar?")) ev.preventDefault();
      };
      box.append(bEdit, aAbrir);
      tdAc.appendChild(box);

      tr.append(tdSt, tdNome, tdTags, tdCen, tdA, tdC, tdQ, tdDt, tdAc);
      tbody.appendChild(tr);

      if (abertos.has(d.id)) {
        const trDet = document.createElement("tr");
        trDet.className = "linha-detalhe";
        const td = document.createElement("td");
        td.colSpan = 9;
        td.appendChild(montarDetalhe(d));
        trDet.appendChild(td);
        tbody.appendChild(trDet);
      }
    });
  }

  // há edições não salvas na linha expandida deste risco?
  function temPendencias(d) {
    const c = clones[d.id];
    return !!c && (c.nome !== d.nome || JSON.stringify(c.dados) !== JSON.stringify(d.dados));
  }

  function alternarDetalhe(id) {
    if (abertos.has(id)) {
      const d = todos.find((x) => x.id === id);
      if (d && temPendencias(d) &&
          !confirm("Há alterações não salvas neste risco. Descartar?")) return;
      abertos.delete(id);
      delete clones[id];
    } else {
      abertos.add(id);
    }
    renderTabela();
  }

  async function alternarStatus(d) {
    const anterior = d.dados.statusRisco;
    const novo = anterior === "ativo" ? "inativo" : "ativo";
    d.dados.statusRisco = novo;
    if (clones[d.id]) clones[d.id].dados.statusRisco = novo; // mantém edição pendente coerente
    const ok = await salvarRegistro(d, d.nome, d.dados);
    if (ok) {
      UI.toast(`Risco marcado como ${novo}.`, "ok");
    } else {
      // gravação falhou: reverte para não dessincronizar a tela do banco
      d.dados.statusRisco = anterior;
      if (clones[d.id]) clones[d.id].dados.statusRisco = anterior;
    }
    renderTabela();
  }

  // ---------- Edição na linha expandida ----------
  function cloneDe(d) {
    if (!clones[d.id]) {
      clones[d.id] = { nome: d.nome, dados: JSON.parse(JSON.stringify(d.dados)) };
    }
    return clones[d.id];
  }

  function montarDetalhe(d) {
    const c = cloneDe(d);
    const dd = c.dados;
    const det = document.createElement("div");
    det.className = "det";

    // ---- cabeçalho do detalhe: nome, evento, perigo, cenário, tags ----
    const grid = document.createElement("div");
    grid.className = "det-grid";
    grid.append(
      campo("Nome do risco / diagrama", c.nome, (v) => (c.nome = v)),
      campo("Evento topo", dd.eventoTexto, (v) => (dd.eventoTexto = v)),
      campo("Perigo (fonte de risco)", dd.perigoTexto, (v) => (dd.perigoTexto = v)),
      campoCenario(dd),
      campoTags(dd)
    );

    // ---- colunas: ameaças/preventivos × consequências/reativos ----
    const cols = document.createElement("div");
    cols.className = "det-cols";
    cols.append(
      colunaLado(dd, "ameacas", "Ameaças & controles preventivos", "lado-esq", "Nova ameaça"),
      colunaLado(dd, "consequencias", "Consequências & controles reativos", "lado-dir", "Nova consequência")
    );

    // ---- rodapé ----
    const foot = document.createElement("div");
    foot.className = "det-foot";
    const aviso = document.createElement("small");
    aviso.textContent = "Fatores de degradação são editados no editor visual.";
    const bCancelar = document.createElement("button");
    bCancelar.className = "btn secundario";
    bCancelar.textContent = "Descartar";
    bCancelar.onclick = () => { delete clones[d.id]; abertos.delete(d.id); renderTabela(); };
    const bSalvar = document.createElement("button");
    bSalvar.className = "btn salvar";
    bSalvar.textContent = "Salvar alterações";
    bSalvar.onclick = async () => {
      if (!c.nome.trim()) { UI.toast("O nome do risco não pode ficar vazio.", "erro"); return; }
      const ok = await salvarRegistro(d, c.nome, c.dados);
      if (ok) {
        d.nome = c.nome;
        d.dados = c.dados;
        delete clones[d.id];
        popularFiltroTags();
        renderTabela();
        UI.toast("Alterações salvas! O bowtie já reflete tudo.", "ok");
      }
    };
    foot.append(aviso, bCancelar, bSalvar);

    det.append(grid, cols, foot);
    return det;
  }

  function campo(rotulo, valor, onMudar) {
    const label = document.createElement("label");
    label.textContent = rotulo;
    const input = document.createElement("input");
    input.type = "text";
    input.value = valor || "";
    input.addEventListener("input", () => onMudar(input.value));
    label.appendChild(input);
    return label;
  }

  function campoCenario(dd) {
    const label = document.createElement("label");
    label.textContent = "Cenário";
    const sel = document.createElement("select");
    [["", "— definir —"], ["independente", "Independente da produção (geral)"], ["dependente", "Dependente da produção"]]
      .forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = t;
        sel.appendChild(o);
      });
    sel.value = dd.cenario || "";
    sel.addEventListener("change", () => (dd.cenario = sel.value));
    label.appendChild(sel);
    return label;
  }

  function campoTags(dd) {
    const label = document.createElement("label");
    label.textContent = "Operações (separe por vírgula)";
    const input = document.createElement("input");
    input.type = "text";
    input.value = (dd.tags || []).join(", ");
    input.placeholder = "ex.: forno, briquete";
    input.addEventListener("input", () => {
      dd.tags = input.value.split(",").map((t) => t.trim()).filter(Boolean);
    });
    label.appendChild(input);
    return label;
  }

  function colunaLado(dd, lado, titulo, classe, rotuloNovo) {
    const col = document.createElement("div");
    col.className = "det-col";
    const h = document.createElement("h4");
    h.className = classe;
    h.textContent = titulo;
    col.appendChild(h);

    const listaBox = document.createElement("div");
    col.appendChild(listaBox);

    const redesenhar = () => {
      listaBox.innerHTML = "";
      dd[lado].forEach((n) => listaBox.appendChild(itemNode(dd, lado, n, redesenhar)));
    };
    redesenhar();

    const bAdd = document.createElement("button");
    bAdd.className = "mini";
    bAdd.textContent = "+ " + rotuloNovo.toLowerCase();
    bAdd.onclick = () => {
      const i = dd[lado].length;
      dd[lado].push({
        id: UI.uid(lado === "ameacas" ? "a" : "c"),
        texto: rotuloNovo,
        x: lado === "ameacas" ? 90 : 930,
        y: 130 + i * 170,
        barreiras: [],
      });
      redesenhar();
    };
    col.appendChild(bAdd);
    return col;
  }

  function itemNode(dd, lado, n, redesenhar) {
    const box = document.createElement("div");
    box.className = "inv-item";

    const head = document.createElement("div");
    head.className = "inv-item-head";
    const input = document.createElement("input");
    input.value = n.texto || "";
    input.addEventListener("input", () => (n.texto = input.value));
    const bDel = document.createElement("button");
    bDel.className = "icone x";
    bDel.innerHTML = UI.icon("x");
    bDel.title = "Excluir (e seus controles)";
    bDel.onclick = () => {
      if (!confirm("Excluir este item e todos os seus controles?")) return;
      dd[lado] = dd[lado].filter((x) => x.id !== n.id);
      redesenhar();
    };
    head.append(input, bDel);
    box.appendChild(head);

    const lista = document.createElement("div");
    lista.className = "ctl-lista";
    const redesenharCtls = () => {
      lista.innerHTML = "";
      n.barreiras.forEach((b) => lista.appendChild(linhaControle(n, b, redesenharCtls)));
    };
    redesenharCtls();
    box.appendChild(lista);

    const bAdd = document.createElement("button");
    bAdd.className = "mini";
    bAdd.textContent = "+ controle";
    bAdd.onclick = () => {
      n.barreiras.push(UI.normCtl({ id: UI.uid("b"), texto: "Controle / barreira", fatores: [] }));
      redesenharCtls();
    };
    box.appendChild(bAdd);

    return box;
  }

  function linhaControle(n, b, redesenhar) {
    const row = document.createElement("div");
    row.className = "ctl-row";

    const texto = document.createElement("input");
    texto.type = "text";
    texto.value = b.texto || "";
    texto.title = "Descrição do controle";
    texto.addEventListener("input", () => (b.texto = texto.value));

    const tipo = document.createElement("select");
    tipo.title = "Tipo do controle";
    UI.TIPOS_CONTROLE.forEach(([v, t]) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = t;
      tipo.appendChild(o);
    });
    tipo.value = b.tipo || "";
    tipo.addEventListener("change", () => (b.tipo = tipo.value));

    const cc = document.createElement("label");
    cc.className = "ctl-cc";
    cc.title = "Controle Crítico";
    const ccInput = document.createElement("input");
    ccInput.type = "checkbox";
    ccInput.checked = !!b.cc;
    ccInput.addEventListener("change", () => (b.cc = ccInput.checked));
    cc.append(ccInput, document.createTextNode("CC"));

    const op = document.createElement("select");
    op.title = "Status de operação";
    [["ativo", "Ativo"], ["inativo", "Inativo"]].forEach(([v, t]) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = t;
      op.appendChild(o);
    });
    op.value = b.statusOp || "ativo";
    op.addEventListener("change", () => (b.statusOp = op.value));

    const impl = document.createElement("select");
    impl.title = "Implementação";
    [["", "— implantação —"], ["implementado", "Implementado"], ["nao_implementado", "Não implementado"]]
      .forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = t;
        impl.appendChild(o);
      });
    impl.value = b.statusImpl || "";
    impl.addEventListener("change", () => (b.statusImpl = impl.value));

    const bDel = document.createElement("button");
    bDel.className = "icone x";
    bDel.innerHTML = UI.icon("x");
    bDel.title = "Excluir controle";
    bDel.onclick = () => {
      if (!confirm("Excluir este controle?")) return;
      n.barreiras = n.barreiras.filter((x) => x.id !== b.id);
      redesenhar();
    };

    row.append(texto, tipo, cc, op, impl, bDel);
    return row;
  }

  // ---------- Gravação ----------
  async function salvarRegistro(d, nome, dados) {
    const { data, error } = await sb.from("bowties")
      .update({ nome, dados, atualizado_em: new Date().toISOString() })
      .eq("id", d.id)
      .select("atualizado_em")
      .single();
    if (error) {
      UI.toast("Erro ao salvar: " + error.message, "erro");
      return false;
    }
    d.atualizado_em = data.atualizado_em;
    return true;
  }

  // ---------- Riscos em comum entre operações ----------
  function chave(texto) {
    return (texto || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function renderComum() {
    const box = el("comumLista");
    box.innerHTML = "";

    // agrupa ameaças (e eventos topo) iguais entre bowties diferentes
    const grupos = new Map(); // chave -> { texto, tipo, onde: Map(bowtieId -> {nome, tags}) }
    const registrar = (texto, tipoGrupo, d) => {
      const k = tipoGrupo + "|" + chave(texto);
      if (!chave(texto) || chave(texto).length < 3 || PLACEHOLDERS.has(chave(texto))) return;
      if (!grupos.has(k)) grupos.set(k, { texto, tipoGrupo, onde: new Map() });
      grupos.get(k).onde.set(d.id, { nome: d.nome, tags: d.dados.tags || [] });
    };

    todos.forEach((d) => {
      registrar(d.dados.eventoTexto, "Evento topo", d);
      (d.dados.ameacas || []).forEach((a) => registrar(a.texto, "Ameaça", d));
    });

    const comuns = [...grupos.values()]
      .filter((g) => g.onde.size >= 2)
      .sort((a, b) => b.onde.size - a.onde.size);

    if (!comuns.length) {
      const p = document.createElement("p");
      p.className = "comum-vazio";
      p.textContent = "Nenhuma ameaça ou evento repetido entre bowties por enquanto. " +
        "Quando o mesmo risco aparecer em mais de um diagrama, ele será listado aqui.";
      box.appendChild(p);
      return;
    }

    comuns.forEach((g) => {
      const card = document.createElement("div");
      card.className = "comum-card";

      const tipo = document.createElement("span");
      tipo.className = "tag-grupo";
      tipo.textContent = g.tipoGrupo + " em " + g.onde.size + " bowties";

      const b = document.createElement("b");
      b.textContent = g.texto;

      const onde = document.createElement("div");
      onde.className = "onde";
      g.onde.forEach((info, id) => {
        const a = document.createElement("a");
        a.href = "index.html?id=" + encodeURIComponent(id);
        a.textContent = info.nome + (info.tags.length ? " · " + info.tags.join(", ") : "");
        onde.appendChild(a);
      });

      card.append(tipo, b, onde);
      box.appendChild(card);
    });
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", Inv.init);
