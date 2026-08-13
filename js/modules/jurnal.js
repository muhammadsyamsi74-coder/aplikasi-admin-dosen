// js/modules/jurnal.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

let rawJurnalData = []; // Menampung seluruh data jurnal dari DB

export async function initJurnal() {
  setTodayDate();
  await loadMKOptions();
  await loadJurnalList();
  setupFormListener();
  setupFilterAndExportListeners();
}

function setTodayDate() {
  const el = document.getElementById('jurnal_tanggal');
  if (el) el.value = new Date().toISOString().split('T')[0];
}

async function loadMKOptions() {
  const select1 = document.getElementById('jurnalSelectMK');
  const select2 = document.getElementById('filterRiwayatMK');
  const select3 = document.getElementById('exportSelectMK');

  const { data } = await supabase.from('matakuliah').select('*').order('nama_mk');
  const optionsHTML = data?.map(mk => `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk})</option>`).join('') || '';

  if (select1) select1.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>' + optionsHTML;
  if (select2) select2.innerHTML = '<option value="">-- Semua Mata Kuliah --</option>' + optionsHTML;
  if (select3) select3.innerHTML = '<option value="">-- Semua Mata Kuliah (Default) --</option>' + optionsHTML;
}

// 1. TARIK DATA DARI DATABASE SUPABASE
async function loadJurnalList() {
  const { data, error } = await supabase
    .from('jurnalmengajar')
    .select('*, matakuliah(nama_mk, kelas_mk)')
    .order('tanggal_mengajar', { ascending: false });

  if (error) { console.error(error); return; }

  rawJurnalData = data || [];
  renderTabelRiwayat(rawJurnalData);
}

// 2. RENDER TABEL DENGAN FILTER & SEARCHBOX
function renderTabelRiwayat(dataList) {
  const tableBody = document.getElementById('listJurnalTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (dataList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic text-xs">Tidak ada data jurnal yang sesuai.</td></tr>`;
    return;
  }

  dataList.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-3 w-20">
        <div class="font-extrabold text-amber-600">Ke-${item.pertemuan_ke}</div>
        <div class="text-[10px] text-slate-400">${item.tanggal_mengajar || '-'}</div>
      </td>
      <td class="p-3 font-bold text-slate-800">${item.matakuliah?.nama_mk || '-'} <br/><span class="text-[10px] text-slate-500 font-normal">(${item.matakuliah?.kelas_mk})</span></td>
      <td class="p-3">
        <div class="font-bold text-slate-800">${item.judul_materi}</div>
        <div class="text-[10px] text-slate-500 truncate max-w-[12rem]">${item.deskripsi_materi || '-'}</div>
      </td>
      <td class="p-3">
        <div class="flex justify-center items-center gap-1.5">
          <button class="btn-edit-jurnal p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-all" data-id="${item.id}" title="Edit Jurnal">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </button>
          <button class="btn-hapus-jurnal p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all" data-id="${item.id}" title="Hapus Jurnal">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  // Attach Event Edit & Hapus
  document.querySelectorAll('.btn-edit-jurnal').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      const item = rawJurnalData.find(d => d.id === id);
      if (item) {
        document.getElementById('jurnal_id').value = item.id;
        document.getElementById('jurnalSelectMK').value = item.id_matakuliah;
        document.getElementById('jurnal_pertemuan').value = item.pertemuan_ke;
        document.getElementById('jurnal_tanggal').value = item.tanggal_mengajar;
        document.getElementById('jurnal_judul').value = item.judul_materi;
        document.getElementById('jurnal_tempat').value = item.tempat_mengajar === '-' ? '' : item.tempat_mengajar;
        document.getElementById('jurnal_deskripsi').value = item.deskripsi_materi === '-' ? '' : item.deskripsi_materi;
        document.getElementById('jurnal_refleksi').value = item.refleksi_materi === '-' ? '' : item.refleksi_materi;

        document.getElementById('btnBatalJurnal').classList.remove('hidden');
        document.getElementById('formJurnalTitle').innerText = 'Edit Jurnal Mengajar';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  document.querySelectorAll('.btn-hapus-jurnal').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus catatan jurnal ini?')) {
        showLoading();
        await supabase.from('jurnalmengajar').delete().eq('id', b.dataset.id);
        await loadJurnalList();
        hideLoading();
      }
    });
  });
}

// 3. LISTENERS UNTUK FILTER, CARI, DAN MODAL EKSPOR
function setupFilterAndExportListeners() {
  const filterMK = document.getElementById('filterRiwayatMK');
  const searchInput = document.getElementById('searchRiwayatText');

  const applyTableFilter = () => {
    const mkVal = filterMK?.value || '';
    const q = searchInput?.value.toLowerCase().trim() || '';

    const filtered = rawJurnalData.filter(item => {
      const matchMK = !mkVal || item.id_matakuliah === mkVal;
      const matchText = !q || 
        (item.judul_materi && item.judul_materi.toLowerCase().includes(q)) ||
        (item.matakuliah?.nama_mk && item.matakuliah.nama_mk.toLowerCase().includes(q)) ||
        (item.deskripsi_materi && item.deskripsi_materi.toLowerCase().includes(q));

      return matchMK && matchText;
    });

    renderTabelRiwayat(filtered);
  };

  filterMK?.addEventListener('change', applyTableFilter);
  searchInput?.addEventListener('input', applyTableFilter);

  // MODAL EKSPOR CONTROLLER
  const modal = document.getElementById('modalEksporJurnal');
  const btnOpen = document.getElementById('btnOpenModalEksporJurnal');
  const btnClose = document.getElementById('btnCloseModalEkspor');
  const modeWaktu = document.getElementById('exportModeWaktu');
  const subTanggal = document.getElementById('subFilterTanggal');
  const subBulan = document.getElementById('subFilterBulan');

  btnOpen?.addEventListener('click', () => modal?.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => modal?.classList.add('hidden'));

  modeWaktu?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'tanggal') {
      subTanggal?.classList.remove('hidden');
      subBulan?.classList.add('hidden');
    } else if (val === 'bulan') {
      subBulan?.classList.remove('hidden');
      subTanggal?.classList.add('hidden');
    } else {
      subTanggal?.classList.add('hidden');
      subBulan?.classList.add('hidden');
    }
  });

  document.getElementById('btnDoExportExcel')?.addEventListener('click', () => exportJurnalData('excel'));
  document.getElementById('btnDoExportPDF')?.addEventListener('click', () => exportJurnalData('pdf'));
}

// 4. LOGIKA FILTERING EKSPOR & GENERATE EXCEL / PDF
function getFilteredExportData() {
  const mkId = document.getElementById('exportSelectMK')?.value || '';
  const modeWaktu = document.getElementById('exportModeWaktu')?.value || 'semua';

  return rawJurnalData.filter(item => {
    // Filter MK
    if (mkId && item.id_matakuliah !== mkId) return false;

    // Filter Waktu
    if (modeWaktu === 'tanggal') {
      const tglMulai = document.getElementById('exportTglMulai')?.value;
      const tglSelesai = document.getElementById('exportTglSelesai')?.value;
      if (tglMulai && item.tanggal_mengajar < tglMulai) return false;
      if (tglSelesai && item.tanggal_mengajar > tglSelesai) return false;
    } else if (modeWaktu === 'bulan') {
      const bulan = parseInt(document.getElementById('exportBulan')?.value || '1');
      const tahun = parseInt(document.getElementById('exportTahun')?.value || '2026');
      
      if (item.tanggal_mengajar) {
        const d = new Date(item.tanggal_mengajar);
        if (d.getMonth() + 1 !== bulan || d.getFullYear() !== tahun) return false;
      }
    }

    return true;
  });
}

function exportJurnalData(type) {
  const filteredData = getFilteredExportData();

  if (filteredData.length === 0) {
    alert('Tidak ada data jurnal yang memenuhi kriteria filter!');
    return;
  }

  // Format array data untuk tabel laporan
  const reportRows = filteredData.map((item, idx) => {
    const judulDanDeskripsi = `${item.judul_materi || ''}\n${item.deskripsi_materi && item.deskripsi_materi !== '-' ? '(' + item.deskripsi_materi + ')' : ''}`.trim();
    return {
      no: idx + 1,
      mk: `${item.matakuliah?.nama_mk || '-'} (${item.matakuliah?.kelas_mk || '-'})`,
      tanggal: item.tanggal_mengajar || '-',
      pertemuan: `Ke-${item.pertemuan_ke}`,
      materi: judulDanDeskripsi,
      ket: item.refleksi_materi || '-'
    };
  });

  if (type === 'excel') {
    // GENERATE EXCEL (.XLSX) VIA SHEETJS
    const excelPayload = reportRows.map(r => ({
      'No': r.no,
      'Mata Kuliah': r.mk,
      'Tanggal': r.tanggal,
      'Pertemuan Ke': r.pertemuan,
      'Judul & Deskripsi Materi': r.materi,
      'Catatan Evaluasi / Ket.': r.ket
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelPayload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jurnal Perkuliahan");
    XLSX.writeFile(workbook, `Jurnal_Perkuliahan_${Date.now()}.xlsx`);

  } else if (type === 'pdf') {
    // GENERATE PDF VIA JSPDF & AUTOTABLE
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(14);
    doc.text("LAPORAN JURNAL PERKULIAHAN DOSEN", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

    const tableHeaders = [["No", "Mata Kuliah", "Tanggal", "Pertemuan", "Judul & Deskripsi Materi", "Keterangan Evaluasi"]];
    const tableBody = reportRows.map(r => [r.no, r.mk, r.tanggal, r.pertemuan, r.materi, r.ket]);

    doc.autoTable({
      startY: 26,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] }, // Warna Amber
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 100 },
        5: { cellWidth: 60 }
      }
    });

    doc.save(`Jurnal_Perkuliahan_${Date.now()}.pdf`);
  }

  document.getElementById('modalEksporJurnal')?.classList.add('hidden');
}

function setupFormListener() {
  const form = document.getElementById('formJurnal');
  const btnBatal = document.getElementById('btnBatalJurnal');
  const selectMK = document.getElementById('jurnalSelectMK');

  selectMK?.addEventListener('change', async (e) => {
    const idMK = e.target.value;
    const inputPertemuan = document.getElementById('jurnal_pertemuan');
    if (!idMK) { inputPertemuan.value = ''; return; }
    
    const { count, error } = await supabase
      .from('jurnalmengajar')
      .select('*', { count: 'exact', head: true })
      .eq('id_matakuliah', idMK);

    inputPertemuan.value = !error ? (count || 0) + 1 : 1;
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const id = document.getElementById('jurnal_id').value;
    const payload = {
      id_matakuliah: document.getElementById('jurnalSelectMK').value,
      pertemuan_ke: parseInt(document.getElementById('jurnal_pertemuan').value),
      tanggal_mengajar: document.getElementById('jurnal_tanggal').value,
      judul_materi: document.getElementById('jurnal_judul').value,
      tempat_mengajar: document.getElementById('jurnal_tempat').value.trim() || '-',
      deskripsi_materi: document.getElementById('jurnal_deskripsi').value.trim() || '-',
      refleksi_materi: document.getElementById('jurnal_refleksi').value.trim() || '-',
    };

    if (id) {
      await supabase.from('jurnalmengajar').update(payload).eq('id', id);
    } else {
      await supabase.from('jurnalmengajar').insert([payload]);
    }

    form.reset();
    document.getElementById('jurnal_id').value = '';
    btnBatal.classList.add('hidden');
    document.getElementById('formJurnalTitle').innerText = 'Tambah Jurnal Mengajar';
    setTodayDate();
    await loadJurnalList();
    hideLoading();
  });

  btnBatal?.addEventListener('click', () => {
    form.reset();
    document.getElementById('jurnal_id').value = '';
    btnBatal.classList.add('hidden');
    document.getElementById('formJurnalTitle').innerText = 'Tambah Jurnal Mengajar';
    setTodayDate();
  });
}