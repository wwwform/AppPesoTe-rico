// ====== Storage ======
const LS_KEY = 'materiais_ppm_v1';

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
if (materials.length === 0) {
  // alguns exemplos iniciais
  materials = [
    { id: crypto.randomUUID(), name: 'Barra 1" Aço 1020', ppm: 2.0000 },
    { id: crypto.randomUUID(), name: 'Tubo 3/4" Inox', ppm: 1.3500 },
    { id: crypto.randomUUID(), name: 'Perfil U 100', ppm: 8.7500 },
  ];
  saveMaterials(materials);
}

// ====== Util ======
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function toNumber(value) {
  const v = String(value).replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n, dec = 4) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getMaterialById(id) {
  return materials.find(m => m.id === id) || null;
}

// ====== UI: Tabelas/Selects ======
function renderMaterialTable() {
  const tbody = $('#material-table tbody');
  tbody.innerHTML = '';
  materials.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${fmt(m.ppm, 4)}</td>
      <td class="center">
        <button class="btn" data-edit="${m.id}">Editar</button>
        <button class="btn danger" data-del="${m.id}">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // ações
  tbody.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit');
      const m = getMaterialById(id);
      if (!m) return;
      $('#matName').value = m.name;
      $('#matPpm').value = String(m.ppm);
      $('#material-form').dataset.editing = id; // modo edição
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
      renderFardosTotal(); // recalcula se necessário
    });
  });
}

function renderMaterialSelects() {
  const sels = [$('#selMaterial'), $('#selMaterialFardo')];
  sels.forEach(sel => {
    sel.innerHTML = '';
    materials.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} — ${fmt(m.ppm, 4)} kg/m`;
      sel.appendChild(opt);
    });
  });
}

// ====== Cadastro: eventos ======
function setupMaterialForm() {
  const form = $('#material-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#matName').value.trim();
    const ppm = toNumber($('#matPpm').value);

    if (!name) { alert('Informe o nome do material.'); return; }
    if (ppm <= 0) { alert('Informe um peso por metro maior que zero.'); return; }

    const editingId = form.dataset.editing;
    if (editingId) {
      // salvar edição
      const idx = materials.findIndex(m => m.id === editingId);
      if (idx >= 0) {
        materials[idx].name = name;
        materials[idx].ppm = ppm;
      }
      delete form.dataset.editing;
      form.querySelector('button[type="submit"]').textContent = 'Adicionar';
    } else {
      // novo
      materials.unshift({ id: crypto.randomUUID(), name, ppm });
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
}

// ====== Cálculo Rápido ======
function calcUnico() {
  const selId = $('#selMaterial').value;
  const m = getMaterialById(selId);
  if (!m) { alert('Cadastre/seleciona um material.'); return; }

  const comp = toNumber($('#inComprimento').value);
  const pecas = Math.floor(toNumber($('#inPecas').value));

  const pesoComp = comp * m.ppm;          // 1) comprimento * ppm
  const pesoTotal = pesoComp * pecas;     // 2) * peças

  $('#ppmView').textContent = `${fmt(m.ppm, 4)} kg/m`;
  $('#pesoComprimentoView').textContent = `${fmt(pesoComp, 4)} kg`;
  $('#pesoTotalView').textContent = `${fmt(pesoTotal, 4)} kg`;
}

function setupCalcUnico() {
  $('#btnCalcUnico').addEventListener('click', calcUnico);
  // recalcula ao trocar material (se já houver valores)
  $('#selMaterial').addEventListener('change', () => {
    if ($('#inComprimento').value || $('#inPecas').value) calcUnico();
    else {
      const m = getMaterialById($('#selMaterial').value);
      $('#ppmView').textContent = m ? `${fmt(m.ppm,4)} kg/m` : '—';
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
    <td><input type="number" step="0.0001" min="0" class="f-comp" placeholder="Ex.: 12"></td>
    <td><input type="number" step="1" min="0" class="f-pecas" placeholder="Ex.: 5"></td>
    <td class="f-peso">0,0000</td>
  `;
  return tr;
}

function renderFardosRows(qtd) {
  const tbody = $('#fardos-table tbody');
  tbody.innerHTML = '';
  for (let i = 0; i < qtd; i++) {
    tbody.appendChild(makeFardoRow(i));
  }
  // bind recalculo
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', calcFardos);
  });
  renderFardosTotal();
}

function calcFardos() {
  const mat = getMaterialById($('#selMaterialFardo').value);
  if (!mat) return;

  const rows = $$('#fardos-table tbody tr');
  rows.forEach(row => {
    const comp = toNumber(row.querySelector('.f-comp').value);
    const pecas = Math.floor(toNumber(row.querySelector('.f-pecas').value));
    const peso = comp * mat.ppm * pecas; // mesma regra do cálculo único
    row.querySelector('.f-peso').textContent = fmt(peso, 4);
  });
  renderFardosTotal();
}

function renderFardosTotal() {
  const tds = $$('#fardos-table tbody .f-peso');
  const total = tds.reduce((acc, td) => acc + toNumber(td.textContent), 0);
  $('#fardosTotal').textContent = fmt(total, 4);
}

function setupFardos() {
  $('#btnGerarFardos').addEventListener('click', () => {
    const qtd = Math.max(0, Math.floor(toNumber($('#inQtdFardos').value)));
    renderFardosRows(qtd);
  });
  $('#btnLimparFardos').addEventListener('click', () => {
    $('#fardos-table tbody').innerHTML = '';
    renderFardosTotal();
  });
  $('#selMaterialFardo').addEventListener('change', () => {
    calcFardos(); // recalcula com novo ppm
  });
}

// ====== Init ======
function init() {
  renderMaterialTable();
  renderMaterialSelects();
  setupMaterialForm();
  setupCalcUnico();
  setupFardos();

  // exibe ppm atual na área rápida
  const m0 = getMaterialById($('#selMaterial').value);
  if (m0) $('#ppmView').textContent = `${fmt(m0.ppm,4)} kg/m`;
}

document.addEventListener('DOMContentLoaded', init);
