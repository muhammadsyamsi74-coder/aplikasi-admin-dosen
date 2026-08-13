// js/modules/master.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

let allMataKuliah = [];
let allMahasiswa = [];
let currentPlottedMhsIds = new Set();

export async function initMaster() {
  await loadMataKuliah();
  await loadMahasiswa();
  setupEventListeners();
  setupUploadExcelListeners();
}

// ==========================================
// 1. MASTER MATA KULIAH LOGIC
// ==========================================
async function loadMataKuliah() {
  showLoading();
  try {
    const { data, error } = await supabase.from('matakuliah').select('*').order('nama_mk', { ascending: true });
    if (error) throw error;

    allMataKuliah = data || [];
    renderTableMK();
    renderSelectMKPlotting();
  } catch (err) {
    alert('Gagal memuat mata kuliah: ' + err.message);
  } finally {
    hideLoading();
  }
}

function renderTableMK() {
  const tableBody = document.getElementById('listMataKuliahTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (allMataKuliah.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic text-xs">Belum ada data mata kuliah.</td></tr>`;
    return;
  }

  allMataKuliah.forEach(mk => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-2.5 font-bold text-slate-800">
        ${mk.nama_mk} <br/>
        <span class="text-[10px] text-amber-600 font-extrabold">Kelas: ${mk.kelas_mk}</span>
      </td>
      <td class="p-2.5 text-center font-bold text-slate-600">${mk.sks_mk} SKS</td>
      <td class="p-2.5 text-center">
        <div class="flex justify-center gap-1">
          <button class="btn-edit-mk p-1 text-amber-600 hover:text-amber-800 font-extrabold" data-id="${mk.id}">Edit</button>
          <button class="btn-hapus-mk p-1 text-red-600 hover:text-red-800 font-extrabold" data-id="${mk.id}">Hapus</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-mk').forEach(b => {
    b.addEventListener('click', () => {
      const mk = allMataKuliah.find(m => m.id === b.getAttribute('data-id'));
      if (!mk) return;
      document.getElementById('mk_id').value = mk.id;
      document.getElementById('mk_nama').value = mk.nama_mk;
      document.getElementById('mk_kelas').value = mk.kelas_mk;
      document.getElementById('mk_sks').value = mk.sks_mk;
      document.getElementById('btnBatalMK').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.btn-hapus-mk').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('Hapus mata kuliah ini? Data KRS terkait juga akan terpengaruh.')) {
        showLoading();
        await supabase.from('matakuliah').delete().eq('id', b.getAttribute('data-id'));
        await loadMataKuliah();
        hideLoading();
      }
    });
  });
}

// ==========================================
// 2. MASTER MAHASISWA LOGIC (DIBUAT A-Z NAMA)
// ==========================================
async function loadMahasiswa() {
  showLoading();
  try {
    // DIURUTKAN A-Z BERDASARKAN NAMA MAHASISWA
    const { data, error } = await supabase
      .from('datamahasiswa')
      .select('*')
      .order('nama_mahasiswa', { ascending: true });

    if (error) throw error;

    allMahasiswa = data || [];
    renderTableMahasiswa();
  } catch (err) {
    alert('Gagal memuat mahasiswa: ' + err.message);
  } finally {
    hideLoading();
  }
}

function renderTableMahasiswa() {
  const tableBody = document.getElementById('listMahasiswaTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (allMahasiswa.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 italic text-xs">Belum ada data mahasiswa.</td></tr>`;
    return;
  }

  allMahasiswa.forEach(mhs => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-2.5">
        <div class="font-bold text-slate-800">${mhs.nama_mahasiswa}</div>
        <div class="font-mono text-[10px] font-extrabold text-teal-700">${mhs.npm_mahasiswa}</div>
      </td>
      <td class="p-2.5 text-center font-bold text-slate-600">${mhs.angkatan_mahasiswa || '-'}</td>
      <td class="p-2.5 text-center">
        <div class="flex justify-center gap-1">
          <button class="btn-edit-mhs p-1 text-amber-600 hover:text-amber-800 font-extrabold" data-id="${mhs.id}">Edit</button>
          <button class="btn-hapus-mhs p-1 text-red-600 hover:text-red-800 font-extrabold" data-id="${mhs.id}">Hapus</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-mhs').forEach(b => {
    b.addEventListener('click', () => {
      const mhs = allMahasiswa.find(m => m.id === b.getAttribute('data-id'));
      if (!mhs) return;
      document.getElementById('mhs_id').value = mhs.id;
      document.getElementById('mhs_npm').value = mhs.npm_mahasiswa;
      document.getElementById('mhs_nama').value = mhs.nama_mahasiswa;
      document.getElementById('mhs_angkatan').value = mhs.angkatan_mahasiswa;
      document.getElementById('btnBatalMhs').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.btn-hapus-mhs').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('Hapus mahasiswa ini? Data KRS, presensi & nilai mahasiswa ini akan terhapus.')) {
        showLoading();
        await supabase.from('datamahasiswa').delete().eq('id', b.getAttribute('data-id'));
        await loadMahasiswa();
        hideLoading();
      }
    });
  });
}

// ==========================================
// 3. LOGIKA UPLOAD & DOWNLOAD EXCEL MASSAL
// ==========================================
function setupUploadExcelListeners() {
  const btnDownload = document.getElementById('btnDownloadTemplateMhs');
  const btnTrigger = document.getElementById('btnTriggerUploadExcelMhs');
  const hiddenInput = document.getElementById('inputExcelMahasiswaHidden');

  btnDownload?.addEventListener('click', () => {
    const sampleData = [
      { 'NPM': '202601001', 'Nama Mahasiswa': 'Ahmad Fauzi', 'Angkatan': 2026 },
      { 'NPM': '202601002', 'Nama Mahasiswa': 'Budi Santoso', 'Angkatan': 2026 },
      { 'NPM': '202601003', 'Nama Mahasiswa': 'Citra Lestari', 'Angkatan': 2026 }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Mahasiswa');
    XLSX.writeFile(workbook, 'Template_Import_Mahasiswa.xlsx');
  });

  btnTrigger?.addEventListener('click', () => hiddenInput?.click());

  hiddenInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showLoading();
    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonRows.length === 0) {
        alert('File Excel kosong atau format tidak sesuai!');
        hideLoading();
        return;
      }

      const payloadInsert = [];
      for (const row of jsonRows) {
        const npm = String(row['NPM'] || row['npm'] || '').trim();
        const nama = String(row['Nama Mahasiswa'] || row['Nama'] || row['nama'] || '').trim();
        const angkatan = parseInt(row['Angkatan'] || row['angkatan'] || new Date().getFullYear());

        if (npm && nama) {
          payloadInsert.push({
            npm_mahasiswa: npm,
            nama_mahasiswa: nama,
            angkatan_mahasiswa: isNaN(angkatan) ? new Date().getFullYear() : angkatan
          });
        }
      }

      if (payloadInsert.length === 0) {
        alert('Tidak ditemukan data valid! Pastikan header kolom adalah "NPM", "Nama Mahasiswa", dan "Angkatan".');
        hideLoading();
        return;
      }

      const { error } = await supabase.from('datamahasiswa').insert(payloadInsert);
      if (error) throw error;

      alert(`Berhasil mengunggah ${payloadInsert.length} data mahasiswa secara serempak!`);
      await loadMahasiswa();
    } catch (err) {
      alert('Gagal memproses file Excel: ' + err.message);
    } finally {
      hiddenInput.value = '';
      hideLoading();
    }
  });
}

// ==========================================
// 4. EVENT LISTENERS FORM & PLOTTING KRS
// ==========================================
function setupEventListeners() {
  document.getElementById('formMataKuliah')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mk_id').value;
    const payload = {
      nama_mk: document.getElementById('mk_nama').value,
      kelas_mk: document.getElementById('mk_kelas').value,
      sks_mk: parseInt(document.getElementById('mk_sks').value)
    };

    if (id) {
      await supabase.from('matakuliah').update(payload).eq('id', id);
    } else {
      await supabase.from('matakuliah').insert([payload]);
    }

    resetFormMK();
    await loadMataKuliah();
    hideLoading();
  });

  document.getElementById('btnBatalMK')?.addEventListener('click', resetFormMK);

  document.getElementById('formMahasiswa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mhs_id').value;
    const payload = {
      npm_mahasiswa: document.getElementById('mhs_npm').value,
      nama_mahasiswa: document.getElementById('mhs_nama').value,
      angkatan_mahasiswa: parseInt(document.getElementById('mhs_angkatan').value)
    };

    if (id) {
      await supabase.from('datamahasiswa').update(payload).eq('id', id);
    } else {
      await supabase.from('datamahasiswa').insert([payload]);
    }

    resetFormMhs();
    await loadMahasiswa();
    hideLoading();
  });

  document.getElementById('btnBatalMhs')?.addEventListener('click', resetFormMhs);

  const selectMKPlot = document.getElementById('selectMKPlotting');
  const inputCari = document.getElementById('inputCariMhsPlotting');

  selectMKPlot?.addEventListener('change', loadPlottingMahasiswaCheckbox);

  inputCari?.addEventListener('input', () => {
    renderCheckboxPlotting(inputCari.value);
  });

  document.getElementById('btnPilihSemuaMhsPlot')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.cb-plot-mhs');
    const allChecked = Array.from(checkboxes).every(c => c.checked);
    checkboxes.forEach(c => c.checked = !allChecked);
  });

  document.getElementById('btnSimpanPlottingKRS')?.addEventListener('click', savePlottingKRS);
}

function resetFormMK() {
  document.getElementById('formMataKuliah')?.reset();
  document.getElementById('mk_id').value = '';
  document.getElementById('btnBatalMK')?.classList.add('hidden');
}

function resetFormMhs() {
  document.getElementById('formMahasiswa')?.reset();
  document.getElementById('mhs_id').value = '';
  document.getElementById('btnBatalMhs')?.classList.add('hidden');
}

function renderSelectMKPlotting() {
  const select = document.getElementById('selectMKPlotting');
  if (!select) return;

  select.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>';
  allMataKuliah.forEach(mk => {
    select.innerHTML += `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk})</option>`;
  });
}

async function loadPlottingMahasiswaCheckbox() {
  const mkId = document.getElementById('selectMKPlotting')?.value;
  const container = document.getElementById('containerCheckboxMhsPlotting');
  if (!container) return;

  if (!mkId) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic col-span-full">Pilih Mata Kuliah terlebih dahulu untuk menampilkan daftar mahasiswa.</p>';
    currentPlottedMhsIds.clear();
    return;
  }

  showLoading();
  const { data: krsData } = await supabase.from('krsmatakuliah').select('id_datamahasiswa').eq('id_matakuliah', mkId);
  currentPlottedMhsIds = new Set((krsData || []).map(k => k.id_datamahasiswa));

  renderCheckboxPlotting();
  hideLoading();
}

function renderCheckboxPlotting(keyword = '') {
  const container = document.getElementById('containerCheckboxMhsPlotting');
  if (!container) return;

  const mkId = document.getElementById('selectMKPlotting')?.value;
  if (!mkId) return;

  const cleanKeyword = keyword.toLowerCase().trim();
  
  const filteredMhs = allMahasiswa.filter(mhs => 
    mhs.nama_mahasiswa.toLowerCase().includes(cleanKeyword) ||
    mhs.npm_mahasiswa.toLowerCase().includes(cleanKeyword)
  );

  container.innerHTML = '';

  if (filteredMhs.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic col-span-full">Nama/NPM mahasiswa tidak ditemukan.</p>';
    return;
  }

  filteredMhs.forEach(mhs => {
    const isChecked = currentPlottedMhsIds.has(mhs.id) ? 'checked' : '';
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-all text-xs font-bold text-slate-800';
    label.innerHTML = `
      <input type="checkbox" class="cb-plot-mhs w-4 h-4 text-amber-500 rounded focus:ring-amber-400" value="${mhs.id}" ${isChecked}>
      <span class="truncate">${mhs.nama_mahasiswa} <span class="text-[10px] text-teal-700 font-mono">(${mhs.npm_mahasiswa})</span></span>
    `;
    
    const cb = label.querySelector('input');
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        currentPlottedMhsIds.add(mhs.id);
      } else {
        currentPlottedMhsIds.delete(mhs.id);
      }
    });

    container.appendChild(label);
  });
}

async function savePlottingKRS() {
  const mkId = document.getElementById('selectMKPlotting')?.value;
  if (!mkId) {
    alert('Pilih Mata Kuliah terlebih dahulu!');
    return;
  }

  showLoading();
  try {
    await supabase.from('krsmatakuliah').delete().eq('id_matakuliah', mkId);

    const payload = Array.from(currentPlottedMhsIds).map(mhsId => ({
      id_matakuliah: mkId,
      id_datamahasiswa: mhsId
    }));

    if (payload.length > 0) {
      const { error } = await supabase.from('krsmatakuliah').insert(payload);
      if (error) throw error;
    }

    alert('Plotting KRS berhasil disimpan!');
  } catch (err) {
    alert('Gagal menyimpan Plotting KRS: ' + err.message);
  } finally {
    hideLoading();
  }
}