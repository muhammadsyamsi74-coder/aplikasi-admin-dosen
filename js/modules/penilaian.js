// js/modules/penilaian.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

let currentMhsNilaiList = [];
let allTugasData = [];
let allMataKuliahList = [];

const BUCKET_NAME = 'lampiran_aplikasiika';

export async function initPenilaian() {
  await loadMKOptions();
  setupEventListeners();
  setupExportModalListeners();
}

async function loadMKOptions() {
  const selectMK = document.getElementById('penilaianSelectMK');
  const selectExportMK = document.getElementById('exportNilaiSelectMK');

  const { data, error } = await supabase
    .from('matakuliah')
    .select('*')
    .neq('status_mk', false)
    .order('nama_mk', { ascending: true });

  if (error) { console.error(error); return; }

  allMataKuliahList = data || [];
  const optionsHTML = allMataKuliahList.map(mk => `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk || '-'})</option>`).join('');

  if (selectMK) selectMK.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>' + optionsHTML;
  if (selectExportMK) selectExportMK.innerHTML = '<option value="">-- Pilih 1 Mata Kuliah --</option>' + optionsHTML;
}

async function loadTugasSelectOptions(filterMKId = '') {
  const select = document.getElementById('selectDaftarTugasTarget');
  if (!select) return;

  if (!filterMKId) {
    select.innerHTML = '<option value="">-- Pilih Mata Kuliah Dahulu --</option>';
    allTugasData = [];
    return;
  }

  const { data, error } = await supabase
    .from('daftartugas')
    .select('*, matakuliah!inner(nama_mk, kelas_mk, status_mk)')
    .eq('id_matakuliah', filterMKId)
    .neq('matakuliah.status_mk', false)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  allTugasData = data || [];
  select.innerHTML = '<option value="">-- Pilih Tugas --</option>';
  
  if (allTugasData.length === 0) {
    select.innerHTML = '<option value="">-- Belum ada tugas untuk MK ini --</option>';
  } else {
    allTugasData.forEach(t => {
      select.innerHTML += `<option value="${t.id}" data-mk-id="${t.id_matakuliah}">${t.nama_tugas}</option>`;
    });
  }
}

function toggleFormTugas(show = null, isEdit = false, tugasObj = null) {
  const wrapper = document.getElementById('wrapperFormTugas');
  const icon = document.getElementById('iconToggleTugas');
  const label = document.getElementById('labelToggleTugas');
  const formTitle = document.getElementById('formTugasTitle');
  const submitBtn = document.getElementById('btnSubmitTugas');
  const previewLampiran = document.getElementById('infoLampiranEditPreview');
  if (!wrapper) return;

  const willShow = show !== null ? show : wrapper.classList.contains('hidden');
  if (willShow) {
    const idMK = document.getElementById('penilaianSelectMK')?.value;
    if (!idMK) {
      alert('Pilih Mata Kuliah terlebih dahulu!');
      return;
    }
    const currentMK = allMataKuliahList.find(m => m.id === idMK);
    const labelTarget = document.getElementById('labelTargetMKForm');
    if (labelTarget && currentMK) {
      labelTarget.innerText = `MK: ${currentMK.nama_mk} (${currentMK.kelas_mk || '-'})`;
    }

    if (isEdit && tugasObj) {
      document.getElementById('edit_tugas_id').value = tugasObj.id;
      document.getElementById('tugas_nama').value = tugasObj.nama_tugas;
      document.getElementById('edit_lampiran_lama').value = tugasObj.lampiran_tugas || '-';
      formTitle.innerText = 'Edit Judul Tugas';
      submitBtn.innerText = 'Perbarui Judul Tugas';

      if (tugasObj.lampiran_tugas && tugasObj.lampiran_tugas !== '-') {
        previewLampiran.innerText = 'Sudah ada lampiran. Unggah file baru untuk menggantinya.';
        previewLampiran.classList.remove('hidden');
      } else {
        previewLampiran.classList.add('hidden');
      }
    } else {
      document.getElementById('edit_tugas_id').value = '';
      document.getElementById('edit_lampiran_lama').value = '';
      document.getElementById('formDaftarTugas').reset();
      formTitle.innerText = 'Form Tambah Tugas Baru';
      submitBtn.innerText = 'Simpan Judul Tugas';
      previewLampiran.classList.add('hidden');
    }

    wrapper.classList.remove('hidden');
    if (icon) icon.innerText = '✕';
    if (label) label.innerText = 'Tutup Form Tugas';
  } else {
    wrapper.classList.add('hidden');
    document.getElementById('formDaftarTugas')?.reset();
    document.getElementById('edit_tugas_id').value = '';
    document.getElementById('edit_lampiran_lama').value = '';
    previewLampiran?.classList.add('hidden');
    if (icon) icon.innerText = '+';
    if (label) label.innerText = 'Tambah Tugas Baru';
  }
}

function compressImage(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve) => {
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
    };
  });
}

function setupEventListeners() {
  // Dropdown Tunggal Mata Kuliah
  document.getElementById('penilaianSelectMK')?.addEventListener('change', async (e) => {
    const mkId = e.target.value;
    document.getElementById('containerInputNilai')?.classList.add('hidden');
    toggleFormTugas(false);
    await loadTugasSelectOptions(mkId);
  });

  // Toggle Form Buat Tugas Baru
  document.getElementById('btnToggleFormTugas')?.addEventListener('click', () => toggleFormTugas());
  document.getElementById('btnBatalTugas')?.addEventListener('click', () => toggleFormTugas(false));

  // Submit Form Tambah / Edit Tugas
  document.getElementById('formDaftarTugas')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idMK = document.getElementById('penilaianSelectMK')?.value;
    if (!idMK) {
      alert('Pilih Mata Kuliah terlebih dahulu!');
      return;
    }

    showLoading();
    try {
      const editId = document.getElementById('edit_tugas_id').value;
      const fileInput = document.getElementById('tugas_lampiran_file');
      let lampiranURL = document.getElementById('edit_lampiran_lama').value || '-';

      // Upload file baru jika ada file yang dipilih
      if (fileInput?.files?.length > 0) {
        let file = fileInput.files[0];
        const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.pdf|\.doc|\.docx)$/i;
        if (!allowedExtensions.exec(file.name)) {
          alert('Format file lampiran tidak didukung!');
          hideLoading();
          return;
        }

        file = await compressImage(file);
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `soal_${Date.now()}_${cleanFileName}`;
        
        const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
        if (uploadErr) throw new Error('Gagal mengunggah berkas: ' + uploadErr.message);

        const { data: publicURLData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        lampiranURL = publicURLData.publicUrl;
      }

      const payload = {
        id_matakuliah: idMK,
        nama_tugas: document.getElementById('tugas_nama').value.trim(),
        lampiran_tugas: lampiranURL
      };

      let targetId = editId;

      if (editId) {
        // Mode Edit
        const { error: updateErr } = await supabase.from('daftartugas').update(payload).eq('id', editId);
        if (updateErr) throw updateErr;
      } else {
        // Mode Tambah Baru
        const { data: insertData, error: insertErr } = await supabase.from('daftartugas').insert([payload]).select();
        if (insertErr) throw insertErr;
        if (insertData && insertData.length > 0) targetId = insertData[0].id;
      }

      toggleFormTugas(false);
      await loadTugasSelectOptions(idMK);

      // Otomatis pilih kembali tugas terkait
      if (targetId) {
        const selectTugas = document.getElementById('selectDaftarTugasTarget');
        if (selectTugas) {
          selectTugas.value = targetId;
          selectTugas.dispatchEvent(new Event('change'));
        }
      }

      alert(editId ? 'Judul Tugas Berhasil Diperbarui!' : 'Judul Tugas Baru Berhasil Disimpan!');
    } catch (err) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      hideLoading();
    }
  });

  // Pilih Tugas Target untuk Input Nilai
  const selectTugas = document.getElementById('selectDaftarTugasTarget');
  selectTugas?.addEventListener('change', async () => {
    const idTugas = selectTugas.value;
    const idMK = document.getElementById('penilaianSelectMK')?.value;
    
    const container = document.getElementById('containerInputNilai');
    if (!idTugas || !idMK) { container?.classList.add('hidden'); return; }
    
    container?.classList.remove('hidden');

    const tugasObj = allTugasData.find(t => t.id === idTugas);
    const linkLampiran = document.getElementById('linkLampiranSoal');
    const textInfoJudul = document.getElementById('textInfoJudulTugasAktif');
    
    if (textInfoJudul) textInfoJudul.innerText = `Tugas: ${tugasObj?.nama_tugas || '-'}`;

    if (tugasObj && tugasObj.lampiran_tugas && tugasObj.lampiran_tugas !== '-') {
      linkLampiran.classList.remove('hidden');
      linkLampiran.href = tugasObj.lampiran_tugas;
    } else {
      linkLampiran.classList.add('hidden');
    }

    await loadTabelNilai(idTugas, idMK);
  });

  // Tombol Edit Tugas Aktif
  document.getElementById('btnEditTugasAktif')?.addEventListener('click', () => {
    const idTugas = selectTugas?.value;
    if (!idTugas) return;
    const tugasObj = allTugasData.find(t => t.id === idTugas);
    if (tugasObj) {
      toggleFormTugas(true, true, tugasObj);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Tombol Hapus Tugas Aktif
  document.getElementById('btnHapusTugasAktif')?.addEventListener('click', async () => {
    const idTugas = selectTugas?.value;
    const idMK = document.getElementById('penilaianSelectMK')?.value;
    if (!idTugas) return;

    const tugasObj = allTugasData.find(t => t.id === idTugas);
    const konfirmasi = confirm(`Apakah Anda yakin ingin menghapus "${tugasObj?.nama_tugas}"?\n\nPERINGATAN: Seluruh data nilai mahasiswa di dalam tugas ini akan terhapus secara permanen.`);
    if (!konfirmasi) return;

    showLoading();
    try {
      // 1. Hapus relasi nilai tugas terlebih dahulu
      await supabase.from('penilaiantugas').delete().eq('id_daftartugas', idTugas);

      // 2. Hapus judul tugas
      const { error: delErr } = await supabase.from('daftartugas').delete().eq('id', idTugas);
      if (delErr) throw delErr;

      alert('Tugas dan seluruh nilai terkait berhasil dihapus!');
      document.getElementById('containerInputNilai')?.classList.add('hidden');
      toggleFormTugas(false);
      await loadTugasSelectOptions(idMK);
    } catch (err) {
      alert('Gagal menghapus tugas: ' + err.message);
    } finally {
      hideLoading();
    }
  });

  document.getElementById('btnSimpanNilaiMassal')?.addEventListener('click', saveNilaiMassal);
}

async function loadTabelNilai(idTugas, idMK) {
  showLoading();
  const tableBody = document.getElementById('listInputNilaiTable');

  const { data: krsData } = await supabase.from('krsmatakuliah').select('datamahasiswa(*)').eq('id_matakuliah', idMK);
  
  currentMhsNilaiList = (krsData || [])
    .map(k => k.datamahasiswa)
    .filter(mhs => mhs && mhs.status_mahasiswa !== false);

  currentMhsNilaiList.sort((a, b) => (a.nama_mahasiswa || '').localeCompare(b.nama_mahasiswa || ''));

  const { data: nilaiData } = await supabase.from('penilaiantugas').select('*').eq('id_daftartugas', idTugas);
  const nilaiMap = new Map((nilaiData || []).map(n => [n.id_datamahasiswa, n]));

  tableBody.innerHTML = '';
  
  if (currentMhsNilaiList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic text-xs">Belum ada mahasiswa aktif di mata kuliah ini.</td></tr>`;
    hideLoading();
    return;
  }

  currentMhsNilaiList.forEach(mhs => {
    const rec = nilaiMap.get(mhs.id);
    const val = rec?.nilai_tugas !== undefined ? rec.nilai_tugas : '';
    const rawTuntas = rec?.ketuntasan_tugas || 'Tuntas';
    const isTuntas = rawTuntas === 'Tuntas' || rawTuntas === 'T';
    const statusVal = isTuntas ? 'T' : 'TD';
    const catatan = rec?.refleksi_tugas || '';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-3 leading-tight min-w-[180px] md:min-w-[240px]">
        <div class="font-bold text-slate-800 text-xs leading-snug break-words">${mhs.nama_mahasiswa}</div>
        <div class="font-mono text-[10px] font-extrabold text-teal-700">${mhs.npm_mahasiswa}</div>
      </td>
      <td class="p-2 text-center min-w-[70px]">
        <input type="number" min="0" max="100" value="${val}" placeholder="0" class="input-nilai-mhs w-14 h-8 px-1 text-center font-black text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none" data-mhs-id="${mhs.id}">
      </td>
      <td class="p-2 text-center min-w-[85px]">
        <div class="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100">
          <button type="button" data-val="T" class="btn-toggle-tuntas px-2 py-1 text-[10px] font-black rounded-md transition-all ${statusVal === 'T' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}">
            T
          </button>
          <button type="button" data-val="TD" class="btn-toggle-tuntas px-1.5 py-1 text-[10px] font-black rounded-md transition-all ${statusVal === 'TD' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}">
            TD
          </button>
        </div>
        <input type="hidden" class="input-ketuntasan-val" data-mhs-id="${mhs.id}" value="${statusVal}">
      </td>
      <td class="p-2 min-w-[110px] w-28 md:w-48">
        <input type="text" value="${catatan}" placeholder="Catatan..." class="input-catatan-mhs w-full h-8 px-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:bg-white focus:outline-none truncate" data-mhs-id="${mhs.id}">
      </td>
    `;

    const toggleBtns = tr.querySelectorAll('.btn-toggle-tuntas');
    const hiddenInput = tr.querySelector('.input-ketuntasan-val');

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        hiddenInput.value = val;

        toggleBtns.forEach(b => {
          b.className = 'btn-toggle-tuntas px-1.5 py-1 text-[10px] font-black rounded-md transition-all text-slate-500 hover:bg-slate-200';
        });

        if (val === 'T') {
          btn.className = 'btn-toggle-tuntas px-2 py-1 text-[10px] font-black rounded-md transition-all bg-emerald-600 text-white shadow-sm';
        } else {
          btn.className = 'btn-toggle-tuntas px-1.5 py-1 text-[10px] font-black rounded-md transition-all bg-rose-600 text-white shadow-sm';
        }
      });
    });

    tableBody.appendChild(tr);
  });
  hideLoading();
}

async function saveNilaiMassal() {
  const selectTugas = document.getElementById('selectDaftarTugasTarget');
  const idTugas = selectTugas?.value;
  if (!idTugas) return;

  showLoading();
  await supabase.from('penilaiantugas').delete().eq('id_daftartugas', idTugas);

  const payload = [];
  currentMhsNilaiList.forEach(mhs => {
    const inpNilai = document.querySelector(`.input-nilai-mhs[data-mhs-id="${mhs.id}"]`);
    const valTuntas = document.querySelector(`.input-ketuntasan-val[data-mhs-id="${mhs.id}"]`)?.value || 'T';
    const inpCatatan = document.querySelector(`.input-catatan-mhs[data-mhs-id="${mhs.id}"]`);

    payload.push({
      id_daftartugas: idTugas,
      id_datamahasiswa: mhs.id,
      nilai_tugas: inpNilai?.value ? parseInt(inpNilai.value) : 0,
      ketuntasan_tugas: valTuntas === 'T' ? 'Tuntas' : 'Belum Tuntas',
      refleksi_tugas: inpCatatan?.value || ''
    });
  });

  const { error } = await supabase.from('penilaiantugas').insert(payload);
  hideLoading();

  if (error) {
    alert('Gagal menyimpan nilai: ' + error.message);
  } else {
    alert('Seluruh Nilai dan Catatan Berhasil Disimpan!');
  }
}

function setupExportModalListeners() {
  const modal = document.getElementById('modalEksporNilai');
  const btnOpen = document.getElementById('btnOpenModalEksporNilai');
  const btnClose = document.getElementById('btnCloseModalEksporNilai');

  btnOpen?.addEventListener('click', () => modal?.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.getElementById('btnDoExportNilaiExcel')?.addEventListener('click', () => generateNilaiReport('excel'));
  document.getElementById('btnDoExportNilaiPDF')?.addEventListener('click', () => generateNilaiReport('pdf'));
}

async function generateNilaiReport(type) {
  const targetMKId = document.getElementById('exportNilaiSelectMK')?.value;
  if (!targetMKId) {
    alert('Mohon pilih 1 Mata Kuliah terlebih dahulu!');
    return;
  }

  showLoading();
  try {
    const { data: mkObj } = await supabase
      .from('matakuliah')
      .select('*')
      .eq('id', targetMKId)
      .neq('status_mk', false)
      .single();

    if (!mkObj) throw new Error('Mata kuliah aktif tidak ditemukan!');

    const { data: daftarTugas } = await supabase
      .from('daftartugas')
      .select('*')
      .eq('id_matakuliah', targetMKId)
      .order('created_at', { ascending: true });

    if (!daftarTugas || daftarTugas.length === 0) {
      alert('Mata kuliah ini belum memiliki daftar tugas!');
      hideLoading();
      return;
    }

    const { data: krsData } = await supabase
      .from('krsmatakuliah')
      .select('datamahasiswa(*)')
      .eq('id_matakuliah', targetMKId);

    const mhsList = (krsData || [])
      .map(k => k.datamahasiswa)
      .filter(mhs => mhs && mhs.status_mahasiswa !== false);

    mhsList.sort((a, b) => (a.npm_mahasiswa || '').localeCompare(b.npm_mahasiswa || ''));

    if (mhsList.length === 0) {
      alert('Belum ada mahasiswa aktif yang mengambil mata kuliah ini!');
      hideLoading();
      return;
    }

    const tugasIds = daftarTugas.map(t => t.id);
    const { data: rawNilai } = await supabase.from('penilaiantugas').select('*').in('id_daftartugas', tugasIds);

    const nilaiMap = new Map();
    (rawNilai || []).forEach(n => nilaiMap.set(`${n.id_datamahasiswa}_${n.id_daftartugas}`, n.nilai_tugas || 0));

    const rows = mhsList.map((mhs, idx) => {
      const rowObj = {
        no: idx + 1,
        npm: mhs.npm_mahasiswa,
        nama: mhs.nama_mahasiswa,
        scores: {},
        jumlah: 0,
        rataRata: 0
      };

      let total = 0;
      daftarTugas.forEach(t => {
        const score = nilaiMap.get(`${mhs.id}_${t.id}`) || 0;
        rowObj.scores[t.nama_tugas] = score;
        total += score;
      });

      rowObj.jumlah = total;
      rowObj.rataRata = (total / daftarTugas.length).toFixed(2);
      return rowObj;
    });

    if (type === 'excel') {
      const sheetRows = rows.map(r => {
        const payload = {
          'No': r.no,
          'NPM': r.npm,
          'Nama Mahasiswa': r.nama
        };

        daftarTugas.forEach(t => {
          payload[t.nama_tugas] = r.scores[t.nama_tugas];
        });

        payload['Jumlah'] = r.jumlah;
        payload['Rata-Rata'] = parseFloat(r.rataRata);

        return payload;
      });

      const worksheet = XLSX.utils.json_to_sheet(sheetRows);
      const workbook = XLSX.utils.book_new();
      const sheetName = `${mkObj.nama_mk}_${mkObj.kelas_mk || ''}`.replace(/[\/\\\?\*\[\]]/g, '').substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      XLSX.writeFile(workbook, `Rekap_Nilai_${mkObj.nama_mk.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);

    } else if (type === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      doc.setFontSize(14);
      doc.text(`REKAPITULASI NILAI TUGAS MAHASISWA`, 14, 12);
      doc.setFontSize(10);
      doc.text(`Mata Kuliah: ${mkObj.nama_mk} (${mkObj.kelas_mk || '-'})`, 14, 18);

      const tugasHeaders = daftarTugas.map(t => t.nama_tugas);
      const headers = [["No", "NPM", "Nama Mahasiswa", ...tugasHeaders, "Jumlah", "Rata-Rata"]];

      const body = rows.map(r => [
        r.no, r.npm, r.nama,
        ...daftarTugas.map(t => r.scores[t.nama_tugas]),
        r.jumlah, r.rataRata
      ]);

      doc.autoTable({
        startY: 22,
        head: headers,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25, halign: 'left' },
          2: { cellWidth: 45, halign: 'left' }
        }
      });

      doc.save(`Rekap_Nilai_${mkObj.nama_mk.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    }

    document.getElementById('modalEksporNilai')?.classList.add('hidden');
  } catch (err) {
    alert('Gagal menghasilkan rekap nilai: ' + err.message);
  } finally {
    hideLoading();
  }
}