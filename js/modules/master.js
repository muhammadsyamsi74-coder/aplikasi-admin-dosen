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
    const { data, error } = await supabase
      .from('matakuliah')
      .select('*, krsmatakuliah(id_datamahasiswa)')
      .order('nama_mk', { ascending: true });

    if (error) throw error;

    // Sorting: Status Aktif (true) di atas, Nonaktif (false) di bawah, lalu berdasarkan Nama A-Z
    allMataKuliah = (data || []).sort((a, b) => {
      const statusA = a.status_mk !== false ? 1 : 0;
      const statusB = b.status_mk !== false ? 1 : 0;
      if (statusA !== statusB) return statusB - statusA;
      return (a.nama_mk || '').localeCompare(b.nama_mk || '');
    });

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
    tableBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400 italic text-xs">Belum ada data mata kuliah.</td></tr>`;
    return;
  }

  allMataKuliah.forEach(mk => {
    const totalMahasiswa = mk.krsmatakuliah ? mk.krsmatakuliah.length : 0;
    const isAktif = mk.status_mk !== false;

    const badgeStatus = isAktif
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">Nonaktif</span>`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-2.5 font-bold text-slate-800">
        ${mk.nama_mk} <br/>
        <span class="text-[10px] text-amber-600 font-extrabold">Kode: ${mk.kelas_mk || '-'}</span>
      </td>
      <td class="p-2.5 text-center">
        ${badgeStatus}
      </td>
      <td class="p-2.5 text-center">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
          ${totalMahasiswa}
        </span>
      </td>
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
      document.getElementById('mk_kelas').value = mk.kelas_mk || '';
      document.getElementById('mk_sks').value = mk.sks_mk || 3;
      document.getElementById('mk_status').value = mk.status_mk === false ? 'false' : 'true';
      showFormMK();
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
// 2. MASTER MAHASISWA LOGIC
// ==========================================
async function loadMahasiswa() {
  showLoading();
  try {
    const { data, error } = await supabase
      .from('datamahasiswa')
      .select('*, krsmatakuliah(id_matakuliah)')
      .order('nama_mahasiswa', { ascending: true });

    if (error) throw error;

    // Sorting: Status Aktif (true) di atas, Nonaktif (false) di bawah, lalu Nama A-Z
    allMahasiswa = (data || []).sort((a, b) => {
      const statusA = a.status_mahasiswa !== false ? 1 : 0;
      const statusB = b.status_mahasiswa !== false ? 1 : 0;
      if (statusA !== statusB) return statusB - statusA;
      return (a.nama_mahasiswa || '').localeCompare(b.nama_mahasiswa || '');
    });

    populateAngkatanFilterOptions();
    applyMahasiswaFilter();
  } catch (err) {
    alert('Gagal memuat mahasiswa: ' + err.message);
  } finally {
    hideLoading();
  }
}

function populateAngkatanFilterOptions() {
  const select = document.getElementById('filterMhsAngkatan');
  if (!select) return;

  const currentVal = select.value;
  const uniqueAngkatan = Array.from(
    new Set(allMahasiswa.map(m => String(m.angkatan_mahasiswa || '').trim()).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  let optionsHTML = '<option value="">-- Semua Angkatan --</option>';
  uniqueAngkatan.forEach(ang => {
    optionsHTML += `<option value="${ang}">${ang}</option>`;
  });
  select.innerHTML = optionsHTML;
  select.value = currentVal;
}

function applyMahasiswaFilter() {
  const keyword = (document.getElementById('filterMhsKeyword')?.value || '').toLowerCase().trim();
  const statusVal = document.getElementById('filterMhsStatus')?.value || '';
  const angkatanVal = document.getElementById('filterMhsAngkatan')?.value || '';

  const filtered = allMahasiswa.filter(mhs => {
    const matchKeyword = !keyword || 
      (mhs.nama_mahasiswa && mhs.nama_mahasiswa.toLowerCase().includes(keyword)) ||
      (mhs.npm_mahasiswa && mhs.npm_mahasiswa.toLowerCase().includes(keyword));

    const isAktif = mhs.status_mahasiswa !== false;
    const matchStatus = !statusVal || (statusVal === 'true' ? isAktif : !isAktif);

    const matchAngkatan = !angkatanVal || String(mhs.angkatan_mahasiswa || '').trim() === angkatanVal;

    return matchKeyword && matchStatus && matchAngkatan;
  });

  renderTableMahasiswa(filtered);
}

function renderTableMahasiswa(dataList) {
  const tableBody = document.getElementById('listMahasiswaTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (dataList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400 italic text-xs">Tidak ada data mahasiswa yang sesuai filter.</td></tr>`;
    return;
  }

  dataList.forEach(mhs => {
    const isAktif = mhs.status_mahasiswa !== false;
    const totalMK = mhs.krsmatakuliah ? mhs.krsmatakuliah.length : 0;

    const badgeStatus = isAktif
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">Nonaktif</span>`;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-2.5">
        <div class="font-bold text-slate-800">${mhs.nama_mahasiswa}</div>
        <div class="font-mono text-[10px] font-extrabold text-teal-700">${mhs.npm_mahasiswa}</div>
      </td>
      <td class="p-2.5 text-center">
        ${badgeStatus}
      </td>
      <td class="p-2.5 text-center font-bold text-slate-600">${mhs.angkatan_mahasiswa || '-'}</td>
      <td class="p-2.5 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          ${totalMK} MK
        </span>
      </td>
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
      document.getElementById('mhs_angkatan').value = String(mhs.angkatan_mahasiswa || '');
      document.getElementById('mhs_status').value = mhs.status_mahasiswa === false ? 'false' : 'true';
      showFormMhs();
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
// 3. LOGIKA UPLOAD & DOWNLOAD EXCEL
// ==========================================
function setupUploadExcelListeners() {
  const btnDownload = document.getElementById('btnDownloadTemplateMhs');
  const btnTrigger = document.getElementById('btnTriggerUploadExcelMhs');
  const hiddenInput = document.getElementById('inputExcelMahasiswaHidden');

  btnDownload?.addEventListener('click', () => {
    const sampleData = [
      { 'NPM': '202601001', 'Nama Mahasiswa': 'Ahmad Fauzi', 'Tahun Angkatan': '2026', 'Status': 'Aktif' },
      { 'NPM': '202601002', 'Nama Mahasiswa': 'Budi Santoso', 'Tahun Angkatan': '2026', 'Status': 'Aktif' },
      { 'NPM': '202601003', 'Nama Mahasiswa': 'Citra Lestari', 'Tahun Angkatan': '2026', 'Status': 'Nonaktif' }
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

      const { data: dbMahasiswa, error: fetchErr } = await supabase
        .from('datamahasiswa')
        .select('npm_mahasiswa');

      if (fetchErr) throw new Error('Gagal memeriksa data di database: ' + fetchErr.message);

      const registeredNPMSet = new Set((dbMahasiswa || []).map(m => String(m.npm_mahasiswa).trim().toLowerCase()));
      const seenInExcelNPMSet = new Set();
      const payloadInsert = [];
      let duplicateCount = 0;

      for (const row of jsonRows) {
        let npm = '';
        let nama = '';
        let angkatan = '2026';
        let status = true;

        for (const [key, val] of Object.entries(row)) {
          const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanVal = String(val).trim();

          if (cleanKey === 'npm') npm = cleanVal;
          if (cleanKey.includes('nama') && !cleanKey.includes('mk')) nama = cleanVal;
          if (cleanKey.includes('angkatan') || cleanKey === 'tahun') angkatan = cleanVal;
          if (cleanKey.includes('status')) {
            status = !(cleanVal.toLowerCase() === 'nonaktif' || cleanVal === 'false' || cleanVal === '0');
          }
        }

        if (!npm || !nama) continue;

        const npmLower = npm.toLowerCase();

        if (registeredNPMSet.has(npmLower) || seenInExcelNPMSet.has(npmLower)) {
          duplicateCount++;
          continue;
        }

        seenInExcelNPMSet.add(npmLower);

        payloadInsert.push({
          npm_mahasiswa: npm,
          nama_mahasiswa: nama,
          angkatan_mahasiswa: String(angkatan || '2026'),
          status_mahasiswa: status
        });
      }

      if (payloadInsert.length === 0) {
        alert(`Tidak ada data baru yang ditambahkan.\nSeluruh ${duplicateCount} data dalam file sudah ada di database atau merupakan duplikat.`);
        hideLoading();
        return;
      }

      const { error: insertErr } = await supabase.from('datamahasiswa').insert(payloadInsert);
      if (insertErr) throw insertErr;

      let msg = `✅ Berhasil mengunggah ${payloadInsert.length} data mahasiswa baru!`;
      if (duplicateCount > 0) {
        msg += `\n(${duplicateCount} data dilewati karena NPM sudah terdaftar/duplikat)`;
      }
      alert(msg);
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
// 4. EVENT LISTENERS FORM, FILTER & PLOTTING KRS
// ==========================================
function setupEventListeners() {
  document.getElementById('filterMhsKeyword')?.addEventListener('input', applyMahasiswaFilter);
  document.getElementById('filterMhsStatus')?.addEventListener('change', applyMahasiswaFilter);
  document.getElementById('filterMhsAngkatan')?.addEventListener('change', applyMahasiswaFilter);

  document.getElementById('btnToggleFormMK')?.addEventListener('click', () => {
    const form = document.getElementById('formMataKuliah');
    if (form.classList.contains('hidden')) {
      showFormMK();
    } else {
      hideFormMK();
    }
  });

  document.getElementById('btnToggleFormMhs')?.addEventListener('click', () => {
    const form = document.getElementById('formMahasiswa');
    if (form.classList.contains('hidden')) {
      showFormMhs();
    } else {
      hideFormMhs();
    }
  });

  document.getElementById('formMataKuliah')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mk_id').value;
    const payload = {
      nama_mk: document.getElementById('mk_nama').value,
      kelas_mk: document.getElementById('mk_kelas').value,
      sks_mk: parseInt(document.getElementById('mk_sks').value),
      status_mk: document.getElementById('mk_status').value === 'true'
    };

    if (id) {
      await supabase.from('matakuliah').update(payload).eq('id', id);
    } else {
      await supabase.from('matakuliah').insert([payload]);
    }

    hideFormMK();
    await loadMataKuliah();
    hideLoading();
  });

  document.getElementById('btnBatalMK')?.addEventListener('click', hideFormMK);

  document.getElementById('formMahasiswa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const id = document.getElementById('mhs_id').value;
    const payload = {
      npm_mahasiswa: document.getElementById('mhs_npm').value.trim(),
      nama_mahasiswa: document.getElementById('mhs_nama').value.trim(),
      angkatan_mahasiswa: String(document.getElementById('mhs_angkatan').value.trim() || '2026'),
      status_mahasiswa: document.getElementById('mhs_status').value === 'true'
    };

    try {
      if (id) {
        const { error } = await supabase.from('datamahasiswa').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: exist } = await supabase
          .from('datamahasiswa')
          .select('id')
          .eq('npm_mahasiswa', payload.npm_mahasiswa)
          .maybeSingle();

        if (exist) {
          alert(`NPM ${payload.npm_mahasiswa} sudah terdaftar di sistem!`);
          hideLoading();
          return;
        }

        const { error } = await supabase.from('datamahasiswa').insert([payload]);
        if (error) throw error;
      }

      hideFormMhs();
      await loadMahasiswa();
    } catch (err) {
      alert('Gagal menyimpan data: ' + err.message);
    } finally {
      hideLoading();
    }
  });

  document.getElementById('btnBatalMhs')?.addEventListener('click', hideFormMhs);

  const selectMKPlot = document.getElementById('selectMKPlotting');
  const inputCari = document.getElementById('inputCariMhsPlotting');

  selectMKPlot?.addEventListener('change', loadPlottingMahasiswaCheckbox);

  inputCari?.addEventListener('input', () => {
    renderCheckboxPlotting(inputCari.value);
  });

  document.getElementById('btnPilihSemuaMhsPlot')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.cb-plot-mhs');
    const allChecked = Array.from(checkboxes).every(c => c.checked);
    checkboxes.forEach(c => {
      c.checked = !allChecked;
      if (c.checked) {
        currentPlottedMhsIds.add(c.value);
      } else {
        currentPlottedMhsIds.delete(c.value);
      }
    });
    // Render ulang agar urutan posisi yang tercentang langsung pindah ke atas
    renderCheckboxPlotting(inputCari ? inputCari.value : '');
  });

  document.getElementById('btnSimpanPlottingKRS')?.addEventListener('click', savePlottingKRS);
}

function showFormMK() {
  document.getElementById('formMataKuliah')?.classList.remove('hidden');
  const icon = document.getElementById('iconToggleMK');
  const text = document.getElementById('textToggleMK');
  if (icon) icon.innerText = '✕';
  if (text) text.innerText = 'Tutup Form';
}

function hideFormMK() {
  const form = document.getElementById('formMataKuliah');
  form?.reset();
  document.getElementById('mk_id').value = '';
  form?.classList.add('hidden');
  const icon = document.getElementById('iconToggleMK');
  const text = document.getElementById('textToggleMK');
  if (icon) icon.innerText = '+';
  if (text) text.innerText = 'Tambah MK';
}

function showFormMhs() {
  document.getElementById('formMahasiswa')?.classList.remove('hidden');
  const icon = document.getElementById('iconToggleMhs');
  const text = document.getElementById('textToggleMhs');
  if (icon) icon.innerText = '✕';
  if (text) text.innerText = 'Tutup form';
}

function hideFormMhs() {
  const form = document.getElementById('formMahasiswa');
  form?.reset();
  document.getElementById('mhs_id').value = '';
  form?.classList.add('hidden');
  const icon = document.getElementById('iconToggleMhs');
  const text = document.getElementById('textToggleMhs');
  if (icon) icon.innerText = '+';
  if (text) text.innerText = 'Tambah Mahasiswa';
}

function renderSelectMKPlotting() {
  const select = document.getElementById('selectMKPlotting');
  if (!select) return;

  select.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>';
  allMataKuliah.forEach(mk => {
    const labelStatus = mk.status_mk === false ? ' [Nonaktif]' : '';
    select.innerHTML += `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk || '-'})${labelStatus}</option>`;
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
  
  // Filter mahasiswa sesuai pencarian
  let filteredMhs = allMahasiswa.filter(mhs => 
    mhs.nama_mahasiswa.toLowerCase().includes(cleanKeyword) ||
    mhs.npm_mahasiswa.toLowerCase().includes(cleanKeyword)
  );

  // Sorting: Mahasiswa yang tercentang (checked) berada di atas, lalu urutkan Nama A-Z
  filteredMhs.sort((a, b) => {
    const aChecked = currentPlottedMhsIds.has(a.id) ? 1 : 0;
    const bChecked = currentPlottedMhsIds.has(b.id) ? 1 : 0;
    if (aChecked !== bChecked) return bChecked - aChecked;
    return (a.nama_mahasiswa || '').localeCompare(b.nama_mahasiswa || '');
  });

  container.innerHTML = '';

  if (filteredMhs.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic col-span-full">Nama/NPM mahasiswa tidak ditemukan.</p>';
    return;
  }

  filteredMhs.forEach(mhs => {
    const isChecked = currentPlottedMhsIds.has(mhs.id);
    const label = document.createElement('label');
    label.className = `flex items-start gap-2.5 p-2.5 rounded-lg border transition-all text-xs font-bold text-slate-800 cursor-pointer ${
      isChecked ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200 hover:bg-slate-50'
    }`;
    label.innerHTML = `
      <input type="checkbox" class="cb-plot-mhs w-4 h-4 mt-0.5 text-amber-500 rounded focus:ring-amber-400 shrink-0 cursor-pointer" value="${mhs.id}" ${isChecked ? 'checked' : ''}>
      <div class="flex-1 leading-snug break-words">
        <span class="text-slate-800">${mhs.nama_mahasiswa}</span>
        <span class="inline-block text-[10px] text-teal-700 font-mono font-extrabold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 ml-1">
          ${mhs.npm_mahasiswa}
        </span>
      </div>
    `;
    
    const cb = label.querySelector('input');
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        currentPlottedMhsIds.add(mhs.id);
      } else {
        currentPlottedMhsIds.delete(mhs.id);
      }
      // Render ulang otomatis agar mahasiswa yang baru diceklis berpindah ke atas
      const inputCari = document.getElementById('inputCariMhsPlotting');
      renderCheckboxPlotting(inputCari ? inputCari.value : '');
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
    await loadMataKuliah();
    await loadMahasiswa();
  } catch (err) {
    alert('Gagal menyimpan Plotting KRS: ' + err.message);
  } finally {
    hideLoading();
  }
}