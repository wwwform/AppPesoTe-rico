429: Too Many Requests
For more on scraping GitHub and how it may affect your rights, please review our Terms of Service (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).


/* ==========================================================================
   NX2 — HISTÓRICO (H1 embutido + H2 modal) — MODO B (somente visualização)
   --------------------------------------------------------------------------
   SOBRE ESTE BLOCO:
   - Não altera NENHUMA função do seu sistema atual.
   - Apenas LÊ valores dos elementos já existentes após os seus handlers.
   - Usa setTimeout(...,0) para rodar DEPOIS dos seus cálculos.
   - Salva em localStorage no namespace "nx2_hist_v1".
   - Exibe H1 (tabela embutida) e H2 (modal — botão 📜 no topo).
   - Cada registro salva: { data, tipo, pesoTotal, itens[] }
     • Cálculo Rápido: 1 item { grupo(Material), pecas, peso }
     • Fardos: N itens { index, comp, larg, pecas, peso }
   - Pronto para NX3 (Imprimir) e NX4 (Exportar).
   --------------------------------------------------------------------------
   PONTOS DE INTEGRAÇÃO (apenas listeners passivos):
     • #btnCalcUnico   → Cálculo Rápido
     • #btnGerarFardos → Cálculo por Fardos
   ========================================================================== */

(function NX2_History_IIFE(){
  "use strict";

  // ---------- Utils ----------
  const KEY = "nx2_hist_v1";
  const qs  = (s,el=document)=>el.querySelector(s);
  const qsa = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const pad = n=>String(n).padStart(2,"0");
  const now = ()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const brNum = (text)=>{
    if(text==null) return 0;
    const s = String(text).replace(/\./g,"").replace(",",".").match(/-?[\d.]+/);
    return s ? Number(s[0]) : 0;
  };
  const safeJSON = (v,fb)=>{ try{ return JSON.parse(v); }catch(e){ return fb; } };

  // ---------- Storage ----------
  const Store = {
    all(){ return safeJSON(localStorage.getItem(KEY), []); },
    set(v){ localStorage.setItem(KEY, JSON.stringify(v)); },
    add(item){ const a=this.all(); a.unshift(item); this.set(a); },
    rm(i){ const a=this.all(); if(i>=0 && i<a.length){ a.splice(i,1); this.set(a);} },
    clear(){ localStorage.removeItem(KEY); }
  };

  // ---------- Render ----------
  function resumoItens(arr){
    if(!Array.isArray(arr)||!arr.length) return "—";
    const parts = arr.slice(0,3).map(x=>{
      const g = (x.grupo ?? x.index ?? "?");
      const p = Number(x.peso ?? 0).toFixed(3);
      return `${g}: ${p}kg`;
    });
    return parts.join(", ") + (arr.length>3 ? ` +${arr.length-3}` : "");
  }

  function renderTabelas(){
    const data = Store.all();
    const tb1 = qs("#tableH1 tbody");
    const tb2 = qs("#tableH2 tbody");
    [tb1,tb2].forEach(tb=>{ if(tb) tb.innerHTML=""; });

    if(!data.length){
      [tb1,tb2].forEach(tb=>{
        if(!tb) return;
        const tr=document.createElement("tr");
        const td=document.createElement("td");
        td.colSpan=5; td.innerHTML='<em style="opacity:.8">Sem registros.</em>';
        tr.appendChild(td); tb.appendChild(tr);
      });
      return;
    }

    data.forEach((row, idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.data||"—"}</td>
        <td>${row.tipo||"—"}</td>
        <td>${resumoItens(row.itens)}</td>
        <td class="right">${Number(row.pesoTotal||0).toFixed(3)}</td>
        <td class="center">
          <button class="btn outline" data-acao="ver" data-i="${idx}">Ver</button>
          <button class="btn danger" data-acao="del" data-i="${idx}">Excluir</button>
        </td>
      `;
      if(tb1) tb1.appendChild(tr.cloneNode(true));
      if(tb2) tb2.appendChild(tr.cloneNode(true));
    });
  }

  // ---------- Modais ----------
  function openModal(id){ const m=qs("#"+id); if(m) m.hidden=false; }
  function closeModal(id){ const m=qs("#"+id); if(m) m.hidden=true; }
  document.addEventListener("click",(ev)=>{
    const closeId = ev.target.getAttribute("data-close");
    if(closeId){ closeModal(closeId); }
  });

  // ---------- Detalhes (view-only) ----------
  function esc(s){ return String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function abrirDetalhes(entry){
    const wrap = qs("#detalhesBody");
    if(!wrap) return;
    const itens = Array.isArray(entry.itens) ? entry.itens : [];
    const li = itens.map(x=>{
      const g = esc(String(x.grupo ?? x.index ?? "?"));
      const c = x.comp!=null ? `, comp: ${Number(x.comp).toFixed(3)}m` : "";
      const l = x.larg!=null ? `, larg: ${Number(x.larg).toFixed(3)}m` : "";
      const pz= x.pecas!=null ? `, peças: ${Number(x.pecas)}` : "";
      const p = x.peso!=null ? `, peso: ${Number(x.peso).toFixed(3)}kg` : "";
      return `<li><strong>${g}</strong>${c}${l}${pz}${p}</li>`;
    }).join("");

    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div class="muted">Data</div><div>${entry.data||"—"}</div></div>
        <div><div class="muted">Tipo</div><div>${entry.tipo||"—"}</div></div>
        <div><div class="muted">Peso total (kg)</div><div>${Number(entry.pesoTotal||0).toFixed(3)}</div></div>
        <div><div class="muted">Qtd. itens</div><div>${itens.length}</div></div>
      </div>
      <hr style="border:none;border-top:1px solid currentColor;opacity:.25;margin:10px 0" />
      <h4>Itens</h4>
      <ul style="margin:6px 0 0 18px">${li || "<li>—</li>"}</ul>
    `;
    openModal("modalDetalhes");
  }

  // ---------- Bind de ações da tabela ----------
  function bindAcoes(){
    ["tableH1","tableH2"].forEach(id=>{
      const table = qs("#"+id);
      if(!table) return;
      table.addEventListener("click",(ev)=>{
        const btn = ev.target.closest("button");
        if(!btn) return;
        const act = btn.getAttribute("data-acao");
        const idx = Number(btn.getAttribute("data-i"));
        if(act==="ver"){
          const entry = Store.all()[idx];
          if(entry) abrirDetalhes(entry);
        }else if(act==="del"){
          if(confirm("Excluir este registro?")){
            Store.rm(idx); renderTabelas();
          }
        }
      });
    });
    const b1=qs("#btnLimparTudoH1"); if(b1) b1.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){ Store.clear(); renderTabelas(); } });
    const b2=qs("#btnLimparTudoH2"); if(b2) b2.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){ Store.clear(); renderTabelas(); } });
    const bh=qs("#t-history");      if(bh) bh.addEventListener("click",()=> openModal("modalHistorico"));
  }

  // ---------- Coleta de dados ----------
  function capturaCalculoRapido(){
    const peso = brNum(qs("#pesoTotalView")?.textContent||"");
    const sel  = qs("#selMaterial");
    const mat  = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent.trim() : "Material";
    const pecas= Number(qs("#inPecas")?.value||0);
    const item = { grupo: mat, pecas, peso: Number(peso||0) };
    const entry= { data: now(), tipo: "Cálculo Rápido", pesoTotal: item.peso, itens: [item] };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){
      Store.add(entry); renderTabelas();
    }
  }

  function capturaFardos(){
    const linhas = qsa("#fardos-table tbody tr");
    const itens  = linhas.map((tr,idx)=>{
      const tds = qsa("td",tr).map(td=>td.textContent.trim());
      // colunas: # | comp | larg | peças | peso
      const comp  = brNum(tds[1]||"");
      const larg  = brNum(tds[2]||"");
      const pecas = brNum(tds[3]||"");
      const peso  = brNum(tds[4]||"");
      return { index: idx+1, comp, larg, pecas, peso };
    });
    const total = brNum(qs("#fardosTotal")?.textContent||"");
    const entry = { data: now(), tipo: "Cálculo por Fardos", pesoTotal: Number(total||0), itens };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){
      Store.add(entry); renderTabelas();
    }
  }

  // ---------- Bootstrap ----------
  window.addEventListener("DOMContentLoaded", ()=>{
    // Executa DEPOIS dos seus handlers originais:
    const bRapido = qs("#btnCalcUnico");
    if(bRapido) bRapido.addEventListener("click", ()=> setTimeout(capturaCalculoRapido, 0));

    const bFardos = qs("#btnGerarFardos");
    if(bFardos) bFardos.addEventListener("click", ()=> setTimeout(capturaFardos, 0));

    bindAcoes();
    renderTabelas();
  });

  // ---------- API Pública (se precisar usar) ----------
  window.HistoryAPI = {
    add(e){ Store.add(e); renderTabelas(); },
    all(){ return Store.all(); },
    clear(){ Store.clear(); renderTabelas(); }
  };

})(); // fim NX2

