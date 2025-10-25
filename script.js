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

// ===== Storage =====
const LS_KEY = 'materiais_ppm_v3';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function loadMaterials(){ try{return JSON.parse(localStorage.getItem(LS_KEY))||[]}catch{return[]}};
function saveMaterials(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
let materials = loadMaterials();

// ===== Helpers =====
function parseBR_num(s){
  if(s===null||s===undefined) return 0;
  s = String(s).trim();
  s = s.replace(/\./g,'').replace(',','.');
  const n = Number(s);
  return Number.isFinite(n)?n:0;
}
function fmtBR3(n){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}); }
function isChapa(name){
  const s = String(name||'').trim().toUpperCase();
  return /^CH(\s|#)|^CHAPA/.test(s);
}

// IMPORTAÇÃO EXCEL
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
        if(!name || raw==='') continue;

        let ppmDisplay = '';
        let ppm = 0;

        if(typeof raw === 'number'){
          ppm = raw;
          ppmDisplay = raw.toLocaleString('pt-BR',{
            minimumFractionDigits:3, maximumFractionDigits:3
          });
        } else {
          ppmDisplay = String(raw).trim();
          ppm = parseBR_num(ppmDisplay);
        }
        if(!(ppm>0)) continue;

        imported.push({ id:crypto.randomUUID(), code, name, ppm, ppmDisplay, source:'excel' });
      }

      materials = [...imported, ...materials];
      saveMaterials(materials);
      renderMaterialTable();
      renderMaterialSelects();

      const ia = $('#importArea'); if(ia) ia.open=false;
      const ct = $('#cadTable');  if(ct) ct.open=false;
      alert(`Importados: ${imported.length}`);
    }catch(err){ console.error(err); alert('Erro ao importar.'); }
  };
  reader.readAsArrayBuffer(file);
}

// RENDER TABELA
function displayPPM(m){ return m.ppmDisplay||''; }

function renderMaterialTable(){
  const tbody = $('#material-table tbody'); if(!tbody) return;
  tbody.innerHTML='';
  materials.forEach(m=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${m.code||''}</td>
      <td>${m.name||''}</td>
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
      opt.textContent=`${m.code} — ${m.name} — ${displayPPM(m)} kg/m`;
      sel.appendChild(opt);
    });
  });
  updateUIForMaterial();
}

// CADASTRO MANUAL
function setupForm(){
  const form=$('#material-form');
  form.onsubmit=e=>{
    e.preventDefault();
    const code=$('#matCodigo').value.trim();
    const name=$('#matName').value.trim();
    const ppmDisplay=$('#matPpm').value.trim();
    const ppm=parseBR_num(ppmDisplay);

    if(!name) return alert('Informe a descrição.');
    if(!(ppm>0)) return alert('PPM inválido.');

    const editing=form.dataset.editing;
    if(editing){
      const i=materials.findIndex(m=>m.id===editing);
      materials[i].code=code;
      materials[i].name=name;
      materials[i].ppm=ppm;
      materials[i].ppmDisplay=ppmDisplay;
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent='Adicionar';
    } else {
      materials.unshift({id:crypto.randomUUID(),code,name,ppm,ppmDisplay,source:'manual'});
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

// === UI de Chapa / Não-chapa ===
function currentMaterial(){
  return materials.find(x=>x.id===$('#selMaterial').value) || null;
}
function currentMaterialFardos(){
  return materials.find(x=>x.id===$('#selMaterialFardo').value) || null;
}
function updateUIForMaterial(){
  const m = currentMaterial();
  const chapa = m ? isChapa(m.name) : false;
  const lf = $('#larguraField');
  if(lf) lf.classList.toggle('hide', !chapa);

  const table = $('#fardos-table');
  table.querySelectorAll('th.col-larg').forEach(th=>th.style.display = chapa?'':'none');
  table.querySelectorAll('td.col-larg').forEach(td=>td.style.display = chapa?'':'none');
}
function updateUIForMaterialFardos(){
  const m = currentMaterialFardos();
  const chapa = m ? isChapa(m.name) : false;
  const table = $('#fardos-table');
  table.querySelectorAll('th.col-larg').forEach(th=>th.style.display = chapa?'':'none');
  table.querySelectorAll('td.col-larg').forEach(td=>td.style.display = chapa?'':'none');
}

// CÁLCULO ÚNICO
function calcUnico(){
  const m=currentMaterial();
  if(!m) return;
  const comp=parseBR_num($('#inComprimento').value);
  const pecas=parseBR_num($('#inPecas').value);
  const chapa=isChapa(m.name);
  let pesoComp=0;

  if(chapa){
    const larg=parseBR_num($('#inLargura').value);
    const area = comp * larg;
    pesoComp = area * m.ppm;
  }else{
    pesoComp = comp * m.ppm;
  }
  const pesoTotal=pesoComp*pecas;
  $('#ppmView').textContent=`${displayPPM(m)} ${chapa?'kg/m²':'kg/m'}`;
  $('#pesoComprimentoView').textContent=`${fmtBR3(pesoComp)} kg`;
  $('#pesoTotalView').textContent=`${fmtBR3(pesoTotal)} kg`;
}
function setupCalcUnico(){
  $('#btnCalcUnico').onclick=calcUnico;
  $('#selMaterial').onchange=()=>{ updateUIForMaterial(); calcUnico(); };
}

// FARDOS
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
  const showLarg = m ? isChapa(m.name) : false;
  tbody.innerHTML='';
  for(let i=0;i<qtd;i++){
    tbody.appendChild(makeFardoRow(i, showLarg));
  }
  tbody.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',calcFardos));
  updateUIForMaterialFardos();
  calcFardos();
}
function calcFardos(){
  const m=currentMaterialFardos();
  if(!m) return;
  const chapa=isChapa(m.name);
  let total=0;
  $$('#fardos-table tbody tr').forEach(row=>{
    const comp=parseBR_num(row.querySelector('.f-comp')?.value);
    const pecas=parseBR_num(row.querySelector('.f-pecas')?.value);
    let peso=0;
    if(chapa){
      const larg=parseBR_num(row.querySelector('.f-larg')?.value);
      const area = comp * larg;
      peso = area * m.ppm * pecas;
    }else{
      peso = comp * m.ppm * pecas;
    }
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

// BUSCA POR CÓDIGO
function setupSearch(){
  function apply(code){
    const m=materials.find(x=>String(x.code)===String(code));
    if(!m) return;
    $('#selMaterial').value=m.id;
    $('#selMaterialFardo').value=m.id;
    updateUIForMaterial();
    updateUIForMaterialFardos();
  }
  $('#searchCodigo').oninput=e=>apply(e.target.value.trim());
  $('#searchCodigoFardos').oninput=e=>apply(e.target.value.trim());
}

// === EXPORTAÇÃO EXCEL (X2, D3) ===
function exportFardosExcel(){
  const m=currentMaterialFardos();
  if(!m){ alert('Selecione um material nos fardos.'); return; }

  const chapa = isChapa(m.name);
  const rows = [['#','Comp (m)'].concat(chapa?['Larg (m)']:[]).concat(['Peças','Peso Unit (kg)','Peso Total (kg)','Código','Descrição','PPM'])];

  let totalGeral = 0;
  let idx = 1;
  $$('#fardos-table tbody tr').forEach(tr=>{
    const comp = parseBR_num(tr.querySelector('.f-comp')?.value);
    const pecas = parseBR_num(tr.querySelector('.f-pecas')?.value);
    let pesoUnit = 0;
    let larg = null;
    if(chapa){
      larg = parseBR_num(tr.querySelector('.f-larg')?.value);
      pesoUnit = (comp * larg) * m.ppm;
    }else{
      pesoUnit = comp * m.ppm;
    }
    const pesoTotal = pesoUnit * pecas;
    totalGeral += pesoTotal;

    const base = [idx, comp];
    if(chapa) base.push(larg);
    base.push(pecas, pesoUnit, pesoTotal, m.code||'', m.name||'', m.ppm);
    rows.push(base);
    idx++;
  });

  // TOTAL GERAL
  const totalRow = ['TOTAL GERAL'];
  // pad empty cells until reach Peso Total column
  const offset = chapa ? 4 : 3; // after #, comp,(larg), peças
  for(let i=0;i<offset;i++) totalRow.push('');
  totalRow.push(totalGeral); // Peso Total (kg)
  totalRow.push('','',''); // Código, Descrição, PPM vazios
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fardos');

  // Formatação de número D3 (0,000) — community edition permite 'z' (mask)
  const range = XLSX.utils.decode_range(ws['!ref']);
  // Descobrir índices das colunas
  // 0:#, 1:Comp, (2:Larg), (3|2):Peças, etc.
  function col(c){ return XLSX.utils.encode_col(c); }
  function addr(r,c){ return col(c)+(r+1); }

  const colComp = 1;
  const colLarg = chapa ? 2 : null;
  const colPecas = chapa ? 3 : 2;
  const colPesoUnit = chapa ? 4 : 3;
  const colPesoTotal = chapa ? 5 : 4;
  const colPPM = chapa ? 8 : 7;

  for(let r=1; r<=rows.length-2; r++){ // linhas de dados (ignora header=0 e total=last)
    // comp
    const a1 = addr(r, colComp);
    if(ws[a1]) ws[a1].t='n', ws[a1].z='0.000';
    // larg
    if(chapa){
      const a2 = addr(r, colLarg);
      if(ws[a2]) ws[a2].t='n', ws[a2].z='0.000';
    }
    // peças (inteiro)
    const ap = addr(r, colPecas);
    if(ws[ap]) ws[ap].t='n', ws[ap].z='0';
    // pesos
    const au = addr(r, colPesoUnit);
    const at = addr(r, colPesoTotal);
    if(ws[au]) ws[au].t='n', ws[au].z='0.000';
    if(ws[at]) ws[at].t='n', ws[at].z='0.000';
    // ppm
    const apm = addr(r, colPPM);
    if(ws[apm]) ws[apm].t='n', ws[apm].z='0.000';
  }
  // formatar total geral (última linha)
  const last = rows.length-1;
  const atot = addr(last, colPesoTotal);
  if(ws[atot]) ws[atot].t='n', ws[atot].z='0.000';

  // OBS: estilização (cor verde) não é suportada na versão community do SheetJS.
  // Para destacar, deixamos "TOTAL GERAL" em caps; no Excel você pode aplicar uma Regra Rápida de realce, se desejar.

  const filename = `fardos_${(m.code||'material')}.xlsx`.replace(/[^\w.-]+/g,'_');
  XLSX.writeFile(wb, filename);
}

// INIT
function init(){
  renderMaterialTable();
  renderMaterialSelects();
  setupForm();
  setupCalcUnico();
  setupFardos();
  setupSearch();
  const ct = $('#cadTable'); if(ct) ct.open=false;
  updateUIForMaterial(); updateUIForMaterialFardos();
}
document.addEventListener('DOMContentLoaded', init);
