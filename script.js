// ====== Storage ======
const LS_KEY = 'materiais_ppm_v2';

function loadMaterials() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveMaterials(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

// ====== Estado ======
let materials = loadMaterials();

// ====== Util ======
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/** Parser robusto: entende BR e US automaticamente.
 *  Exemplos:
 *  "1,800" => 1.8
 *  "1.800,000" => 1800
 *  "1.800" => 1.8
 *  "1800" => 1800
 */
function parseBRDecimal(str) {
  if (str === null || str === undefined) return 0;
  let s = String(str).trim();

  // BR com milhar e decimal: ###.###,###
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
    return Number(s);
  }
  // BR com vírgula decimal: ###,###
  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(',', '.'));
  }
  // US com ponto decimal: ###.###
  if (/^\d+\.\d+$/.test(s)) {
    return Number(s);
  }
  // Inteiro puro
  if (/^\d+$/.test(s)) {
    return Number(s);
  }
  // fallback: troca vírgula por ponto
  s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtBR(n, dec = 3) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function getMaterialById(id) {
  return materials.find(m => m.id === id) || null;
}
function normalizeHeader(h) {
  if (!h) return '';
  return String(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// ====== UI: Tabelas/Selects ======
function renderMaterialTable() {
  const tbody = $('#material-table tbody');
  tbody.innerHTML = '';
  materials.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.code || ''}</td>
      <td>${m.name}</td>
      <td>${fmtBR(m.ppm)}</td>
      <td class="center">
        <button class="btn outline" data-edit="${m.id}">Editar</button>
        <button class="btn danger" data-del="${m.id}">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit');
      const m = getMaterialById(id);
      if (!m) return;
      $('#matCodigo').value = m.code || '';
      $('#matName').value = m.name;
      $('#matPpm').value = fmtBR(m.ppm);
      $('#material-form').dataset.editing = id;
      $('#material-form').querySelector('button[type="submit"]').textContent = 'Salvar';
    });
  });

  tbody.querySelectorAll('button[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del');
      materials = materials.filter(m => m.id !== id);
      saveMaterials(materials);
      renderMaterialTable();
      renderMaterialSelects();
      renderFardosTotal();
    });
  });
}

function renderMaterialSelects() {
  const sels = [$('#selMaterial'), $('#selMaterialFardo')];
  sels.forEach(sel => {
    sel.innerHTML = '';
    // ordena por código para facilitar a busca
    const arr = [...materials].sort((a,b) => String(a.code).localeCompare(String(b.code)));
    arr.forEach(m => {
      const opt = document.createElement('option');
      const label = `${m.code ? (m.code + ' – ') : ''}${m.name} — ${fmtBR(m.ppm)} kg/m`;
      opt.value = m.id;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  });
}

// ====== Cadastro manual + Import ======
function setupMaterialForm() {
  const form = $('#material-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#matCodigo').value.trim();
    const name = $('#matName').value.trim();
    const ppm = parseBRDecimal($('#matPpm').value);

    if (!name) { alert('Informe a descrição.'); return; }
    if (ppm <= 0) { alert('Informe um peso por metro maior que zero.'); return; }

    const editingId = form.dataset.editing;
    if (editingId) {
      const idx = materials.findIndex(m => m.id === editingId);
      if (idx >= 0) {
        materials[idx].code = code || '';
        materials[idx].name = name;
        materials[idx].ppm = ppm;
      }
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent = 'Adicionar';
    } else {
      materials.unshift({ id: crypto.randomUUID(), code: code || '', name, ppm });
    }

    saveMaterials(materials);
    form.reset();
    renderMaterialTable();
    renderMaterialSelects();
  });

  $('#btnClear').addEventListener('click', () => {
    form.reset();
    delete form.dataset.editing;
    form.querySelector('button[type="submit"]').textContent = 'Adicionar';
  });

  // Import Excel
  $('#btnImportExcel').addEventListener('click', () => {
    const file = $('#fileExcel').files[0];
    if (!file) { alert('Selecione um arquivo .xlsx'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        // raw:false traz texto formatado; o parser acima lida com BR e US
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

        if (!rows.length) { alert('Planilha vazia.'); return; }

        // detectar cabeçalho
        const header = rows[0].map(h => normalizeHeader(h));
        let idxCod = -1, idxDesc = -1, idxPpm = -1;

        header.forEach((h, i) => {
          if (h.includes('CODIGO') || h.includes('CÓDIGO')) idxCod = i;
          if (h.includes('DESCRICAO') || h.includes('DESCRIÇÃO') || h === 'DESCR') idxDesc = i;
          if (h.includes('PESO') && h.includes('METRO')) idxPpm = i;
        });

        let startRow = 1;
        if (idxDesc === -1 || idxPpm === -1) {
          idxCod = 0; idxDesc = 1; idxPpm = 2;
          startRow = 0;
        }

        const imported = [];
        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          const code = row[idxCod] != null ? String(row[idxCod]).trim() : '';
          const name = row[idxDesc] != null ? String(row[idxDesc]).trim() : '';
          const ppmRaw = row[idxPpm] != null ? String(row[idxPpm]).trim() : '';
          if (!name || !ppmRaw) continue;
          const ppm = parseBRDecimal(ppmRaw);
          if (!(ppm > 0)) continue;
          imported.push({ id: crypto.randomUUID(), code, name, ppm });
        }

        if (!imported.length) { alert('Nenhuma linha válida encontrada.'); return; }

        materials = [...imported, ...materials];
        saveMaterials(materials);
        renderMaterialTable();
        renderMaterialSelects();

        // fecha a área de importação para limpar a tela
        const details = $('#importArea');
        if (details && details.open) details.open = false;

        alert(`Importados ${imported.length} materiais com sucesso.`);
      } catch (err) {
        console.error(err);
        alert('Falha ao ler o Excel. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Export JSON (apoio)
  $('#btnExportJSON').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(materials, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'materiais.json'; a.click();
    URL.revokeObjectURL(url);
  });
}

// ====== Cálculo Rápido ======
function calcUnico() {
  const selId = $('#selMaterial').value;
  const m = getMaterialById(selId);
  if (!m) { alert('Cadastre/seleciona um material.'); return; }

  const comp = parseBRDecimal($('#inComprimento').value);
  const pecas = Math.max(0, Math.floor(parseBRDecimal($('#inPecas').value)));

  const pesoComp = comp * m.ppm;
  const pesoTotal = pesoComp * pecas;

  $('#ppmView').textContent = `${fmtBR(m.ppm)} kg/m`;
  $('#pesoComprimentoView').textContent = `${fmtBR(pesoComp)} kg`;
  $('#pesoTotalView').textContent = `${fmtBR(pesoTotal)} kg`;
}

function setupCalcUnico() {
  $('#btnCalcUnico').addEventListener('click', calcUnico);
  $('#selMaterial').addEventListener('change', () => {
    if ($('#inComprimento').value || $('#inPecas').value) calcUnico();
    else {
      const m = getMaterialById($('#selMaterial').value);
      $('#ppmView').textContent = m ? `${fmtBR(m.ppm)} kg/m` : '—';
      $('#pesoComprimentoView').textContent = '—';
      $('#pesoTotalView').textContent = '—';
    }
  });
}

// ====== Fardos ======
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
  for (let i = 0; i < qtd; i++) tbody.appendChild(makeFardoRow(i));
  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calcFardos));
  renderFardosTotal();
}
function calcFardos() {
  const mat = getMaterialById($('#selMaterialFardo').value);
  if (!mat) return;
  $$('#fardos-table tbody tr').forEach(row => {
    const comp = parseBRDecimal(row.querySelector('.f-comp').value);
    const pecas = Math.max(0, Math.floor(parseBRDecimal(row.querySelector('.f-pecas').value)));
    const peso = comp * mat.ppm * pecas;
    row.querySelector('.f-peso').textContent = fmtBR(peso);
  });
  renderFardosTotal();
}
function renderFardosTotal() {
  const tds = $$('#fardos-table tbody .f-peso');
  const total = tds.reduce((acc, td) => acc + parseBRDecimal(td.textContent), 0);
  $('#fardosTotal').textContent = fmtBR(total);
  $('#totalHighlight').textContent = `Total geral: ${fmtBR(total)} kg`;
}
function setupFardos() {
  $('#btnGerarFardos').addEventListener('click', () => {
    const qtd = Math.max(0, Math.floor(parseBRDecimal($('#inQtdFardos').value)));
    renderFardosRows(qtd);
  });
  $('#btnLimparFardos').addEventListener('click', () => {
    $('#fardos-table tbody').innerHTML = '';
    renderFardosTotal();
  });
  $('#selMaterialFardo').addEventListener('change', () => calcFardos());
}

// ====== Busca por CÓDIGO ======
function setupCodeSearch() {
  const input1 = $('#searchCodigo');
  const input2 = $('#searchCodigoFardos');

  function selectByCode(code) {
    if (!code) return;
    const m = materials.find(x => String(x.code).toLowerCase() === String(code).toLowerCase());
    if (!m) return;
    if ($('#selMaterial')) $('#selMaterial').value = m.id;
    if ($('#selMaterialFardo')) $('#selMaterialFardo').value = m.id;
  }

  if (input1) input1.addEventListener('input', e => selectByCode(e.target.value.trim()));
  if (input2) input2.addEventListener('input', e => selectByCode(e.target.value.trim()));
}

// ====== Init ======
function init() {
  if (materials.length === 0) {
    materials = [
      { id: crypto.randomUUID(), code: '0001', name: 'Barra 1" Aço 1020', ppm: 2.000 },
      { id: crypto.randomUUID(), code: '0002', name: 'Tubo 3/4" Inox', ppm: 1.350 },
      { id: crypto.randomUUID(), code: '0003', name: 'Perfil U 100', ppm: 8.750 },
    ];
    saveMaterials(materials);
  }

  renderMaterialTable();
  renderMaterialSelects();
  setupMaterialForm();
  setupCalcUnico();
  setupFardos();
  setupCodeSearch();

  const m0 = getMaterialById($('#selMaterial').value);
  if (m0) $('#ppmView').textContent = `${fmtBR(m0.ppm)} kg/m`;
}
document.addEventListener('DOMContentLoaded', init);
