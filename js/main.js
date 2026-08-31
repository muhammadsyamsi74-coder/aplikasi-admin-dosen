// js/main.js
import { supabase } from './config.js';
import { initMaster } from './modules/master.js';
import { initPresensi } from './modules/presensi.js';
import { initJurnal } from './modules/jurnal.js';
import { initPenilaian } from './modules/penilaian.js';

const BUCKET_NAME = 'lampiran_aplikasiika';
let profileDataId = null;
let currentNamaDosen = '';
let currentActiveMenu = '';
let isNavigating = false;

// In-memory cache untuk komponen HTML agar tidak fetch berulang kali
const componentCache = new Map();

export function showLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.remove('hidden');
}

export function hideLoading() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.add('hidden');
}

// LOGIKA GEMBOK LOGIN KEAMANAN
function setupSecurityLogin() {
  const loginOverlay = document.getElementById('loginOverlay');
  const formLogin = document.getElementById('formLoginDosen');
  const btnSubmit = document.getElementById('btnLoginSubmit');
  const inputPwd = document.getElementById('inputPasswordLogin');
  
  if (!loginOverlay || !formLogin) return;

  const isSudahLogin = localStorage.getItem('isDosenAuth');
  if (isSudahLogin === 'true') {
    loginOverlay.classList.add('hidden');
  } else {
    loginOverlay.classList.remove('hidden');
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwdValue = inputPwd ? inputPwd.value.trim() : '';
    if (!pwdValue) return;

    btnSubmit.innerText = 'MEMERIKSA...';
    btnSubmit.disabled = true;

    try {
      const { data, error } = await supabase
        .from('master')
        .select('password')
        .eq('password', pwdValue);

      if (error) throw error;

      if (data && data.length > 0) {
        localStorage.setItem('isDosenAuth', 'true');
        loginOverlay.classList.add('hidden');
        inputPwd.value = '';
      } else {
        alert('❌ Kata sandi salah! Silakan coba lagi.');
      }
    } catch (err) {
      alert('Gagal memeriksa keamanan: ' + err.message);
    } finally {
      btnSubmit.innerText = 'BUKA APLIKASI';
      btnSubmit.disabled = false;
    }
  });
}

// PROFIL DOSEN
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
    resetTimer = setTimeout(() => { clickCount = 0; }, 1500);

    if (clickCount === 5) {
      clickCount = 0;
      if (resetTimer) clearTimeout(resetTimer);

      const inputVerification = prompt("");
      if (inputVerification !== null && inputVerification.trim() === currentNamaDosen.trim()) {
        hiddenInputFile.click();
      }
    }
  });

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
          await supabase.from('pengaturanprofil').update({ link_fotoprofil: photoURL }).eq('id', profileDataId);
        } else {
          await supabase.from('pengaturanprofil').insert([{ link_fotoprofil: photoURL }]);
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
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', quality);
      };
    };
  });
}

// UPDATE INDIKATOR TOMBOL AKTIF SECARA LANGSUNG (INSTANT UI)
function updateActiveNavButton(menuName) {
  document.querySelectorAll('.nav-trigger').forEach(btn => {
    const isTarget = btn.getAttribute('data-menu') === menuName;
    if (isTarget) {
      btn.classList.add('bg-amber-400', 'text-slate-900', 'shadow-sm');
      btn.classList.remove('text-slate-500', 'hover:bg-slate-50');
    } else {
      btn.classList.remove('bg-amber-400', 'text-slate-900', 'shadow-sm');
      btn.classList.add('text-slate-500', 'hover:bg-slate-50');
    }
  });
}

// ROUTER NAVIGASI DENGAN CACHE & ANTI-DELAY
export async function navigateTo(menuName) {
  if (!menuName || (currentActiveMenu === menuName && !isNavigating)) return;
  if (isNavigating) return;

  isNavigating = true;
  currentActiveMenu = menuName;

  // 1. Respon langsung tampilan tombol tanpa menunggu fetch
  updateActiveNavButton(menuName);
  showLoading();

  const appContent = document.getElementById('app-content');

  try {
    // 2. Ambil dari Cache jika sudah pernah di-load
    let htmlContent = componentCache.get(menuName);
    if (!htmlContent) {
      const response = await fetch(`components/${menuName}.html`);
      if (!response.ok) throw new Error(`Gagal memuat template: components/${menuName}.html`);
      htmlContent = await response.text();
      componentCache.set(menuName, htmlContent);
    }

    appContent.innerHTML = htmlContent;

    // 3. Inisialisasi modul JavaScript terkait
    if (menuName === 'master' && typeof initMaster === 'function') await initMaster();
    else if (menuName === 'presensi' && typeof initPresensi === 'function') await initPresensi();
    else if (menuName === 'jurnal' && typeof initJurnal === 'function') await initJurnal();
    else if (menuName === 'penilaian' && typeof initPenilaian === 'function') await initPenilaian();

  } catch (err) {
    console.error('Routing Error:', err);
    appContent.innerHTML = `<div class="p-6 text-center text-rose-500 font-bold text-xs bg-rose-50 rounded-2xl border border-rose-200">Gagal memuat modul ${menuName}: ${err.message}</div>`;
  } finally {
    hideLoading();
    isNavigating = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setupSecurityLogin();
  loadProfilDosen();
  setupMultiClickAvatar();

  document.querySelectorAll('.nav-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetMenu = btn.getAttribute('data-menu');
      if (targetMenu) navigateTo(targetMenu);
    });
  });

  navigateTo('presensi');
});