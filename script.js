// === Tema ===
(function themeInit(){
  function applyTheme(t){
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch(e){}
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    const tl = document.getElementById('t-light');
    const td = document.getElementById('t-dark');
    const te = document.getElementById('t-excel');
    tl && tl.addEventListener('click', ()=>applyTheme('light'));
    td && td.addEventListener('click', ()=>applyTheme('dark'));
    te && te.addEventListener('click', ()=>applyTheme('excel'));
  });
})();

// ===== Storage / Utils =====
const LS_KEY = 'materiais_ppm_v3';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function loadMaterials(){ try{return JSON.parse(localStorage.getItem(LS_KEY))||[]}catch{return[]} }
function saveMaterials(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
let materials = loadMaterials();

// >>> EDITE AQUI <<<
const GROUPS_M2 = new Set(['1004', '1005', '1006', '1018', '1019', '1020']);

// ===== Helpers =====
function parseBR_num(s){
  if(s===null||s===undefined) return 0;
  s = String(s).trim().replace(/\./g,'').replace(',','.');
  const n = Number(s);
  return Number.isFinite(n)?n:0;
}
function fmtBR3(n){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}); }

function isM2(material){
  const g = (material?.group ?? '').toString().trim();
  return g && GROUPS_M2.has(g);
}

// ===== Importação Excel =====
function importExcel(){
  const file = $('#fileExcel').files[0];
  if(!file) return alert('Selecione o Excel.');
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
      if(!rows.length) return alert('Planilha vazia.');

      const imported=[];
      for(let r=1;r<rows.length;r++){
        const row = rows[r]; if(!row||!row.length) continue;
        const code = String(row[0]||'').trim();
        const name = String(row[1]||'').trim();
        const raw  = row[2];
        const group = String(row[3]||'').trim();
        if(!name || raw==='') continue;
        let ppmDisplay='', ppm=0;
        if(typeof raw === 'number'){
          ppm = raw;
          ppmDisplay = raw.toLocaleString('pt-BR',{minimumFractionDigits:3, maximumFractionDigits:3});
        } else {
          ppmDisplay = String(raw).trim();
          ppm = parseBR_num(ppmDisplay);
        }
        if(!(ppm>0)) continue;
        imported.push({id:crypto.randomUUID(),code,name,ppm,ppmDisplay,group,source:'excel'});
      }

      materials = [...imported, ...materials];
      saveMaterials(materials);
      renderMaterialTable();
      renderMaterialSelects();

      const ia=$('#importArea'); if(ia) ia.open=false;
      const ct=$('#cadTable'); if(ct) ct.open=false;
      alert(`Importados: ${imported.length}`);
    }catch(err){ console.error(err); alert('Erro ao importar.'); }
  };
  reader.readAsArrayBuffer(file);
}

// ===== Renderização =====
function displayPPM(m){ return m.ppmDisplay||''; }

function renderMaterialTable(){
  const tbody=$('#material-table tbody'); if(!tbody) return;
  tbody.innerHTML='';
  materials.forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${m.code||''}</td>
      <td>${m.name||''}</td>
      <td>${m.group||''}</td>
      <td class="ppm">${displayPPM(m)}</td>
      <td class="center">
        <button class="btn outline" data-edit="${m.id}">Editar</button>
        <button class="btn danger" data-del="${m.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-edit]').forEach(b=>b.onclick=()=>{
    const m = materials.find(x=>x.id===b.dataset.edit);
    $('#matCodigo').value=m.code||'';
    $('#matName').value=m.name||'';
    $('#matGrupo').value=m.group||'';
    $('#matPpm').value=m.ppmDisplay||'';
    $('#material-form').dataset.editing=m.id;
    $('#material-form button[type="submit"]').textContent='Salvar';
  });

  tbody.querySelectorAll('button[data-del]').forEach(b=>b.onclick=()=>{
    materials = materials.filter(x=>x.id!==b.dataset.del);
    saveMaterials(materials);
    renderMaterialTable(); renderMaterialSelects();
  });

  $('#cadSummary').textContent=`📦 Ver cadastro (${materials.length} itens)`;
}

function renderMaterialSelects(){
  const sels=[$('#selMaterial'),$('#selMaterialFardo')];
  const sorted=[...materials].sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  sels.forEach(sel=>{
    sel.innerHTML='';
    sorted.forEach(m=>{
      const opt=document.createElement('option');
      opt.value=m.id;
      const suf = isM2(m) ? 'kg/m²' : 'kg/m';
      opt.textContent=`${m.code} — ${m.name} — ${displayPPM(m)} ${suf}`;
      sel.appendChild(opt);
    });
  });
  updateUIForMaterial();
}

// ===== Cadastro manual =====
function setupForm(){
  const form=$('#material-form');
  form.onsubmit=e=>{
    e.preventDefault();
    const code=$('#matCodigo').value.trim();
    const name=$('#matName').value.trim();
    const group=$('#matGrupo').value.trim();
    const ppmDisplay=$('#matPpm').value.trim();
    const ppm=parseBR_num(ppmDisplay);
    if(!name) return alert('Informe a descrição.');
    if(!(ppm>0)) return alert('PPM inválido.');
    const editing=form.dataset.editing;
    if(editing){
      const i=materials.findIndex(m=>m.id===editing);
      Object.assign(materials[i], { code, name, group, ppm, ppmDisplay });
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent='Adicionar';
    } else {
      materials.unshift({id:crypto.randomUUID(),code,name,group,ppm,ppmDisplay,source:'manual'});
    }
    saveMaterials(materials);
    form.reset();
    renderMaterialTable(); renderMaterialSelects();
  };

  $('#btnClear').onclick=()=>{
    form.reset();
    delete form.dataset.editing;
    form.querySelector('button[type="submit"]').textContent='Adicionar';
  };

  $('#btnExcluirTudo').onclick=()=>{
    if(confirm('Excluir tudo?')){
      materials=[];
      saveMaterials(materials);
      renderMaterialTable(); renderMaterialSelects();
    }
  };

  $('#btnImportExcel').onclick=importExcel;
  $('#btnExportJSON').onclick=()=>{
    const blob=new Blob([JSON.stringify(materials,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='materiais.json'; a.click();
    URL.revokeObjectURL(url);
  };
}

// ===== UI m² / m =====
function currentMaterial(){ return materials.find(x=>x.id===$('#selMaterial').value) || null; }
function currentMaterialFardos(){ return materials.find(x=>x.id===$('#selMaterialFardo').value) || null; }

function updateUIForMaterial(){
  const m = currentMaterial();
  const show = isM2(m);
  const lf = $('#larguraField');
  if(lf) lf.classList.toggle('hide', !show);

  const table = $('#fardos-table');
  table.querySelectorAll('th.col-larg').forEach(th=>th.style.display = show?'':'none');
  table.querySelectorAll('td.col-larg').forEach(td=>td.style.display = show?'':'none');
}
function updateUIForMaterialFardos(){
  const m = currentMaterialFardos();
  const show = isM2(m);
  const table = $('#fardos-table');
  table.querySelectorAll('th.col-larg').forEach(th=>th.style.display = show?'':'none');
  table.querySelectorAll('td.col-larg').forEach(td=>td.style.display = show?'':'none');
}

// ===== Cálculo Rápido =====
function calcUnico(){
  const m=currentMaterial();
  if(!m) return;
  const comp=parseBR_num($('#inComprimento').value);
  const pecas=parseBR_num($('#inPecas').value);
  let pesoComp=0;
  if(isM2(m)){
    const larg=parseBR_num($('#inLargura').value);
    pesoComp = comp * larg * m.ppm;
  }else{ pesoComp = comp * m.ppm; }
  const pesoTotal=pesoComp*pecas;
  $('#pesoComprimentoView').textContent=`${fmtBR3(pesoComp)} kg`;
  $('#pesoTotalView').textContent=`${fmtBR3(pesoTotal)} kg`;
}
function setupCalcUnico(){
  $('#btnCalcUnico').onclick=calcUnico;
  $('#selMaterial').onchange=()=>{ updateUIForMaterial(); calcUnico(); };
}

// ===== Fardos =====
function makeFardoRow(i, showLarg){
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td>${i+1}</td>
    <td><input type="text" class="f-comp" placeholder="Ex.: 6,000"></td>
    <td class="col-larg"${showLarg?'':' style="display:none"'}><input type="text" class="f-larg" placeholder="Ex.: 1,800"></td>
    <td><input type="number" class="f-pecas" placeholder="Ex.: 3"></td>
    <td class="f-peso">0,000</td>`;
  return tr;
}
function renderFardosRows(qtd){
  const tbody=$('#fardos-table tbody');
  const m = currentMaterialFardos();
  const showLarg = isM2(m);
  tbody.innerHTML='';
  for(let i=0;i<qtd;i++){ tbody.appendChild(makeFardoRow(i, showLarg)); }
  tbody.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',calcFardos));
  updateUIForMaterialFardos(); calcFardos();
}
function calcFardos(){
  const m=currentMaterialFardos();
  if(!m) return;
  let total=0; const isArea=isM2(m);
  $$('#fardos-table tbody tr').forEach(row=>{
    const comp=parseBR_num(row.querySelector('.f-comp')?.value);
    const pecas=parseBR_num(row.querySelector('.f-pecas')?.value);
    let peso=0;
    if(isArea){
      const larg=parseBR_num(row.querySelector('.f-larg')?.value);
      peso = comp*larg*m.ppm*pecas;
    }else{ peso = comp*m.ppm*pecas; }
    row.querySelector('.f-peso').textContent=fmtBR3(peso);
    total+=peso;
  });
  $('#fardosTotal').textContent=fmtBR3(total);
  $('#totalHighlight').textContent=`Total geral: ${fmtBR3(total)} kg`;
}
function setupFardos(){
  $('#btnGerarFardos').onclick=()=>renderFardosRows(parseBR_num($('#inQtdFardos').value));
  $('#btnLimparFardos').onclick=()=>{
    $('#fardos-table tbody').innerHTML='';
    $('#fardosTotal').textContent='0,000';
    $('#totalHighlight').textContent='Total geral: 0,000 kg';
  };
  $('#selMaterialFardo').onchange=()=>{ updateUIForMaterialFardos(); calcFardos(); };
  $('#btnExportExcel').onclick=exportFardosExcel;
}

// ===== Busca =====
function setupSearch(){
  function apply(code){
    const m=materials.find(x=>String(x.code)===String(code));
    if(!m) return;
    $('#selMaterial').value=m.id;
    $('#selMaterialFardo').value=m.id;
    updateUIForMaterial(); updateUIForMaterialFardos();
  }
  $('#searchCodigo').oninput=e=>apply(e.target.value.trim());
  $('#searchCodigoFardos').oninput=e=>apply(e.target.value.trim());
}

// ===== Exportação Excel (EX1 completo) =====
function exportFardosExcel(){
  const m=currentMaterialFardos();
  if(!m){ alert('Selecione um material nos fardos.'); return; }

  const areaMode = isM2(m);
  const rows = [[
    '#','Comp (m)'
  ].concat(areaMode?['Larg (m)']:[]).concat([
    'Peças','Peso Unit (kg)','Peso Total (kg)','Código','Descrição','PPM','Grupo'
  ])];

  let totalGeral = 0;
  let idx = 1;
  $$('#fardos-table tbody tr').forEach(tr=>{
    const comp = parseBR_num(tr.querySelector('.f-comp')?.value);
    const pecas = parseBR_num(tr.querySelector('.f-pecas')?.value);
    let pesoUnit = 0;
    let larg = null;
    if(areaMode){
      larg = parseBR_num(tr.querySelector('.f-larg')?.value);
      pesoUnit = (comp * larg) * m.ppm;
    }else{
      pesoUnit = comp * m.ppm;
    }
    const pesoTotal = pesoUnit * pecas;
    totalGeral += pesoTotal;

    const base = [idx, comp];
    if(areaMode) base.push(larg);
    base.push(pecas, pesoUnit, pesoTotal, m.code||'', m.name||'', m.ppm, m.group||'');
    rows.push(base);
    idx++;
  });

  const totalRow = ['TOTAL GERAL'];
  const offset = areaMode ? 4 : 3;
  for(let i=0;i<offset;i++) totalRow.push('');
  totalRow.push(totalGeral);
  totalRow.push('','','','');
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fardos');

  function col(c){ return XLSX.utils.encode_col(c); }
  function addr(r,c){ return col(c)+(r+1); }

  const colComp = 1;
  const colLarg = areaMode ? 2 : null;
  const colPecas = areaMode ? 3 : 2;
  const colPesoUnit = areaMode ? 4 : 3;
  const colPesoTotal = areaMode ? 5 : 4;
  const colPPM = areaMode ? 8 : 7;

  for(let r=1; r<=rows.length-2; r++){
    const a1 = addr(r, colComp);
    if(ws[a1]) ws[a1].t='n', ws[a1].z='0.000';
    if(areaMode){
      const a2 = addr(r, colLarg);
      if(ws[a2]) ws[a2].t='n', ws[a2].z='0.000';
    }
    const ap = addr(r, colPecas);
    if(ws[ap]) ws[ap].t='n', ws[ap].z='0';
    const au = addr(r, colPesoUnit);
    const at = addr(r, colPesoTotal);
    if(ws[au]) ws[au].t='n', ws[au].z='0.000';
    if(ws[at]) ws[at].t='n', ws[at].z='0.000';

    const apm = addr(r, colPPM);
    if(ws[apm]) ws[apm].t='n', ws[apm].z='0.000';
  }
  const last = rows.length-1;
  const atot = addr(last, colPesoTotal);
  if(ws[atot]) ws[atot].t='n', ws[atot].z='0.000';

  XLSX.writeFile(wb, `fardos_${(m.code||'material')}.xlsx`.replace(/[^\w.-]+/g,'_'));
}

// ===== Init =====
function init(){
  renderMaterialTable(); renderMaterialSelects();
  setupForm(); setupCalcUnico(); setupFardos(); setupSearch();
  const ct=$('#cadTable'); if(ct) ct.open=false;
  updateUIForMaterial(); updateUIForMaterialFardos();
}
document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   NX2 — HISTÓRICO (CALC RÁPIDO + FARDOS) — MODO B — COMPLETO
   ===================================================================== */
(function NX2_History(){
  "use strict";

  const KEY = "nx2_hist_v1";
  const qs  = (s,el=document)=>el.querySelector(s);
  const qsa = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const pad = n=>String(n).padStart(2,"0");
  const now = ()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const brNum = (txt)=>{ if(txt==null) return 0; const s=String(txt).replace(/\./g,"").replace(",",".").match(/-?[\d.]+/); return s?Number(s[0]):0; };

  const Store = {
    all(){ try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]} },
    set(v){ localStorage.setItem(KEY, JSON.stringify(v)); },
    add(x){ const a=this.all(); a.unshift(x); this.set(a); },
    rm(i){ const a=this.all(); if(i>=0&&i<a.length){ a.splice(i,1); this.set(a);} },
    clear(){ localStorage.removeItem(KEY); }
  };

  function resumo(itens){
    if(!Array.isArray(itens)||!itens.length) return "—";
    const p = itens.slice(0,3).map(x=>`${(x.grupo??x.index??"?")}: ${Number(x.peso||0).toFixed(3)}kg`);
    return p.join(", ")+(itens.length>3?` +${itens.length-3}`:"");
  }

  function render(){
    const rows = Store.all();
    const tb1 = qs("#tableH1 tbody"), tb2 = qs("#tableH2 tbody");
    [tb1,tb2].forEach(tb=>{ if(tb) tb.innerHTML=""; });
    if(!rows.length){
      [tb1,tb2].forEach(tb=>{
        if(!tb) return;
        const tr=document.createElement("tr"), td=document.createElement("td");
        td.colSpan=5; td.innerHTML='<em style="opacity:.8">Sem registros.</em>';
        tr.appendChild(td); tb.appendChild(tr);
      });
      return;
    }
    rows.forEach((r,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${r.data||"—"}</td>
        <td>${r.tipo||"—"}</td>
        <td>${resumo(r.itens)}</td>
        <td class="right">${Number(r.pesoTotal||0).toFixed(3)}</td>
        <td class="center">
          <button class="btn outline" data-acao="ver" data-i="${i}">Ver</button>
          <button class="btn danger" data-acao="del" data-i="${i}">Excluir</button>
        </td>`;
      if(tb1) tb1.appendChild(tr.cloneNode(true));
      if(tb2) tb2.appendChild(tr.cloneNode(true));
    });
  }

  function openModal(id){ const m=qs("#"+id); if(m) m.hidden=false; }
  function closeModal(id){ const m=qs("#"+id); if(m) m.hidden=true; }
  document.addEventListener("click",(ev)=>{ const c=ev.target.getAttribute("data-close"); if(c) closeModal(c); });

  function esc(s){ return String(s).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function verDetalhes(entry){
    const wrap = qs("#detalhesBody"); if(!wrap) return;
    const itens = Array.isArray(entry.itens)?entry.itens:[];
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
      <ul style="margin:6px 0 0 18px">${li || "<li>—</li>"}</ul>`;
    openModal("modalDetalhes");
  }

  function bind(){
    ["tableH1","tableH2"].forEach(id=>{
      const el = qs("#"+id); if(!el) return;
      el.addEventListener("click",(ev)=>{
        const b=ev.target.closest("button"); if(!b) return;
        const act=b.getAttribute("data-acao"); const i=Number(b.getAttribute("data-i"));
        if(act==="ver"){ const e=Store.all()[i]; if(e) verDetalhes(e); }
        else if(act==="del"){ if(confirm("Excluir este registro?")){ Store.rm(i); render(); } }
      });
    });
    const b1=qs("#btnLimparTudoH1"); if(b1) b1.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){ Store.clear(); render(); } });
    const b2=qs("#btnLimparTudoH2"); if(b2) b2.addEventListener("click",()=>{ if(confirm("Limpar todo o histórico?")){ Store.clear(); render(); } });
    const bh=qs("#t-history"); if(bh) bh.addEventListener("click",()=> openModal("modalHistorico"));
  }

  // Coleta Cálculo Rápido
  function capturaRapido(){
    const total = brNum(qs("#pesoTotalView")?.textContent||"");
    const sel = qs("#selMaterial");
    const mat = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent.trim() : "Material";
    const pecas = Number(qs("#inPecas")?.value||0);
    const item = { grupo: mat, pecas, peso: Number(total||0) };
    const entry = { data: now(), tipo:"Cálculo Rápido", pesoTotal: item.peso, itens:[item] };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){ Store.add(entry); render(); }
  }

  // Coleta Fardos (NX2b)
  function capturaFardos(){
    const rows = qsa("#fardos-table tbody tr");
    const itens = rows.map((tr,idx)=>{
      const tds = qsa("td", tr).map(td=>td.textContent.trim());
      return { index: idx+1, comp: brNum(tds[1]), larg: brNum(tds[2]), pecas: brNum(tds[3]), peso: brNum(tds[4]) };
    });
    const total = brNum(qs("#fardosTotal")?.textContent||"");
    const entry = { data: now(), tipo:"Cálculo por Fardos", pesoTotal: Number(total||0), itens };
    if(Number.isFinite(entry.pesoTotal) && entry.pesoTotal>0){ Store.add(entry); render(); }
  }

  window.addEventListener("DOMContentLoaded", ()=>{
    const bR = qs("#btnCalcUnico"); 
    if(bR) bR.addEventListener("click", ()=> setTimeout(capturaRapido, 0));

    const bEX = qs("#btnExportExcel");
if(bEX) bEX.addEventListener("click", ()=> setTimeout(capturaFardos, 0));


    bind(); render();
  });

  // API pública (opcional)
  window.HistoryAPI = {
    add(e){ Store.add(e); render(); },
    all(){ return Store.all(); },
    clear(){ Store.clear(); render(); }
  };
})();
