// ===== Storage =====
const LS_KEY = 'materiais_ppm_v2';
function loadMaterials(){ try{const r=localStorage.getItem(LS_KEY); return r?JSON.parse(r):[]}catch{return[]}}
function saveMaterials(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
let materials = loadMaterials();

// ===== Utils =====
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// parse BR estrito para CONTA INTERNA (exibição nunca é alterada)
function parseBR_strict(s){
  if(s===null||s===undefined) return 0;
  if(typeof s==='number' && Number.isFinite(s)) return s;
  s = String(s).trim(); if(!s) return 0;
  s = s.replace(/[^\d.,-]/g,'');           // mantém dígitos , .
  s = s.replace(/\./g,'').replace(',', '.'); // remove milhar, vírgula -> ponto
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// resultado sempre pt-BR com 3 casas
function fmtBR3(n){ return Number(n).toLocaleString('pt-BR',{minimumFractionDigits:3, maximumFractionDigits:3}); }

// cabeçalho normalizado
function normalizeHeader(h){
  return String(h||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
}

function getMaterialById(id){ return materials.find(m=>m.id===id) || null; }

// exibir PPM: SEMPRE ppmDisplay (texto puro), sem fallback
function displayPPM(m){
  return (m && typeof m.ppmDisplay === 'string') ? m.ppmDisplay : '';
}

// ===== Cadastro: render =====
function updateCadSummary(){
  const sum = $('#cadSummary'); if(!sum) return;
  sum.textContent = `📦 Ver cadastro (${materials.length} itens)`;
}

function renderMaterialTable(){
  const tbody = $('#material-table tbody'); if(!tbody) return;
  tbody.innerHTML = '';
  materials.forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.code || ''}</td>
      <td>${m.name || ''}</td>
      <td class="ppm">${displayPPM(m)}</td>
      <td class="center">
        <button class="btn outline" data-edit="${m.id}">Editar</button>
        <button class="btn danger"  data-del="${m.id}">Excluir</button>
      </td>`;
    tbody.appendChild(tr);
  });

  // editar
  tbody.querySelectorAll('button[data-edit]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const m = getMaterialById(btn.getAttribute('data-edit')); if(!m) return;
      $('#matCodigo').value = m.code || '';
      $('#matName').value   = m.name || '';
      $('#matPpm').value    = displayPPM(m);
      $('#material-form').dataset.editing = m.id;
      $('#material-form').querySelector('button[type="submit"]').textContent = 'Salvar';
    });
  });

  // excluir 1
  tbody.querySelectorAll('button[data-del]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id = btn.getAttribute('data-del');
      materials = materials.filter(x=>x.id!==id);
      saveMaterials(materials);
      renderMaterialTable(); renderMaterialSelects(); renderFardosTotal(); updateCadSummary();
      if(materials.length===0){ const dt=$('#cadTable'); if(dt && dt.open) dt.open=false; }
    });
  });

  updateCadSummary();
}

function renderMaterialSelects(){
  const sels = [$('#selMaterial'), $('#selMaterialFardo')].filter(Boolean);
  const sorted = [...materials].sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')));
  sels.forEach(sel=>{
    sel.innerHTML = '';
    sorted.forEach(m=>{
      const opt = document.createElement('option');
      opt.value = m.id;
      // Select com Código + Descrição + Peso (peso é SEMPRE ppmDisplay)
      opt.textContent = `${m.code ? m.code + ' – ' : ''}${m.name || ''} — ${displayPPM(m)} kg/m`;
      sel.appendChild(opt);
    });
  });
}

// ===== Cadastro: form + import =====
function setupMaterialForm(){
  const form = $('#material-form'); if(!form) return;

  form.addEventListener('submit',e=>{
    e.preventDefault();
    const code = $('#matCodigo').value.trim();
    const name = $('#matName').value.trim();
    const ppmDisplay = $('#matPpm').value.trim(); // exibir exatamente como digitado
    const ppm = parseBR_strict(ppmDisplay);       // número só para cálculo

    if(!name){ alert('Informe a descrição.'); return; }
    if(!(ppm>0)){ alert('Informe um peso por metro maior que zero.'); return; }

    const editingId = form.dataset.editing;
    if(editingId){
      const i = materials.findIndex(m=>m.id===editingId);
      if(i>=0){
        materials[i].code=code; materials[i].name=name;
        materials[i].ppm=ppm; materials[i].ppmDisplay=ppmDisplay; materials[i].source='manual';
      }
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent='Adicionar';
    }else{
      materials.unshift({ id:crypto.randomUUID(), code, name, ppm, ppmDisplay, source:'manual' });
    }
    saveMaterials(materials);
    form.reset();
    renderMaterialTable(); renderMaterialSelects(); updateCadSummary();
  });

  $('#btnClear')?.addEventListener('click',()=>{
    form.reset(); delete form.dataset.editing;
    form.querySelector('button[type="submit"]').textContent='Adicionar';
  });

  // IMPORT EXCEL
  $('#btnImportExcel')?.addEventListener('click',()=>{
    const file = $('#fileExcel')?.files?.[0];
    if(!file){ alert('Selecione um arquivo .xlsx'); return; }
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' });
        if(!rows.length){ alert('Planilha vazia.'); return; }

        const header = rows[0].map(h=>normalizeHeader(h));
        let idxCod=-1, idxDesc=-1, idxPpm=-1;
        header.forEach((h,i)=>{
          if(h.includes('COD')) idxCod=i;
          if(h.includes('DESCR')) idxDesc=i;
          if(h.includes('PESO') && h.includes('METRO')) idxPpm=i;
        });
        let start=1;
        if(idxDesc===-1 || idxPpm===-1){ idxCod=0; idxDesc=1; idxPpm=2; start=0; }

        const imported=[];
        for(let r=start;r<rows.length;r++){
          const row=rows[r]; if(!row || row.length===0) continue;
          const code = String(row[idxCod]||'').trim();
          const name = String(row[idxDesc]||'').trim();
          const ppmRaw = String(row[idxPpm]||'').trim();
          if(!name || !ppmRaw) continue;
          const ppm = parseBR_strict(ppmRaw); if(!(ppm>0)) continue;
          imported.push({ id:crypto.randomUUID(), code, name, ppm, ppmDisplay: ppmRaw, source:'excel' });
        }
        if(!imported.length){ alert('Nenhuma linha válida encontrada.'); return; }

        materials = [...imported, ...materials];
        saveMaterials(materials);
        renderMaterialTable(); renderMaterialSelects(); updateCadSummary();

        // fecha import e listagem
        const imp = $('#importArea'); if(imp && imp.open) imp.open=false;
        const list = $('#cadTable'); if(list && list.open) list.open=false;

        alert(`Importados ${imported.length} materiais.`);
      }catch(err){
        console.error(err); alert('Falha ao ler o Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Export JSON
  $('#btnExportJSON')?.addEventListener('click',()=>{
    const blob = new Blob([JSON.stringify(materials,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='materiais.json'; a.click(); URL.revokeObjectURL(url);
  });

  // EXCLUIR TUDO
  $('#btnExcluirTudo')?.addEventListener('click',()=>{
    if(!confirm('Excluir TODOS os materiais?')) return;
    if(!confirm('Confirmar exclusão total?')) return;
    materials = [];
    saveMaterials(materials);
    renderMaterialTable(); renderMaterialSelects(); renderFardosTotal(); updateCadSummary();
  });
}

// ===== Cálculo Rápido =====
function calcUnico(){
  const m = getMaterialById($('#selMaterial')?.value);
  if(!m){ alert('Selecione um material.'); return; }
  const comp  = parseBR_strict($('#inComprimento').value);
  const pecas = Math.max(0, Math.floor(parseBR_strict($('#inPecas').value)));
  const pesoComp  = comp * m.ppm;
  const pesoTotal = pesoComp * pecas;
  $('#ppmView').textContent = `${displayPPM(m)} kg/m`;
  $('#pesoComprimentoView').textContent = `${fmtBR3(pesoComp)} kg`;
  $('#pesoTotalView').textContent = `${fmtBR3(pesoTotal)} kg`;
}
function setupCalcUnico(){
  $('#btnCalcUnico')?.addEventListener('click', calcUnico);
  $('#selMaterial')?.addEventListener('change', ()=>{
    if($('#inComprimento').value || $('#inPecas').value) calcUnico();
    else{
      const m = getMaterialById($('#selMaterial').value);
      $('#ppmView').textContent = m ? `${displayPPM(m)} kg/m` : '—';
      $('#pesoComprimentoView').textContent = '—';
      $('#pesoTotalView').textContent = '—';
    }
  });
}

// ===== Fardos =====
function makeFardoRow(i){
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td>${i+1}</td>
    <td><input type="text" class="f-comp" placeholder="Ex.: 12,000"></td>
    <td><input type="number" step="1" min="0" class="f-pecas" placeholder="Ex.: 5"></td>
    <td class="f-peso">0,000</td>`;
  return tr;
}
function renderFardosRows(qtd){
  const tbody = $('#fardos-table tbody'); tbody.innerHTML='';
  for(let i=0;i<qtd;i++) tbody.appendChild(makeFardoRow(i));
  tbody.querySelectorAll('input').forEach(inp=>inp.addEventListener('input', calcFardos));
  renderFardosTotal();
}
function calcFardos(){
  const mat = getMaterialById($('#selMaterialFardo')?.value); if(!mat) return;
  $$('#fardos-table tbody tr').forEach(row=>{
    const comp = parseBR_strict(row.querySelector('.f-comp').value);
    const pecas= Math.max(0, Math.floor(parseBR_strict(row.querySelector('.f-pecas').value)));
    const peso = comp * mat.ppm * pecas;
    row.querySelector('.f-peso').textContent = fmtBR3(peso);
  });
  renderFardosTotal();
}
function renderFardosTotal(){
  const tds = $$('#fardos-table tbody .f-peso');
  const total = tds.reduce((acc,td)=>acc+parseBR_strict(td.textContent),0);
  $('#fardosTotal').textContent = fmtBR3(total);
  $('#totalHighlight').textContent = `Total geral: ${fmtBR3(total)} kg`;
}
function setupFardos(){
  $('#btnGerarFardos')?.addEventListener('click',()=>{
    const qtd = Math.max(0, Math.floor(parseBR_strict($('#inQtdFardos').value)));
    renderFardosRows(qtd);
  });
  $('#btnLimparFardos')?.addEventListener('click',()=>{
    $('#fardos-table tbody').innerHTML=''; renderFardosTotal();
  });
  $('#selMaterialFardo')?.addEventListener('change', ()=>calcFardos());
}

// ===== Busca por código =====
function setupCodeSearch(){
  function selectByCode(code){
    if(!code) return;
    const m = materials.find(x=>String(x.code).toLowerCase()===String(code).toLowerCase());
    if(!m) return;
    if($('#selMaterial'))      $('#selMaterial').value = m.id;
    if($('#selMaterialFardo')) $('#selMaterialFardo').value = m.id;
  }
  $('#searchCodigo')?.addEventListener('input',e=>selectByCode(e.target.value.trim()));
  $('#searchCodigoFardos')?.addEventListener('input',e=>selectByCode(e.target.value.trim()));
}

// ===== Init =====
function init(){
  renderMaterialTable(); renderMaterialSelects(); updateCadSummary();
  setupMaterialForm(); setupCalcUnico(); setupFardos(); setupCodeSearch();

  const dt = $('#cadTable'); if(dt) dt.open = false; // oculta listagem por padrão
  const m0 = getMaterialById($('#selMaterial')?.value);
  if(m0) $('#ppmView').textContent = `${displayPPM(m0)} kg/m`;
}
document.addEventListener('DOMContentLoaded', init);
