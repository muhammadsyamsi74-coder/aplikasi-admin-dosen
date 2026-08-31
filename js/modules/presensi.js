// js/modules/presensi.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

let currentMahasiswaList = [];
let rawRiwayatGrouped = [];
let isViewRiwayat = false;

export async function initPresensi() {
  setTodayDate();
  await loadMataKuliahOptions();
  setupEventListeners();
  setupExportModalListeners();
}

function setTodayDate() {
  const inputTanggal = document.getElementById('presensiTanggal');
  if (inputTanggal) {
    inputTanggal.value = new Date().toISOString().split('T')[0];
  }
}

async function loadMataKuliahOptions() {
  const selectMK = document.getElementById('presensiSelectMK');
  const filterRiwayatMK = document.getElementById('filterRiwayatPresensiMK');
  const exportSelectMK = document.getElementById('exportPresensiSelectMK');

  // Hanya ambil Mata Kuliah yang statusnya aktif (status_mk !== false)
  const { data, error } = await supabase
    .from('matakuliah')
    .select('*')
    .neq('status_mk', false)
    .order('nama_mk', { ascending: true });

  if (error) { console.error(error); return; }

  const optionsHTML = data?.map(mk => `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk || '-'})</option>`).join('') || '';

  if (selectMK) selectMK.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>' + optionsHTML;
  if (filterRiwayatMK) filterRiwayatMK.innerHTML = '<option value="">-- Semua Mata Kuliah --</option>' + optionsHTML;
  if (exportSelectMK) exportSelectMK.innerHTML = '<option value="">-- Semua Mata Kuliah (Multi Sheet/Page) --</option>' + optionsHTML;
}

function setupEventListeners() {
  // Auto Load ketika ganti MK atau Tanggal
  document.getElementById('presensiSelectMK')?.addEventListener('change', autoLoadDaftarMahasiswa);
  document.getElementById('presensiTanggal')?.addEventListener('change', autoLoadDaftarMahasiswa);

  document.getElementById('btnSetAllHadir')?.addEventListener('click', setAllHadir);
  document.getElementById('btnSimpanPresensi')?.addEventListener('click', savePresensi);
  document.getElementById('btnToggleRiwayat')?.addEventListener('click', toggleViewPresensi);

  document.getElementById('filterRiwayatPresensiMK')?.addEventListener('change', (e) => {
    const mkId = e.target.value;
    const filtered = mkId ? rawRiwayatGrouped.filter(r => r.id_mk === mkId) : rawRiwayatGrouped;
    renderRiwayatTable(filtered);
  });

  document.getElementById('listPresensiTable')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-kehadiran');
    if (!btn) return;
    
    const mhsId = btn.getAttribute('data-mhs-id');
    const val = btn.getAttribute('data-val');
    
    const hiddenInput = document.querySelector(`.input-val-kehadiran[data-mhs-id="${mhsId}"]`);
    if (hiddenInput) hiddenInput.value = val;

    const row = btn.closest('tr');
    row.querySelectorAll('.btn-kehadiran').forEach(b => {
      b.className = 'btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
    });

    if (val === 'Hadir') btn.className = 'btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all bg-teal-500 text-white border-teal-600';
    if (val === 'Izin') btn.className = 'btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all bg-amber-500 text-white border-amber-600';
    if (val === 'Sakit') btn.className = 'btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all bg-blue-500 text-white border-blue-600';
    if (val === 'Alpha') btn.className = 'btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all bg-red-500 text-white border-red-600';
  });
}

function autoLoadDaftarMahasiswa() {
  const idMK = document.getElementById('presensiSelectMK')?.value;
  const container = document.getElementById('containerTabelPresensi');
  if (!idMK) {
    container?.classList.add('hidden');
    return;
  }
  loadDaftarMahasiswaPresensi();
}

async function toggleViewPresensi() {
  isViewRiwayat = !isViewRiwayat;
  const viewInput = document.getElementById('viewInputPresensi');
  const viewRiwayat = document.getElementById('viewRiwayatPresensi');
  const btnText = document.getElementById('textToggleRiwayat');
  const subtitle = document.getElementById('presensiSubtitle');

  if (isViewRiwayat) {
    viewInput.classList.add('hidden');
    viewRiwayat.classList.remove('hidden');
    btnText.innerText = 'Kembali ke Input';
    subtitle.innerText = 'Daftar riwayat absensi yang telah tersimpan di database.';
    await loadRiwayatData();
  } else {
    viewRiwayat.classList.add('hidden');
    viewInput.classList.remove('hidden');
    btnText.innerText = 'Lihat Riwayat Presensi';
    subtitle.innerText = 'Pencatatan absensi harian mahasiswa per mata kuliah dan rekapitulasi perkuliahan.';
  }
}

function getKehadiranButtonsHTML(mhsId, status) {
  const hActive = status === 'Hadir' ? 'bg-teal-500 text-white border-teal-600' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
  const iActive = status === 'Izin' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
  const sActive = status === 'Sakit' ? 'bg-blue-500 text-white border-blue-600' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
  const aActive = status === 'Alpha' ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';

  return `
    <div class="flex justify-center gap-1.5">
      <button type="button" class="btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all ${hActive}" data-mhs-id="${mhsId}" data-val="Hadir">H</button>
      <button type="button" class="btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all ${iActive}" data-mhs-id="${mhsId}" data-val="Izin">I</button>
      <button type="button" class="btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all ${sActive}" data-mhs-id="${mhsId}" data-val="Sakit">S</button>
      <button type="button" class="btn-kehadiran w-7 h-7 rounded font-bold text-xs border transition-all ${aActive}" data-mhs-id="${mhsId}" data-val="Alpha">A</button>
      <input type="hidden" class="input-val-kehadiran" data-mhs-id="${mhsId}" value="${status}">
    </div>
  `;
}

async function loadDaftarMahasiswaPresensi() {
  const idMK = document.getElementById('presensiSelectMK')?.value;
  const tanggal = document.getElementById('presensiTanggal')?.value;
  const container = document.getElementById('containerTabelPresensi');
  const tableBody = document.getElementById('listPresensiTable');

  if (!idMK || !tanggal) {
    container?.classList.add('hidden');
    return;
  }

  showLoading();
  try {
    const { data: krsData, error: krsErr } = await supabase
      .from('krsmatakuliah')
      .select('id_datamahasiswa, datamahasiswa(*)')
      .eq('id_matakuliah', idMK);

    if (krsErr) throw krsErr;

    // Filter hanya mahasiswa dengan status aktif (status_mahasiswa !== false)
    currentMahasiswaList = (krsData || [])
      .map(item => item.datamahasiswa)
      .filter(mhs => mhs && mhs.status_mahasiswa !== false);

    if (currentMahasiswaList.length === 0) {
      alert('Tidak ada mahasiswa aktif yang terdaftar di KRS mata kuliah ini.');
      container?.classList.add('hidden');
      return;
    }

    currentMahasiswaList.sort((a, b) => (a.nama_mahasiswa || '').localeCompare(b.nama_mahasiswa || ''));

    const { data: existingAbsen } = await supabase
      .from('presensimahasiswa')
      .select('*')
      .eq('id_matakuliah', idMK)
      .eq('tanggal_absensi', tanggal);

    const absenMap = new Map((existingAbsen || []).map(a => [a.id_datamahasiswa, a]));

    tableBody.innerHTML = '';
    currentMahasiswaList.forEach((mhs, idx) => {
      const existingRecord = absenMap.get(mhs.id);
      const statusKehadiran = existingRecord?.kehadiran || 'Hadir';
      const ket = existingRecord?.keterangan || '';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-all';
      tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 leading-tight">
          <div class="font-bold text-slate-800">${mhs.nama_mahasiswa}</div>
          <div class="font-mono text-[10px] font-extrabold text-teal-700">${mhs.npm_mahasiswa}</div>
        </td>
        <td class="p-3">${getKehadiranButtonsHTML(mhs.id, statusKehadiran)}</td>
        <td class="p-3">
          <input type="text" class="input-ket-presensi w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none" placeholder="Catatan..." value="${ket}" data-mhs-id="${mhs.id}">
        </td>
      `;
      tableBody.appendChild(tr);
    });

    container?.classList.remove('hidden');
  } catch (err) {
    alert('Gagal memuat daftar mahasiswa: ' + err.message);
  } finally {
    hideLoading();
  }
}

function setAllHadir() {
  document.querySelectorAll('.btn-kehadiran[data-val="Hadir"]').forEach(btn => btn.click());
}

async function savePresensi() {
  const idMK = document.getElementById('presensiSelectMK')?.value;
  const tanggal = document.getElementById('presensiTanggal')?.value;
  if (!idMK || !tanggal) return;

  showLoading();
  try {
    await supabase.from('presensimahasiswa').delete().eq('id_matakuliah', idMK).eq('tanggal_absensi', tanggal);

    const payload = currentMahasiswaList.map(mhs => {
      const hiddenInput = document.querySelector(`.input-val-kehadiran[data-mhs-id="${mhs.id}"]`);
      const inputKet = document.querySelector(`.input-ket-presensi[data-mhs-id="${mhs.id}"]`);
      return {
        id_matakuliah: idMK,
        id_datamahasiswa: mhs.id,
        tanggal_absensi: tanggal,
        kehadiran: hiddenInput ? hiddenInput.value : 'Hadir',
        keterangan: inputKet ? inputKet.value : ''
      };
    });

    const { error: presensiErr } = await supabase.from('presensimahasiswa').insert(payload);
    if (presensiErr) throw presensiErr;

    const { data: existingJurnal } = await supabase
      .from('jurnalmengajar')
      .select('id')
      .eq('id_matakuliah', idMK)
      .eq('tanggal_mengajar', tanggal)
      .maybeSingle();

    if (!existingJurnal) {
      const { count } = await supabase
        .from('jurnalmengajar')
        .select('*', { count: 'exact', head: true })
        .eq('id_matakuliah', idMK);

      const nextPertemuan = (count || 0) + 1;

      await supabase.from('jurnalmengajar').insert([{
        id_matakuliah: idMK,
        pertemuan_ke: nextPertemuan,
        tanggal_mengajar: tanggal,
        judul_materi: `[Draf] Perkuliahan Pertemuan ${nextPertemuan}`,
        tempat_mengajar: '-',
        deskripsi_materi: 'Draf otomatis dari input presensi perkuliahan.',
        refleksi_materi: '-'
      }]);
    }

    alert('Presensi berhasil disimpan dan draf Jurnal telah disinkronkan!');
  } catch (err) {
    alert('Gagal menyimpan presensi: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function loadRiwayatData() {
  showLoading();
  try {
    const { data, error } = await supabase
      .from('presensimahasiswa')
      .select('id_matakuliah, tanggal_absensi, kehadiran, matakuliah(nama_mk, kelas_mk, status_mk)')
      .order('tanggal_absensi', { ascending: false });
      
    if (error) throw error;

    const grouped = {};
    data.forEach(row => {
      const key = `${row.id_matakuliah}_${row.tanggal_absensi}`;
      if (!grouped[key]) {
        grouped[key] = {
          id_mk: row.id_matakuliah,
          tanggal: row.tanggal_absensi,
          nama_mk: row.matakuliah?.nama_mk,
          kelas_mk: row.matakuliah?.kelas_mk,
          H: 0, I: 0, S: 0, A: 0
        };
      }
      if (row.kehadiran === 'Hadir') grouped[key].H++;
      if (row.kehadiran === 'Izin') grouped[key].I++;
      if (row.kehadiran === 'Sakit') grouped[key].S++;
      if (row.kehadiran === 'Alpha') grouped[key].A++;
    });

    rawRiwayatGrouped = Object.values(grouped);
    renderRiwayatTable(rawRiwayatGrouped);
  } catch (err) {
    alert('Gagal memuat riwayat: ' + err.message);
  } finally {
    hideLoading();
  }
}

function renderRiwayatTable(records) {
  const tableBody = document.getElementById('listRiwayatPresensi');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic text-xs">Belum ada riwayat presensi.</td></tr>`;
    return;
  }

  records.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-all';
    tr.innerHTML = `
      <td class="p-3 font-bold text-amber-600">${item.tanggal}</td>
      <td class="p-3 font-bold text-slate-800">${item.nama_mk || '-'} <br/><span class="text-[10px] text-slate-500 font-normal">(${item.kelas_mk})</span></td>
      <td class="p-3 text-center">
        <div class="flex justify-center gap-2 text-[10px] font-extrabold">
          <span class="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">H: ${item.H}</span>
          <span class="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">S: ${item.S}</span>
          <span class="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">I: ${item.I}</span>
          <span class="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">A: ${item.A}</span>
        </div>
      </td>
      <td class="p-3">
        <div class="flex justify-center items-center gap-1.5">
          <button class="btn-edit-riwayat p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-all" data-mk="${item.id_mk}" data-tgl="${item.tanggal}" title="Edit Presensi">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          </button>
          <button class="btn-hapus-riwayat p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all" data-mk="${item.id_mk}" data-tgl="${item.tanggal}" title="Hapus Presensi">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit-riwayat').forEach(b => {
    b.addEventListener('click', () => {
      const mkId = b.getAttribute('data-mk');
      const tgl = b.getAttribute('data-tgl');
      toggleViewPresensi();
      document.getElementById('presensiSelectMK').value = mkId;
      document.getElementById('presensiTanggal').value = tgl;
      loadDaftarMahasiswaPresensi();
    });
  });

  document.querySelectorAll('.btn-hapus-riwayat').forEach(b => {
    b.addEventListener('click', async () => {
      const mkId = b.getAttribute('data-mk');
      const tgl = b.getAttribute('data-tgl');
      if (confirm('Apakah Anda yakin ingin menghapus seluruh data presensi untuk kelas dan tanggal ini?')) {
        showLoading();
        await supabase.from('presensimahasiswa').delete().eq('id_matakuliah', mkId).eq('tanggal_absensi', tgl);
        await loadRiwayatData();
        hideLoading();
      }
    });
  });
}

function setupExportModalListeners() {
  const modal = document.getElementById('modalEksporPresensi');
  const btnOpen = document.getElementById('btnOpenModalEksporPresensi');
  const btnClose = document.getElementById('btnCloseModalEksporPresensi');
  const modeWaktu = document.getElementById('exportPresensiModeWaktu');
  const subTanggal = document.getElementById('subPresensiFilterTanggal');
  const subBulan = document.getElementById('subPresensiFilterBulan');

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

  document.getElementById('btnDoExportPresensiExcel')?.addEventListener('click', () => generatePresensiReport('excel'));
  document.getElementById('btnDoExportPresensiPDF')?.addEventListener('click', () => generatePresensiReport('pdf'));
}

async function generatePresensiReport(type) {
  showLoading();
  try {
    const targetMKId = document.getElementById('exportPresensiSelectMK')?.value || '';
    const modeWaktu = document.getElementById('exportPresensiModeWaktu')?.value || 'semua';

    // Hanya ambil MK aktif untuk laporan
    let mkQuery = supabase.from('matakuliah').select('*').neq('status_mk', false).order('nama_mk');
    if (targetMKId) mkQuery = mkQuery.eq('id', targetMKId);
    const { data: mkList } = await mkQuery;

    if (!mkList || mkList.length === 0) {
      alert('Mata kuliah aktif tidak ditemukan!');
      hideLoading();
      return;
    }

    let presensiQuery = supabase.from('presensimahasiswa').select('*, datamahasiswa(*)');
    
    if (modeWaktu === 'tanggal') {
      const tglMulai = document.getElementById('exportPresensiTglMulai')?.value;
      const tglSelesai = document.getElementById('exportPresensiTglSelesai')?.value;
      if (tglMulai) presensiQuery = presensiQuery.gte('tanggal_absensi', tglMulai);
      if (tglSelesai) presensiQuery = presensiQuery.lte('tanggal_absensi', tglSelesai);
    }

    const { data: rawPresensi } = await presensiQuery;

    let filteredPresensi = rawPresensi || [];
    if (modeWaktu === 'bulan') {
      const bln = parseInt(document.getElementById('exportPresensiBulan')?.value || '1');
      const thn = parseInt(document.getElementById('exportPresensiTahun')?.value || '2026');
      filteredPresensi = filteredPresensi.filter(p => {
        if (!p.tanggal_absensi) return false;
        const d = new Date(p.tanggal_absensi);
        return (d.getMonth() + 1 === bln && d.getFullYear() === thn);
      });
    }

    const reportDataPerMK = [];

    for (const mk of mkList) {
      const { data: krsData } = await supabase.from('krsmatakuliah').select('datamahasiswa(*)').eq('id_matakuliah', mk.id);
      
      // Hanya menyertakan mahasiswa aktif dalam laporan rekap
      const mhsList = (krsData || [])
        .map(k => k.datamahasiswa)
        .filter(mhs => mhs && mhs.status_mahasiswa !== false);

      mhsList.sort((a, b) => (a.nama_mahasiswa || '').localeCompare(b.nama_mahasiswa || ''));

      if (mhsList.length === 0) continue;

      const mkPresensi = filteredPresensi.filter(p => p.id_matakuliah === mk.id);
      const datesSet = new Set(mkPresensi.map(p => p.tanggal_absensi));
      const sortedDates = Array.from(datesSet).sort();

      const statusMap = new Map();
      mkPresensi.forEach(p => statusMap.set(`${p.id_datamahasiswa}_${p.tanggal_absensi}`, p.kehadiran));

      const rows = mhsList.map((mhs, idx) => {
        const rowObj = {
          no: idx + 1,
          npm: mhs.npm_mahasiswa,
          nama: mhs.nama_mahasiswa,
          datesStatus: {},
          H: 0, S: 0, I: 0, A: 0
        };

        sortedDates.forEach(d => {
          const st = statusMap.get(`${mhs.id}_${d}`) || '-';
          let symbol = '-';
          if (st === 'Hadir') { symbol = 'H'; rowObj.H++; }
          else if (st === 'Sakit') { symbol = 'S'; rowObj.S++; }
          else if (st === 'Izin') { symbol = 'I'; rowObj.I++; }
          else if (st === 'Alpha') { symbol = 'A'; rowObj.A++; }

          rowObj.datesStatus[d] = symbol;
        });

        return rowObj;
      });

      reportDataPerMK.push({
        mkInfo: mk,
        dates: sortedDates,
        rows: rows
      });
    }

    if (reportDataPerMK.length === 0) {
      alert('Tidak ada data presensi yang memenuhi kriteria filter!');
      hideLoading();
      return;
    }

    if (type === 'excel') {
      const workbook = XLSX.utils.book_new();

      reportDataPerMK.forEach(item => {
        const sheetRows = item.rows.map(r => {
          const rowPayload = {
            'No': r.no,
            'NPM': r.npm,
            'Nama Mahasiswa': r.nama
          };
          item.dates.forEach(d => {
            rowPayload[d] = r.datesStatus[d] || '-';
          });
          rowPayload['H'] = r.H;
          rowPayload['S'] = r.S;
          rowPayload['I'] = r.I;
          rowPayload['A'] = r.A;

          return rowPayload;
        });

        const worksheet = XLSX.utils.json_to_sheet(sheetRows);
        const sheetName = `${item.mkInfo.nama_mk}_${item.mkInfo.kelas_mk || ''}`.replace(/[\/\\\?\*\[\]]/g, '').substring(0, 30);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      XLSX.writeFile(workbook, `Rekap_Presensi_Matriks_${Date.now()}.xlsx`);

    } else if (type === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      reportDataPerMK.forEach((item, index) => {
        if (index > 0) doc.addPage();

        doc.setFontSize(12);
        doc.text(`REKAPITULASI PRESENSI MAHASISWA`, 14, 12);
        doc.setFontSize(10);
        doc.text(`Mata Kuliah: ${item.mkInfo.nama_mk} (${item.mkInfo.kelas_mk || '-'})`, 14, 18);

        const headers = [["No", "NPM", "Nama Mahasiswa", ...item.dates, "H", "S", "I", "A"]];
        const body = item.rows.map(r => [
          r.no, r.npm, r.nama,
          ...item.dates.map(d => r.datesStatus[d] || '-'),
          r.H, r.S, r.I, r.A
        ]);

        doc.autoTable({
          startY: 22,
          head: headers,
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [13, 148, 136] },
          styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 22, halign: 'left' },
            2: { cellWidth: 40, halign: 'left' }
          }
        });
      });

      doc.save(`Rekap_Presensi_Matriks_${Date.now()}.pdf`);
    }

    document.getElementById('modalEksporPresensi')?.classList.add('hidden');
  } catch (err) {
    alert('Gagal menghasilkan laporan: ' + err.message);
  } finally {
    hideLoading();
  }
}