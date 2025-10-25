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

// conversão só para cálculo
function parseBR_num(s){
  if(s===null||s===undefined) return 0;
  s = String(s).trim();
  s = s.replace(/\./g,'').replace(',','.');
  const n = Number(s);
  return Number.isFinite(n)?n:0;
}
function fmtBR3(n){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3}); }

// IMPORTAÇÃO EXCEL
function normalizeHeader(h){
  return String(h||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
}

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

      // cabeçalho livre, mas assumimos 3 colunas principais nas primeiras posições
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
          // CASO A → NÚMERO DO EXCEL → 3 CASAS e vírgula
          ppm = raw;
          ppmDisplay = raw.toLocaleString('pt-BR',{
            minimumFractionDigits:3,
            maximumFractionDigits:3
          });
        } else {
          // texto literal
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

      // fecha import e listagem
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

// CÁLCULO ÚNICO
function calcUnico(){
  const m=materials.find(x=>x.id==$('#selMaterial').value);
  if(!m) return;
  const comp=parseBR_num($('#inComprimento').value);
  const pecas=parseBR_num($('#inPecas').value);
  const pesoComp=comp*m.ppm;
  const pesoTotal=pesoComp*pecas;
  $('#ppmView').textContent=`${displayPPM(m)} kg/m`;
  $('#pesoComprimentoView').textContent=`${fmtBR3(pesoComp)} kg`;
  $('#pesoTotalView').textContent=`${fmtBR3(pesoTotal)} kg`;
}
function setupCalcUnico(){
  $('#btnCalcUnico').onclick=calcUnico;
  $('#selMaterial').onchange=calcUnico;
}

// FARDOS
function renderFardosRows(qtd){
  const tbody=$('#fardos-table tbody'); tbody.innerHTML='';
  for(let i=0;i<qtd;i++){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${i+1}</td>
      <td><input type="text" class="f-comp"></td>
      <td><input type="number" class="f-pecas"></td>
      <td class="f-peso">0,000</td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',calcFardos));
  calcFardos();
}
function calcFardos(){
  const m=materials.find(x=>x.id==$('#selMaterialFardo').value);
  if(!m) return;
  let total=0;
  $$('#fardos-table tbody tr').forEach(row=>{
    const comp=parseBR_num(row.querySelector('.f-comp').value);
    const pecas=parseBR_num(row.querySelector('.f-pecas').value);
    const peso=comp*m.ppm*pecas;
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
  $('#selMaterialFardo').onchange=calcFardos;
}

// BUSCA POR CÓDIGO
function setupSearch(){
  function apply(code){
    const m=materials.find(x=>String(x.code)===String(code));
    if(!m) return;
    $('#selMaterial').value=m.id;
    $('#selMaterialFardo').value=m.id;
  }
  $('#searchCodigo').oninput=e=>apply(e.target.value.trim());
  $('#searchCodigoFardos').oninput=e=>apply(e.target.value.trim());
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
}
document.addEventListener('DOMContentLoaded', init);
