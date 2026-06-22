/* ============================================================
   BOWTIE SGI — utilidades compartilhadas (editor + inventário)
   ============================================================ */

const UI = (() => {
  const ICONS = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>',
  };

  const icon = (n) => ICONS[n] || '';

  // id único (timestamp + aleatório) — não colide nem após recarregar
  function uid(prefixo) {
    return (prefixo || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapar(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // notificação flutuante (substitui os alert())
  function toast(msg, tipo) {
    const box = document.getElementById('toasts');
    if (!box) { alert(msg); return; }
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || 'info');
    t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('mostra'));
    setTimeout(() => { t.classList.remove('mostra'); setTimeout(() => t.remove(), 300); }, 3500);
  }

  // ----- vocabulário dos controles (pedido da Jade) -----
  const TIPOS_CONTROLE = [
    ['', '— definir tipo —'],
    ['procedimento', 'Procedimento'],
    ['equipamento', 'Equipamento / Engenharia'],
    ['automatizado', 'Automatizado'],
    ['humano', 'Humano / Comportamental'],
    ['epi', 'EPI'],
  ];
  const TIPO_LABEL = Object.fromEntries(TIPOS_CONTROLE.map(([v]) => [v, v === '' ? 'definir tipo'
    : v === 'procedimento' ? 'Procedimento'
    : v === 'equipamento' ? 'Equipamento'
    : v === 'automatizado' ? 'Automatizado'
    : v === 'humano' ? 'Humano' : 'EPI']));

  // garante que um controle/barreira tenha todos os campos novos
  function normCtl(b) {
    if (b.tipo === undefined) b.tipo = '';
    if (b.cc === undefined) b.cc = false;
    if (b.statusOp === undefined) b.statusOp = 'ativo';
    if (b.statusImpl === undefined) b.statusImpl = '';
    if (b.dx === undefined) b.dx = 0;
    if (b.dy === undefined) b.dy = 0;
    return b;
  }

  // normaliza um objeto `dados` inteiro (retrocompatível com diagramas antigos)
  function normalizarDados(d) {
    d = d || {};
    if (!d.statusRisco) d.statusRisco = 'ativo';
    if (d.cenario === undefined) d.cenario = '';
    if (!Array.isArray(d.tags)) d.tags = [];
    if (d.perigoTexto === undefined) d.perigoTexto = 'Perigo (fonte de risco)';
    if (d.perigoX === undefined) d.perigoX = 500;
    if (d.perigoY === undefined) d.perigoY = 90;
    if (d.eventoTexto === undefined) d.eventoTexto = 'Evento topo';
    if (d.eventoX === undefined) d.eventoX = 500;
    if (d.eventoY === undefined) d.eventoY = 330;
    ['ameacas', 'consequencias'].forEach((lado) => {
      if (!Array.isArray(d[lado])) d[lado] = [];
      d[lado].forEach((n) => {
        if (!Array.isArray(n.barreiras)) n.barreiras = [];
        n.barreiras.forEach((b) => {
          normCtl(b);
          if (!Array.isArray(b.fatores)) b.fatores = [];
          b.fatores.forEach((f) => {
            if (f.dx === undefined) f.dx = 0;
            if (f.dy === undefined) f.dy = 0;
            if (!Array.isArray(f.barreiras)) f.barreiras = [];
            f.barreiras.forEach((fb) => normCtl(fb));
          });
        });
      });
    });
    return d;
  }

  return { icon, uid, escapar, toast, TIPOS_CONTROLE, TIPO_LABEL, normCtl, normalizarDados };
})();
