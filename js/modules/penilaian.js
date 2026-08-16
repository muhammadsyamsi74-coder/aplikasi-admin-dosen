// js/modules/penilaian.js
import { supabase } from '../config.js';
import { showLoading, hideLoading } from '../main.js';

let currentMhsNilaiList = [];
let allTugasData = [];

const BUCKET_NAME = 'lampiran_aplikasiika';

export async function initPenilaian() {
  await loadMKOptions();
  await loadTugasSelectOptions();
  setupEventListeners();
  setupExportModalListeners();
  setupAccordionMobile();
}

// LOGIKA BUKA/TUTUP FORM TUGAS DI MOBILE
function setupAccordionMobile() {
  const btnToggle = document.getElementById('btnToggleFormTugasMobile');
  const wrapper = document.getElementById('wrapperFormTugas');
  const label = document.getElementById('labelStatusToggleTugas');
  const icon = document.getElementById('iconArrowToggleTugas');

  if (!btnToggle || !wrapper) return;

  btnToggle.addEventListener('click', () => {
    // Hanya berlaku di layar kecil (mobile)
    if (window.innerWidth >= 768) return;

    const isHidden = wrapper.classList.contains('hidden');
    if (isHidden) {
      wrapper.classList.remove('hidden');
      if (label) {
        label.innerText = 'Tutup Form';
        label.className = 'text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full';
      }
      if (icon) icon.classList.add('rotate-180');
    } else {
      wrapper.classList.add('hidden');
      if (label) {
        label.innerText = 'Buka Form';
        label.className = 'text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full';
      }
      if (icon) icon.classList.remove('rotate-180');
    }
  });
}

async function loadMKOptions() {
  const select1 = document.getElementById('tugasSelectMK');
  const select2 = document.getElementById('filterMKPenilaian');
  const select3 = document.getElementById('exportNilaiSelectMK');
  if (!select1 || !select2) return;

  const { data } = await supabase.from('matakuliah').select('*').order('nama_mk');
  const optionsHTML = data?.map(mk => `<option value="${mk.id}">${mk.nama_mk} (${mk.kelas_mk})</option>`).join('') || '';
  
  select1.innerHTML = '<option value="">-- Pilih Mata Kuliah --</option>' + optionsHTML;
  select2.innerHTML = '<option value="">-- Semua Mata Kuliah --</option>' + optionsHTML;
  if (select3) select3.innerHTML = '<option value="">-- Pilih 1 Mata Kuliah --</option>' + optionsHTML;
}

async function loadTugasSelectOptions(filterMKId = '') {
  const select = document.getElementById('selectDaftarTugasTarget');
  if (!select) return;

  let query = supabase.from('daftartugas').select('*, matakuliah(nama_mk, kelas_mk)').order('created_at', { ascending: false });
  if (filterMKId) query = query.eq('id_matakuliah', filterMKId);

  const { data } = await query;
  allTugasData = data || [];

  select.innerHTML = '<option value="">-- Pilih Tugas --</option>';
  allTugasData.forEach(t => {
    select.innerHTML += `<option value="${t.id}" data-mk-id="${t.id_matakuliah}">${t.nama_tugas} - [${t.matakuliah?.nama_mk || ''}]</option>`;
  });
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
  document.getElementById('filterMKPenilaian')?.addEventListener('change', (e) => {
    loadTugasSelectOptions(e.target.value);
    document.getElementById('containerInputNilai')?.classList.add('hidden');
  });

  document.getElementById('formDaftarTugas')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    try {
      const fileInput = document.getElementById('tugas_lampiran_file');
      let lampiranURL = '-';

      if (fileInput?.files?.length > 0) {
        let file = fileInput.files[0];
        const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.pdf|\.doc|\.docx)$/i;
        if (!allowedExtensions.exec(file.name)) {
          alert('Format file tidak didukung!');
          hideLoading();
          return;
        }

        file = await compressImage(file);
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `soal_${Date.now()}_${cleanFileName}`;
        
        const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
        if (uploadErr) throw new Error('Gagal unggah berkas: ' + uploadErr.message);

        const { data: publicURLData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        lampiranURL = publicURLData.publicUrl;
      }

      const payload = {
        id_matakuliah: document.getElementById('tugasSelectMK').value,
        nama_tugas: document.getElementById('tugas_nama').value,
        lampiran_tugas: lampiranURL
      };

      const { error: insertErr } = await supabase.from('daftartugas').insert([payload]);
      if (insertErr) throw insertErr;

      document.getElementById('formDaftarTugas').reset();
      await loadTugasSelectOptions();
      
      // Tutup kembali accordion di mobile setelah submit berhasil
      if (window.innerWidth < 768) {
        document.getElementById('wrapperFormTugas')?.classList.add('hidden');
        const label = document.getElementById('labelStatusToggleTugas');
        if (label) {
          label.innerText = 'Buka Form';
          label.className = 'text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full';
        }
        document.getElementById('iconArrowToggleTugas')?.classList.remove('rotate-180');
      }

      alert('Judul Tugas & Lampiran Soal Berhasil Disimpan!');
    } catch (err) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      hideLoading();
    }
  });

  const selectTugas = document.getElementById('selectDaftarTugasTarget');
  selectTugas?.addEventListener('change', async () => {
    const idTugas = selectTugas.value;
    const selectedOpt = selectTugas.options[selectTugas.selectedIndex];
    const idMK = selectedOpt?.getAttribute('data-mk-id');
    
    const container = document.getElementById('containerInputNilai');
    if (!idTugas || !idMK) { container?.classList.add('hidden'); return; }
    
    container?.classList.remove('hidden');

    const tugasObj = allTugasData.find(t => t.id === idTugas);
    const boxLampiran = document.getElementById('infoLampiranSoal');
    const linkLampiran = document.getElementById('linkLampiranSoal');
    
    if (tugasObj && tugasObj.lampiran_tugas && tugasObj.lampiran_tugas !== '-') {
      boxLampiran.classList.remove('hidden');
      linkLampiran.href = tugasObj.lampiran_tugas;
    } else {
      boxLampiran.classList.add('hidden');
    }

    await loadTabelNilai(idTugas, idMK);
  });

  document.getElementById('btnSimpanNilaiMassal')?.addEventListener('click', saveNilaiMassal);
}

async function loadTabelNilai(idTugas, idMK) {
  showLoading();
  const tableBody = document.getElementById('listInputNilaiTable');

  const { data: krsData } = await supabase.from('krsmatakuliah').select('datamahasiswa(*)').eq('id_matakuliah', idMK);
  currentMhsNilaiList = (krsData || []).map(k => k.datamahasiswa).filter(Boolean);

  const { data: nilaiData } = await supabase.from('penilaiantugas').select('*').eq('id_daftartugas', idTugas);
  const nilaiMap = new Map((nilaiData || []).map(n => [n.id_datamahasiswa, n]));

  tableBody.innerHTML = '';
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
    const { data: mkObj } = await supabase.from('matakuliah').select('*').eq('id', targetMKId).single();
    if (!mkObj) throw new Error('Mata kuliah tidak ditemukan!');

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

    const { data: krsData } = await supabase.from('krsmatakuliah').select('datamahasiswa(*)').eq('id_matakuliah', targetMKId);
    const mhsList = (krsData || []).map(k => k.datamahasiswa).filter(Boolean);
    mhsList.sort((a, b) => a.npm_mahasiswa.localeCompare(b.npm_mahasiswa));

    if (mhsList.length === 0) {
      alert('Belum ada mahasiswa yang mengambil mata kuliah ini!');
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
      const sheetName = `${mkObj.nama_mk}_${mkObj.kelas_mk}`.replace(/[\/\\\?\*\[\]]/g, '').substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      XLSX.writeFile(workbook, `Rekap_Nilai_${mkObj.nama_mk.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);

    } else if (type === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');

      doc.setFontSize(14);
      doc.text(`REKAPITULASI NILAI TUGAS MAHASISWA`, 14, 12);
      doc.setFontSize(10);
      doc.text(`Mata Kuliah: ${mkObj.nama_mk} (${mkObj.kelas_mk})`, 14, 18);

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