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
const GROUPS_M2 = new Set(['1004','10051,'1006','1018','1019','1020']);

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
  tr.innerHTML=`<td>${i+1}</td>
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

// ===== Exportação Excel (EX1) =====
function exportFardosExcel(){ /* (mesmo conteúdo que o seu original) */ }

// ===== Init =====
function init(){
  renderMaterialTable(); renderMaterialSelects();
  setupForm(); setupCalcUnico(); setupFardos(); setupSearch();
  const ct=$('#cadTable'); if(ct) ct.open=false;
  updateUIForMaterial(); updateUIForMaterialFardos();
}
document.addEventListener('DOMContentLoaded', init);

/* =====================================================================
   NX2 — HISTÓRICO (H1 + H2) — INTEGRAÇÃO FINAL
   ===================================================================== */
(function NX2_History(){
  "use strict";
  const KEY="nx2_hist_v1";
  const qs=(s,e=document)=>e.querySelector(s);
  const qsa=(s,e=document)=>Array.from(e.querySelectorAll(s));
  const pad=n=>String(n).padStart(2,"0");
  const now=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const brNum=t=>{if(t==null)return 0;const s=String(t).replace(/\./g,"").replace(",",".").match(/-?[\d.]+/);return s?Number(s[0]):0};
  const Store={all(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}},set(v){localStorage.setItem(KEY,JSON.stringify(v))},add(x){const a=this.all();a.unshift(x);this.set(a)},rm(i){const a=this.all();if(i>=0&&i<a.length){a.splice(i,1);this.set(a)}},clear(){localStorage.removeItem(KEY)}};

  function resumo(i){if(!Array.isArray(i)||!i.length)return"—";const p=i.slice(0,3).map(x=>`${(x.grupo??x.index??"?")}: ${Number(x.peso||0).toFixed(3)}kg`);return p.join(", ")+(i.length>3?` +${i.length-3}`:"");}
  function render(){const r=Store.all(),tb1=qs("#tableH1 tbody"),tb2=qs("#tableH2 tbody");[tb1,tb2].forEach(tb=>{if(tb)tb.innerHTML=""});if(!r.length){[tb1,tb2].forEach(tb=>{if(!tb)return;const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.innerHTML='<em>Sem registros.</em>';tr.appendChild(td);tb.appendChild(tr)});return;}
    r.forEach((x,i)=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${x.data}</td><td>${x.tipo}</td><td>${resumo(x.itens)}</td><td>${Number(x.pesoTotal).toFixed(3)}</td><td><button data-acao="ver" data-i="${i}">Ver</button><button data-acao="del" data-i="${i}">Excluir</button></td>`;if(tb1)tb1.appendChild(tr.cloneNode(true));if(tb2)tb2.appendChild(tr.cloneNode(true));});}

  function capturaRapido(){const total=brNum(qs("#pesoTotalView")?.textContent||"");const sel=qs("#selMaterial");const mat=sel&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent.trim():"Material";const pecas=Number(qs("#inPecas")?.value||0);const item={grupo:mat,pecas,peso:total};const entry={data:now(),tipo:"Cálculo Rápido",pesoTotal:total,itens:[item]};if(total>0){Store.add(entry);render();}}
  function capturaFardos(){const rows=qsa("#fardos-table tbody tr");const itens=rows.map((tr,i)=>{const tds=qsa("td",tr).map(td=>td.textContent.trim());return{index:i+1,comp:brNum(tds[1]),larg:brNum(tds[2]),pecas:brNum(tds[3]),peso:brNum(tds[4])}});const total=brNum(qs("#fardosTotal")?.textContent||"");const entry={data:now(),tipo:"Cálculo por Fardos",pesoTotal:total,itens};if(total>0){Store.add(entry);render();}}

  window.addEventListener("DOMContentLoaded",()=>{const b1=qs("#btnCalcUnico");if(b1)b1.addEventListener("click",()=>setTimeout(capturaRapido,0));const b2=qs("#btnGerarFardos");if(b2)b2.addEventListener("click",()=>setTimeout(capturaFardos,0));render();});
})();
