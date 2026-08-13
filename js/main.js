// js/main.js
import { supabase } from './config.js';
import { initMaster } from './modules/master.js';
import { initPresensi } from './modules/presensi.js';
import { initJurnal } from './modules/jurnal.js';
import { initPenilaian } from './modules/penilaian.js';

const BUCKET_NAME = 'lampiran_aplikasiika';
let profileDataId = null;
let currentNamaDosen = ''; // Menyimpan nama dosen dari database untuk validasi

// INDIKATOR LOADING NON-BLOCKING (TITIK KEDIP)
export function showLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.remove('hidden');
}

export function hideLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.add('hidden');
}

// 1. MEMUAT PROFIL DOSEN & TAGLINE
async function loadProfilDosen() {
  try {
    const { data, error } = await supabase
      .from('pengaturanprofil')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      profileDataId = data.id;
      currentNamaDosen = data.nama_dosen || '';
      
      const elNama = document.getElementById('textNamaDosen');
      const elKampus = document.getElementById('textNamaKampus');
      const elTagline = document.getElementById('textTaglineProfile');

      if (elNama) elNama.innerText = data.nama_dosen || 'Nama Dosen Belum Set';
      if (elKampus) elKampus.innerText = data.nama_kampus || 'Nama Kampus Belum Set';
      if (elTagline) elTagline.innerText = data.tagline_profile || 'Tagline belum diatur...';

      const imgEl = document.getElementById('avatarProfilImg');
      const textInisial = document.getElementById('avatarInisialText');

      if (data.link_fotoprofil && data.link_fotoprofil !== '-' && data.link_fotoprofil !== 'NULL') {
        imgEl.src = data.link_fotoprofil;
        imgEl.classList.remove('hidden');
        textInisial.classList.add('hidden');
      } else {
        const nama = data.nama_dosen || 'AD';
        const words = nama.trim().split(' ');
        let inisial = words[0][0];
        if (words.length > 1) inisial += words[1][0];
        
        textInisial.innerText = inisial.toUpperCase();
        textInisial.classList.remove('hidden');
        imgEl.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan profil:', err.message);
  }
}

// 2. KLIK 5X + VALIDASI TEKS KOSONG TANPA KETERANGAN
function setupMultiClickAvatar() {
  const avatarContainer = document.getElementById('avatarProfilContainer');
  const hiddenInputFile = document.getElementById('inputFotoProfilHidden');

  if (!avatarContainer || !hiddenInputFile) return;

  let clickCount = 0;
  let resetTimer = null;

  avatarContainer.addEventListener('click', (e) => {
    e.preventDefault();
    clickCount++;

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      clickCount = 0;
    }, 1500);

    // Tepat pada klik ke-5
    if (clickCount === 5) {
      clickCount = 0;
      if (resetTimer) clearTimeout(resetTimer);

      // Munculkan input dialog KOSONG tanpa teks petunjuk
      const inputVerification = prompt("");

      // Cek apakah teks cocok dengan nama_dosen di database
      if (inputVerification !== null && inputVerification.trim() === currentNamaDosen.trim()) {
        hiddenInputFile.click(); // Cocok! Buka dialog upload
      }
      // Jika salah atau batal, kembalikan saja seolah tidak terjadi apa-apa
    }
  });

  // Event saat berkas gambar dipilih
  hiddenInputFile.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
        alert('File yang dipilih wajib berupa Gambar (PNG, JPG, JPEG)!');
        return;
      }

      showLoading();
      try {
        const compressedFile = await compressImageAvatar(file, 150, 0.7);

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `avatar_${Date.now()}_${cleanFileName}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, compressedFile);

        if (uploadErr) throw uploadErr;

        const { data: publicURLData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        const photoURL = publicURLData.publicUrl;

        if (profileDataId) {
          await supabase
            .from('pengaturanprofil')
            .update({ link_fotoprofil: photoURL })
            .eq('id', profileDataId);
        } else {
          await supabase
            .from('pengaturanprofil')
            .insert([{ link_fotoprofil: photoURL }]);
        }

        await loadProfilDosen();
        alert('Foto Profil Berhasil Diperbarui!');
      } catch (err) {
        alert('Gagal memperbarui foto profil: ' + err.message);
      } finally {
        hideLoading();
        hiddenInputFile.value = '';
      }
    }
  });
}

function compressImageAvatar(file, maxDimension = 150, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxDimension;
        canvas.height = maxDimension;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, maxDimension, maxDimension);

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

// 3. ROUTER NAVIGASI UTAMA
export async function navigateTo(menuName) {
  showLoading();
  const appContent = document.getElementById('app-content');

  try {
    const response = await fetch(`components/${menuName}.html`);
    if (!response.ok) throw new Error(`File components/${menuName}.html tidak ditemukan.`);
    
    const htmlContent = await response.text();
    appContent.innerHTML = htmlContent;

    document.querySelectorAll('.nav-trigger').forEach(btn => {
      if (btn.getAttribute('data-menu') === menuName) {
        btn.classList.add('bg-amber-400', 'text-slate-900', 'shadow-sm');
        btn.classList.remove('text-slate-600');
      } else {
        btn.classList.remove('bg-amber-400', 'text-slate-900', 'shadow-sm');
        btn.classList.add('text-slate-600');
      }
    });

    if (menuName === 'master' && typeof initMaster === 'function') {
      await initMaster();
    } else if (menuName === 'presensi' && typeof initPresensi === 'function') {
      await initPresensi();
    } else if (menuName === 'jurnal' && typeof initJurnal === 'function') {
      await initJurnal();
    } else if (menuName === 'penilaian' && typeof initPenilaian === 'function') {
      await initPenilaian();
    }

  } catch (err) {
    console.error('Routing Error:', err);
  } finally {
    hideLoading();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadProfilDosen();
  setupMultiClickAvatar();

  document.querySelectorAll('.nav-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetMenu = btn.getAttribute('data-menu');
      if (targetMenu) {
        navigateTo(targetMenu);
      }
    });
  });

  navigateTo('presensi');
});