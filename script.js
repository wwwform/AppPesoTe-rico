// Storage key
const LS_KEY = 'materiais_ppm_v2';

// Load / Save
function loadMaterials() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveMaterials(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }

let materials = loadMaterials();

// Utils
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function parseBR_strict(s) {
  if (s === null || s === undefined) return 0;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  s = String(s).trim();
  if (!s) return 0;
  // remove non-digit except . and ,
  s = s.replace(/[^\d.,-]/g, '');
  // remove thousand points, then replace last comma by decimal
  // simple approach: remove dots, replace comma by dot
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function fmtBR(n, dec = 3) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getMaterialById(id) {
  return materials.find(m => m.id === id) || null;
}
function normalizeHeader(h) {
  return String(h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// Render table
function renderMaterialTable() {
  const tbody = $('#material-table tbody');
  tbody.innerHTML = '';
  materials.forEach(m => {
    const tr = document.createElement('tr');
    const displayPpm = m.ppmDisplay !== undefined ? m.ppmDisplay : (m.ppm !== undefined ? fmtBR(m.ppm) : '');
    tr.innerHTML = `
      <td>${m.code || ''}</td>
      <td>${m.name}</td>
      <td>${displayPpm}</td>
      <td class="center">
        <button class="btn outline" data-edit="${m.id}">Editar</button>
        <button class="btn danger" data-del="${m.id}">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = getMaterialById(btn.getAttribute('data-edit'));
      if (!m) return;
      $('#matCodigo').value = m.code || '';
      $('#matName').value = m.name;
      $('#matPpm').value = m.ppmDisplay !== undefined ? m.ppmDisplay : (m.ppm !== undefined ? fmtBR(m.ppm) : '');
      $('#material-form').dataset.editing = m.id;
      $('#material-form').querySelector('button[type="submit"]').textContent = 'Salvar';
    });
  });

  tbody.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del');
      materials = materials.filter(x => x.id !== id);
      saveMaterials(materials);
      renderMaterialTable();
      renderMaterialSelects();
      renderFardosTotal();
    });
  });
}

// Render selects
function renderMaterialSelects() {
  const sels = [$('#selMaterial'), $('#selMaterialFardo')].filter(Boolean);
  const sorted = [...materials].sort((a,b) => String(a.code||'').localeCompare(String(b.code||'')));
  sels.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    sorted.forEach(m => {
      const opt = document.createElement('option');
      const displayPpm = m.ppmDisplay !== undefined ? m.ppmDisplay : (m.ppm !== undefined ? fmtBR(m.ppm) : '');
      opt.value = m.id;
      opt.textContent = `${m.code ? m.code + ' – ' : ''}${m.name} — ${displayPpm} kg/m`;
      sel.appendChild(opt);
    });
  });
}

// Setup form + import
function setupMaterialForm() {
  const form = $('#material-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#matCodigo').value.trim();
    const name = $('#matName').value.trim();
    const ppmDisplay = $('#matPpm').value.trim();
    const ppm = parseBR_strict(ppmDisplay);

    if (!name) { alert('Informe a descrição.'); return; }
    if (!(ppm > 0)) { alert('Informe um peso por metro maior que zero.'); return; }

    const editingId = form.dataset.editing;
    if (editingId) {
      const idx = materials.findIndex(m => m.id === editingId);
      if (idx >= 0) {
        materials[idx].code = code;
        materials[idx].name = name;
        materials[idx].ppm = ppm;
        materials[idx].ppmDisplay = ppmDisplay || fmtBR(ppm);
      }
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent = 'Adicionar';
    } else {
      materials.unshift({ id: crypto.randomUUID(), code, name, ppm, ppmDisplay: ppmDisplay || fmtBR(ppm) });
    }
    saveMaterials(materials);
    form.reset();
    renderMaterialTable();
    renderMaterialSelects();
  });

  $('#btnClear')?.addEventListener('click', () => {
    form.reset(); delete form.dataset.editing;
    form.querySelector('button[type="submit"]').textContent = 'Adicionar';
  });

  // Import Excel
  $('#btnImportExcel')?.addEventListener('click', () => {
    const file = $('#fileExcel')?.files?.[0];
    if (!file) { alert('Selecione um arquivo .xlsx'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' });
        if (!rows.length) { alert('Planilha vazia.'); return; }

        const header = rows[0].map(h => normalizeHeader(h));
        let idxCod=-1, idxDesc=-1, idxPpm=-1;
        header.forEach((h,i)=>{
          if (h.includes('COD')) idxCod=i;
          if (h.includes('DESCR')) idxDesc=i;
          if (h.includes('PESO') && h.includes('METRO')) idxPpm=i;
        });
        let start = 1;
        if (idxDesc===-1 || idxPpm===-1) { idxCod=0; idxDesc=1; idxPpm=2; start=0; }

        const imported = [];
        for (let r=start; r<rows.length; r++) {
          const row = rows[r];
          if (!row || row.length===0) continue;
          const code = String(row[idxCod]||'').trim();
          const name = String(row[idxDesc]||'').trim();
          const ppmRaw = String(row[idxPpm]||'').trim();
          if (!name || !ppmRaw) continue;
          const ppm = parseBR_strict(ppmRaw);
          if (!(ppm>0)) continue;
          // IMPORTANT: store ppmDisplay exactly as in cell
          imported.push({ id: crypto.randomUUID(), code, name, ppm, ppmDisplay: ppmRaw });
        }

        if (!imported.length) { alert('Nenhuma linha válida encontrada.'); return; }

        materials = [...imported, ...materials];
        saveMaterials(materials);
        renderMaterialTable();
        renderMaterialSelects();

        // close import details for a clean screen
        const details = $('#importArea'); if (details && details.open) details.open = false;

        alert(`Importados ${imported.length} materiais com sucesso.`);
      } catch (err) {
        console.error(err);
        alert('Falha ao ler o Excel. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Export JSON
  $('#btnExportJSON')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(materials, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'materiais.json'; a.click(); URL.revokeObjectURL(url);
  });
}

// Calculations
function calcUnico() {
  const m = getMaterialById($('#selMaterial')?.value);
  if (!m) { alert('Cadastre/seleciona um material.'); return; }
  const comp = parseBR_strict($('#inComprimento').value);
  const pecas = Math.max(0, Math.floor(parseBR_strict($('#inPecas').value)));
  const pesoComp = comp * m.ppm;
  const pesoTotal = pesoComp * pecas;
  $('#ppmView').textContent = `${m.ppmDisplay !== undefined ? m.ppmDisplay : fmtBR(m.ppm)} kg/m`;
  $('#pesoComprimentoView').textContent = `${fmtBR(pesoComp)} kg`;
  $('#pesoTotalView').textContent = `${fmtBR(pesoTotal)} kg`;
}
function setupCalcUnico() {
  $('#btnCalcUnico')?.addEventListener('click', calcUnico);
  $('#selMaterial')?.addEventListener('change', () => {
    if ($('#inComprimento').value || $('#inPecas').value) calcUnico();
    else {
      const m = getMaterialById($('#selMaterial').value);
      $('#ppmView').textContent = m ? `${m.ppmDisplay !== undefined ? m.ppmDisplay : fmtBR(m.ppm)} kg/m` : '—';
      $('#pesoComprimentoView').textContent = '—';
      $('#pesoTotalView').textContent = '—';
    }
  });
}

// Fardos
function makeFardoRow(i) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${i+1}</td>
    <td><input type="text" class="f-comp" placeholder="Ex.: 12,000"></td>
    <td><input type="number" step="1" min="0" class="f-pecas" placeholder="Ex.: 5"></td>
    <td class="f-peso">0,000</td>
  `;
  return tr;
}
function renderFardosRows(qtd) {
  const tbody = $('#fardos-table tbody');
  tbody.innerHTML = '';
  for (let i=0;i<qtd;i++) tbody.appendChild(makeFardoRow(i));
  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calcFardos));
  renderFardosTotal();
}
function calcFardos() {
  const mat = getMaterialById($('#selMaterialFardo')?.value);
  if (!mat) return;
  $$('#fardos-table tbody tr').forEach(row => {
    const comp = parseBR_strict(row.querySelector('.f-comp').value);
    const pecas = Math.max(0, Math.floor(parseBR_strict(row.querySelector('.f-pecas').value)));
    const peso = comp * mat.ppm * pecas;
    row.querySelector('.f-peso').textContent = fmtBR(peso);
  });
  renderFardosTotal();
}
function renderFardosTotal() {
  const tds = $$('#fardos-table tbody .f-peso');
  const total = tds.reduce((acc, td) => acc + parseBR_strict(td.textContent), 0);
  $('#fardosTotal').textContent = fmtBR(total);
  $('#totalHighlight').textContent = `Total geral: ${fmtBR(total)} kg`;
}
function setupFardos() {
  $('#btnGerarFardos')?.addEventListener('click', () => {
    const qtd = Math.max(0, Math.floor(parseBR_strict($('#inQtdFardos').value)));
    renderFardosRows(qtd);
  });
  $('#btnLimparFardos')?.addEventListener('click', () => {
    $('#fardos-table tbody').innerHTML = '';
    renderFardosTotal();
  });
  $('#selMaterialFardo')?.addEventListener('change', () => calcFardos());
}

// Search by code
function setupCodeSearch() {
  function selectByCode(code) {
    if (!code) return;
    const m = materials.find(x => String(x.code).toLowerCase() === String(code).toLowerCase());
    if (!m) return;
    if ($('#selMaterial')) $('#selMaterial').value = m.id;
    if ($('#selMaterialFardo')) $('#selMaterialFardo').value = m.id;
  }
  $('#searchCodigo')?.addEventListener('input', e => selectByCode(e.target.value.trim()));
  $('#searchCodigoFardos')?.addEventListener('input', e => selectByCode(e.target.value.trim()));
}

// Init
function init() {
  if (materials.length === 0) {
    materials = [
      { id: crypto.randomUUID(), code: '0001', name: 'Barra 1\" Aço 1020', ppm: 2.000, ppmDisplay: '2,000' },
      { id: crypto.randomUUID(), code: '0002', name: 'Tubo 3/4\" Inox', ppm: 1.350, ppmDisplay: '1,350' },
      { id: crypto.randomUUID(), code: '0003', name: 'Perfil U 100', ppm: 8.750, ppmDisplay: '8,750' },
    ];
    saveMaterials(materials);
  }

  renderMaterialTable();
  renderMaterialSelects();
  setupMaterialForm();
  setupCalcUnico();
  setupFardos();
  setupCodeSearch();

  const m0 = getMaterialById($('#selMaterial')?.value);
  if (m0) $('#ppmView').textContent = `${m0.ppmDisplay !== undefined ? m0.ppmDisplay : fmtBR(m0.ppm)} kg/m`;
}
document.addEventListener('DOMContentLoaded', init);
