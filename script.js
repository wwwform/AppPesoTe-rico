429: Too Many Requests
For more on scraping GitHub and how it may affect your rights, please review our Terms of Service (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).


/* ===================== NX2 – Histórico (H1 embutido, H2 modal) =====================
   - Modo B (view-only)
   - Salva: data, tipo ("Cálculo Rápido" | "Cálculo por Fardos"), pesoTotal, itens[]
*/
(function(){
  const KEY = "nx2_hist_v1";
  const qs  = (s,el=document)=>el.querySelector(s);
  const qsa = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const pad = n=>String(n).padStart(2,'0');
  const now = ()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const safe = (v,fb)=>{try{return JSON.parse(v)}catch(e){return fb}};

  const Store = {
    all(){return safe(localStorage.getItem(KEY),[])},
    set(v){localStorage.setItem(KEY,JSON.stringify(v))},
    add(it){const a=this.all();a.unshift(it);this.set(a)},
    rm(i){const a=this.all();if(i>=0&&i<a.length){a.splice(i,1);this.set(a)}},
    clear(){localStorage.removeItem(KEY)}
  };

  function resumo(arr){
    if(!Array.isArray(arr)||!arr.length) return "—";
    const parts = arr.slice(0,3).map(x=>{
      const g = (x.grupo ?? x.index ?? "?");
      const p = Number(x.peso ?? 0).toFixed(3);
      return `${g}: ${p}kg`;
    });
    return parts.join(", ")+(arr.length>3?` +${arr.length-3}`:"");
  }

  function renderTables(){
    const rows=Store.all();
    const tb1=qs("#tableH1 tbody"); const tb2=qs("#tableH2 tbody");
    [tb1,tb2].forEach(tb=>{ if(tb) tb.innerHTML=""; });
    if(!rows.length){
      [tb1,tb2].forEach(tb=>{
        if(!tb) return;
        const tr=document.createElement("tr"),td=document.createElement("td");
        td.colSpan=5; td.innerHTML='<em style="opacity:.8">Sem registros.</em>';
        tr.appendChild(td); tb.appendChild(tr);
      }); return;
    }
    rows.forEach((r,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${r.data||"—"}</td>
        <td>${r.tipo||"—"}</td>
        <td>${resumo(r.itens)}</td>
        <td class="right">${Number(r.pesoTotal||0).toFixed(3)}</td>
        <td class="center">
          <button class="btn outline" data-acao="ver" data-i="${i}">Ver</button>
          <button class="btn danger" data-acao="del" data-i="${i}">Excluir</button>
        </td>`;
      [tb1,tb2].forEach(tb=>{ if(tb) tb.appendChild(tr.cloneNode(true)) });
    });
  }

  function openModal(id){const m=qs("#"+id);if(m)m.hidden=false;}
  function closeModal(id){const m=qs("#"+id);if(m)m.hidden=true;}
  document.addEventListener("click",(ev)=>{const c=ev.target.getAttribute("data-close");if(c)closeModal(c);});

  function escapeHTML(s){return String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
  function openDetalhes(entry){
    const el=qs("#detalhesBody"); if(!el) return;
    const list=Array.isArray(entry.itens)?entry.itens:[];
    const li=list.map(x=>{
      const g=escapeHTML(String(x.grupo ?? x.index ?? "?"));
      const c=x.comp!=null?`, comp: ${Number(x.comp).toFixed(3)}m`:"";
      const l=x.larg!=null?`, larg: ${Number(x.larg).toFixed(3)}m`:"";
      const pz=x.pecas!=null?`, peças: ${Number(x.pecas)}`:"";
      const p=x.peso!=null?`, peso: ${Number(x.peso).toFixed(3)}kg`:"";
      return `<li><strong>${g}</strong>${c}${l}${pz}${p}</li>`;
    }).join("");
    el.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div class="muted">Data</div><div>${entry.data||"—"}</div></div>
        <div><div class="muted">Tipo</div><div>${entry.tipo||"—"}</div></div>
        <div><div class="muted">Peso total (kg)</div><div>${Number(entry.pesoTotal||0).toFixed(3)}</div></div>
        <div><div class="muted">Qtd. itens</div><div>${list.length}</div></div>
      </div>
      <hr style="border:none;border-top:1px solid currentColor;opacity:.25;margin:10px 0" />
      <h4>Itens</h4>
      <ul style="margin:6px 0 0 18px">${li || "<li>—</li>"}</ul>`;
    openModal("modalDetalhes");
  }

  function bindActions(){
    ["tableH1","tableH2"].forEach(id=>{
      const el=qs("#"+id); if(!el) return;
      el.addEventListener("click",(ev)=>{
        const b=ev.target.closest("button"); if(!b) return;
        const a=b.getAttribute("data-acao"); const i=Number(b.getAttribute("data-i"));
        if(a==="ver"){const e=Store.all()[i]; if(e) openDetalhes(e);}
        else if(a==="del"){ if(confirm("Excluir este registro?")){Store.rm(i); renderTables();} }
      });
    });
    const b1=qs("#btnLimparTudoH1"); if(b1) b1.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){Store.clear();renderTables();} });
    const b2=qs("#btnLimparTudoH2"); if(b2) b2.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){Store.clear();renderTables();} });
    const bh=qs("#t-history"); if(bh) bh.addEventListener("click",()=>openModal("modalHistorico"));
  }

  // Capturas
  function numFrom(str){
    if(!str) return 0;
    // normaliza formato pt-BR simples "1.234,567"
    const s = String(str).replace(/\./g,"").replace(",",".").match(/-?[\d.]+/);
    return s ? Number(s[0]) : 0;
  }

  function captureRapido(){
    const peso = numFrom(qs("#pesoTotalView")?.textContent||"");
    const sel  = qs("#selMaterial");
    const mat  = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent.trim() : "Material";
    const pecas= Number(qs("#inPecas")?.value||0);
    const item = { grupo: mat, pecas, peso: Number(peso||0) };
    const entry= { data: now(), tipo:"Cálculo Rápido", pesoTotal: item.peso, itens:[item] };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){ Store.add(entry); renderTables(); }
  }

  function captureFardos(){
    const rows=[...document.querySelectorAll("#fardos-table tbody tr")];
    const itens=rows.map((tr,idx)=>{
      const tds=[...tr.querySelectorAll("td")].map(td=>td.textContent.trim());
      const comp = numFrom(tds[1]||"");
      const larg = numFrom(tds[2]||"");
      const pecas= numFrom(tds[3]||"");
      const peso = numFrom(tds[4]||"");
      return { index: idx+1, comp, larg, pecas, peso };
    });
    const total = numFrom(qs("#fardosTotal")?.textContent||"");
    const entry = { data: now(), tipo:"Cálculo por Fardos", pesoTotal: Number(total||0), itens };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){ Store.add(entry); renderTables(); }
  }

  window.addEventListener("DOMContentLoaded",()=>{
    const bR=qs("#btnCalcUnico"); if(bR) bR.addEventListener("click",()=>setTimeout(captureRapido,0));
    const bF=qs("#btnGerarFardos"); if(bF) bF.addEventListener("click",()=>setTimeout(captureFardos,0));
    bindActions(); renderTables();
  });

  window.HistoryAPI = {
    add(e){ Store.add(e); renderTables(); },
    all(){ return Store.all(); },
    clear(){ Store.clear(); renderTables(); }
  };
})();

