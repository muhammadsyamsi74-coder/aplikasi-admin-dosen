// js/modules/master.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

export async function initMaster() {
  setupSubTabs();
  setupFormListeners();
  await loadMataKuliah();
  await loadMahasiswa();
  await loadKRSSelectOptions();
}

// 1. EFEK ALIH SUB-TAB (MK / MHS / KRS)
function setupSubTabs() {
  const btnMK = document.getElementById('tabBtnMK');
  const btnMhs = document.getElementById('tabBtnMhs');
  const btnKRS = document.getElementById('tabBtnKRS');

  const secMK = document.getElementById('sectionMataKuliah');
  const secMhs = document.getElementById('sectionMahasiswa');
  const secKRS = document.getElementById('sectionKRS');

  btnMK?.addEventListener('click', () => {
    setActiveTab(btnMK, secMK);
    setInactiveTab(btnMhs, secMhs);
    setInactiveTab(btnKRS, secKRS);
  });

  btnMhs?.addEventListener('click', () => {
    setActiveTab(btnMhs, secMhs);
    setInactiveTab(btnMK, secMK);
    setInactiveTab(btnKRS, secKRS);
  });

  btnKRS?.addEventListener('click', () => {
    setActiveTab(btnKRS, secKRS);
    setInactiveTab(btnMK, secMK);
    setInactiveTab(btnMhs, secMhs);
  });
}

function setActiveTab(btn, sec) {
  btn.classList.add('bg-white', 'text-orange-600', 'shadow-sm');
  btn.classList.remove('text-slate-600');
  sec.classList.remove('hidden');
}

function setInactiveTab(btn, sec) {
  btn.classList.remove('bg-white', 'text-orange-600', 'shadow-sm');
  btn.classList.add('text-slate-600');
  sec.classList.add('hidden');
}

// 2. LOGIKA MASTER MATA KULIAH
async function loadMataKuliah() {
  const tableBody = document.getElementById('listMataKuliahTable');
  if (!tableBody) return;

  const { data, error } = await supabase.from('matakuliah').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }

  tableBody.innerHTML = '';
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic text-xs">Belum ada data mata kuliah.</td></tr>`;
    return;
  }

  data.forEach(mk => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-3">
        <div class="font-extrabold text-slate-800">${mk.nama_mk}</div>
        <div class="text-[10px] font-bold text-amber-600">${mk.kode_mk}</div>
      </td>
      <td class="p-3 font-semibold text-slate-600">${mk.kelas_mk}</td>
      <td class="p-3 font-bold text-slate-700">${mk.sks_mk} SKS</td>
      <td class="p-3 text-slate-500 text-[11px]">${mk.jadwal_mk}, ${mk.jam_mk || '-'}</td>
      <td class="p-3 text-center">
        <button class="btn-edit-mk bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-extrabold px-2 py-1 rounded-md mr-1" data-id="${mk.id}">Edit</button>
        <button class="btn-hapus-mk bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-extrabold px-2 py-1 rounded-md" data-id="${mk.id}">Hapus</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Attach Event Listener Edit & Hapus
  document.querySelectorAll('.btn-edit-mk').forEach(b => b.addEventListener('click', () => handleEditMK(b.dataset.id, data)));
  document.querySelectorAll('.btn-hapus-mk').forEach(b => b.addEventListener('click', () => handleHapusMK(b.dataset.id)));
}

// 3. LOGIKA MASTER MAHASISWA
async function loadMahasiswa() {
  const tableBody = document.getElementById('listMahasiswaTable');
  if (!tableBody) return;

  const { data, error } = await supabase.from('datamahasiswa').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }

  tableBody.innerHTML = '';
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic text-xs">Belum ada data mahasiswa.</td></tr>`;
    return;
  }

  data.forEach(mhs => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-3 font-mono font-extrabold text-teal-700">${mhs.npm_mahasiswa}</td>
      <td class="p-3 font-bold text-slate-800">${mhs.nama_mahasiswa}</td>
      <td class="p-3 text-slate-600">${mhs.no_whatsapp || '-'}</td>
      <td class="p-3 text-center">
        <button class="btn-edit-mhs bg-teal-100 hover:bg-teal-200 text-teal-800 text-[10px] font-extrabold px-2 py-1 rounded-md mr-1" data-id="${mhs.id}">Edit</button>
        <button class="btn-hapus-mhs bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-extrabold px-2 py-1 rounded-md" data-id="${mhs.id}">Hapus</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-mhs').forEach(b => b.addEventListener('click', () => handleEditMhs(b.dataset.id, data)));
  document.querySelectorAll('.btn-hapus-mhs').forEach(b => b.addEventListener('click', () => handleHapusMhs(b.dataset.id)));
}

// 4. EVENT LISTENERS FORM SIMPAN / EDIT
function setupFormListeners() {
  // Form MK
  const formMK = document.getElementById('formMataKuliah');
  formMK?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mk_id').value;
    const payload = {
      kode_mk: document.getElementById('mk_kode').value,
      nama_mk: document.getElementById('mk_nama').value,
      sks_mk: parseInt(document.getElementById('mk_sks').value),
      kelas_mk: document.getElementById('mk_kelas').value,
      semester_mk: document.getElementById('mk_semester').value,
      jadwal_mk: document.getElementById('mk_jadwal').value,
      jam_mk: document.getElementById('mk_jam').value,
    };

    if (id) {
      await supabase.from('matakuliah').update(payload).eq('id', id);
    } else {
      await supabase.from('matakuliah').insert([payload]);
    }

    formMK.reset();
    document.getElementById('mk_id').value = '';
    document.getElementById('btnBatalMK').classList.add('hidden');
    document.getElementById('formMKTitle').innerText = 'Tambah Mata Kuliah';
    await loadMataKuliah();
    await loadKRSSelectOptions();
    hideLoading();
  });

  // Form Mahasiswa
  const formMhs = document.getElementById('formMahasiswa');
  formMhs?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mhs_id').value;
    const payload = {
      npm_mahasiswa: document.getElementById('mhs_npm').value,
      nama_mahasiswa: document.getElementById('mhs_nama').value,
      email_mahasiswa: document.getElementById('mhs_email').value,
      no_whatsapp: document.getElementById('mhs_wa').value,
    };

    if (id) {
      await supabase.from('datamahasiswa').update(payload).eq('id', id);
    } else {
      await supabase.from('datamahasiswa').insert([payload]);
    }

    formMhs.reset();
    document.getElementById('mhs_id').value = '';
    document.getElementById('btnBatalMhs').classList.add('hidden');
    document.getElementById('formMhsTitle').innerText = 'Tambah Mahasiswa Baru';
    await loadMahasiswa();
    hideLoading();
  });

  // KRS Event
  const selectKRS = document.getElementById('selectKRSMataKuliah');
  selectKRS?.addEventListener('change', async () => {
    const idMK = selectKRS.value;
    const areaPlot = document.getElementById('areaPlottingKRS');
    if (!idMK) { areaPlot?.classList.add('hidden'); return; }
    areaPlot?.classList.remove('hidden');
    await renderKRSCheckboxes(idMK);
  });

  document.getElementById('btnSimpanKRS')?.addEventListener('click', savePlottingKRS);
}

// 5. HELPER HANDLERS (MK & MHS)
function handleEditMK(id, dataList) {
  const item = dataList.find(d => d.id === id);
  if (!item) return;
  document.getElementById('mk_id').value = item.id;
  document.getElementById('mk_kode').value = item.kode_mk;
  document.getElementById('mk_nama').value = item.nama_mk;
  document.getElementById('mk_sks').value = item.sks_mk;
  document.getElementById('mk_kelas').value = item.kelas_mk;
  document.getElementById('mk_semester').value = item.semester_mk;
  document.getElementById('mk_jadwal').value = item.jadwal_mk;
  document.getElementById('mk_jam').value = item.jam_mk || '';
  
  document.getElementById('btnBatalMK').classList.remove('hidden');
  document.getElementById('formMKTitle').innerText = 'Edit Mata Kuliah';
}

async function handleHapusMK(id) {
  if (confirm('Apakah Anda yakin ingin menghapus mata kuliah ini?')) {
    showLoading();
    await supabase.from('matakuliah').delete().eq('id', id);
    await loadMataKuliah();
    await loadKRSSelectOptions();
    hideLoading();
  }
}

function handleEditMhs(id, dataList) {
  const item = dataList.find(d => d.id === id);
  if (!item) return;
  document.getElementById('mhs_id').value = item.id;
  document.getElementById('mhs_npm').value = item.npm_mahasiswa;
  document.getElementById('mhs_nama').value = item.nama_mahasiswa;
  document.getElementById('mhs_email').value = item.email_mahasiswa || '';
  document.getElementById('mhs_wa').value = item.no_whatsapp || '';

  document.getElementById('btnBatalMhs').classList.remove('hidden');
  document.getElementById('formMhsTitle').innerText = 'Edit Data Mahasiswa';
}

async function handleHapusMhs(id) {
  if (confirm('Apakah Anda yakin ingin menghapus mahasiswa ini?')) {
    showLoading();
    await supabase.from('datamahasiswa').delete().eq('id', id);
    await loadMahasiswa();
    hideLoading();
  }
}

// 6. LOGIKA PLOTTING KRS
async function loadKRSSelectOptions() {
  const select = document.getElementById('selectKRSMataKuliah');
  if (!select) return;
  const { data } = await supabase.from('matakuliah').select('*').order('nama_mk');
  select.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>';
  data?.forEach(mk => {
    select.innerHTML += `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk})</option>`;
  });
}

async function renderKRSCheckboxes(idMK) {
  const box = document.getElementById('checkboxMahasiswaKRS');
  if (!box) return;

  const [resMhs, resKRS] = await Promise.all([
    supabase.from('datamahasiswa').select('*').order('npm_mahasiswa'),
    supabase.from('krsmatakuliah').select('id_datamahasiswa').eq('id_matakuliah', idMK)
  ]);

  const allMhs = resMhs.data || [];
  const activeMhsIds = new Set((resKRS.data || []).map(k => k.id_datamahasiswa));

  box.innerHTML = '';
  allMhs.forEach(mhs => {
    const isChecked = activeMhsIds.has(mhs.id) ? 'checked' : '';
    box.innerHTML += `
      <label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-amber-50/50">
        <input type="checkbox" class="krs-mhs-cb accent-orange-600 rounded" value="${mhs.id}" ${isChecked}>
        <div class="text-[11px]">
          <div class="font-bold text-slate-800">${mhs.nama_mahasiswa}</div>
          <div class="text-[10px] text-slate-500">${mhs.npm_mahasiswa}</div>
        </div>
      </label>
    `;
  });
}

async function savePlottingKRS() {
  const select = document.getElementById('selectKRSMataKuliah');
  const idMK = select?.value;
  if (!idMK) return;

  showLoading();
  // 1. Hapus plotting lama untuk MK ini
  await supabase.from('krsmatakuliah').delete().eq('id_matakuliah', idMK);

  // 2. Ambil ID mahasiswa yang dicentang
  const checkedBoxes = document.querySelectorAll('.krs-mhs-cb:checked');
  const newRecords = Array.from(checkedBoxes).map(cb => ({
    id_matakuliah: idMK,
    id_datamahasiswa: cb.value
  }));

  if (newRecords.length > 0) {
    await supabase.from('krsmatakuliah').insert(newRecords);
  }

  hideLoading();
  alert('Plotting KRS berhasil disimpan!');
}