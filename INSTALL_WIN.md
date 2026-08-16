# Instalasi di Windows

Panduan untuk memasang tool download & decrypt SFTP BCA di Windows baru.
Terminal hanya dipakai sekali saat instalasi. Pemakaian sehari-hari cukup double-click.

Untuk Mac, lihat [INSTALL_MAC.md](INSTALL_MAC.md).

---

## 1. Software yang harus diinstall

Windows tidak membawa Node.js, jadi hanya satu software yang wajib dipasang.

| Software | Wajib? | Versi | Cara install |
|---|---|---|---|
| **Node.js** | Ya | 18 atau lebih baru (pakai LTS) | Download installer `.msi` dari [nodejs.org](https://nodejs.org) → double-click → Next sampai selesai |
| Git | Tidak | — | Hanya kalau mau ambil project lewat `git clone`. Bisa dilewati, cukup copy foldernya |

Tidak perlu install Gpg4win, Python, Visual Studio Build Tools, atau apa pun yang lain.

Saat menjalankan installer, Windows bisa menampilkan **"Windows protected your PC"** —
klik **More info** → **Run anyway**. Biarkan opsi *"Add to PATH"* tetap tercentang
(default-nya memang aktif).

**Cek Node sudah terpasang** — buka **PowerShell** (Start → ketik `PowerShell`):

```powershell
node --version
```

Harus muncul misalnya `v22.11.0`. Kalau muncul *"not recognized as an internal or external
command"*, **tutup PowerShell dan buka lagi** — jendela yang sudah terbuka sebelum Node
diinstall belum membaca PATH yang baru.

---

## 2. Copy project ke komputer

Taruh folder `NodeJS` di mana saja, misalnya `C:\BCA_SFTP\NodeJS`.

Hindari folder yang disinkronkan OneDrive — file bisa dijadikan "online-only" otomatis
dan script gagal membacanya. Folder `Documents` di Windows 11 sering sudah otomatis
tersambung ke OneDrive, jadi lebih aman pakai folder di luar itu (misalnya `C:\BCA_SFTP`).

Lewat git:

```powershell
git clone <url-repo> C:\BCA_SFTP
```

Atau copy manual foldernya (USB / drive jaringan). Folder `node_modules` tidak perlu
ikut dicopy — akan dibuat ulang di langkah 4.

---

## 3. Siapkan 2 file rahasia

Kedua file ini **sengaja tidak ikut di git** (lihat `.gitignore`), jadi harus dicopy manual
dari komputer yang lama. Tanpa keduanya script tidak bisa jalan.

| File | Isi |
|---|---|
| `secrets.json` | Host, port, username, password SFTP BCA |
| `majoo_private.pem` | Kunci privat PGP untuk dekripsi |

Contoh isi `secrets.json` (lihat `secrets.example.json`):

```json
{
  "sftpHost": "alamat-sftp-bca",
  "sftpPort": 22,
  "sftpUsername": "username-sftp-bca",
  "sftpPassword": "isi-password-sftp-bca-di-sini"
}
```

Letakkan keduanya langsung di dalam folder `NodeJS`, sejajar dengan `server.js`.

> Copy lewat USB atau drive internal. Jangan kirim lewat chat atau email —
> `majoo_private.pem` adalah kunci privat, siapa pun yang punya file itu bisa
> membuka semua file BCA yang terenkripsi.

Pastikan Explorer tidak menyembunyikan ekstensi file. File harus bernama persis
`secrets.json`, bukan `secrets.json.txt`. Cek lewat **View → Show → File name extensions**.

---

## 4. Install dependency (sekali saja)

Di PowerShell:

```powershell
cd C:\BCA_SFTP\NodeJS
npm install
```

`npm install` mengunduh `express`, `openpgp`, `ssh2-sftp-client`, `fs-extra` — butuh internet.
Prosesnya sekitar satu menit. Peringatan `npm warn deprecated` boleh diabaikan.

Cek instalasi berhasil:

```powershell
npm test
```

Harus muncul `✅ date_filter self-check OK`.

---

## 5. Pemakaian sehari-hari

**Double-click `START_UI.bat` di File Explorer.**

Yang terjadi:

1. Jendela hitam terbuka dan menampilkan `✅ UI siap: http://localhost:4321`
2. Browser terbuka sendiri ke alamat tersebut
3. Pilih **Folder** dan **Tanggal**, klik **Jalankan**
4. Output tampil langsung di halaman

**Biarkan jendela hitam terbuka selama proses berjalan.** Menutupnya menghentikan server.
Kalau sudah selesai, tutup jendelanya atau tekan `Ctrl + C`.

> Jangan double-click `ui.html`. Halaman itu harus dibuka lewat server — kalau dibuka
> langsung dari file, semua tombolnya mati dan muncul pesan penjelasannya.

### Lewat PowerShell (opsional)

```powershell
npm run ui                                  # sama dengan double-click START_UI.bat
node sync_decrypt_reports.js today          # tanpa UI
node sync_decrypt_success.js agustus
node sync_decrypt_reports.js --help         # daftar format tanggal
```

---

## 6. Kalau bermasalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| `node` / `npm` *"is not recognized"* | PowerShell dibuka sebelum Node diinstall | Tutup PowerShell, buka lagi. Kalau masih, install ulang Node dan pastikan *"Add to PATH"* tercentang |
| `Node.js tidak ditemukan` saat double-click `.bat` | Sama seperti di atas | Install Node, lalu coba lagi |
| Jendela hitam muncul lalu langsung hilang | Error sebelum `pause` | Buka PowerShell, `cd` ke foldernya, jalankan `npm run ui` supaya pesan errornya terbaca |
| `Cannot find module 'express'` | `npm install` belum dijalankan | Ulangi langkah 4 |
| Halaman menampilkan *"Halaman dibuka langsung dari file"* | `ui.html` di-double-click | Tutup tab, double-click `START_UI.bat` |
| *"Tidak bisa menghubungi server"* saat klik Jalankan | Jendela hitam sudah ditutup | Double-click `START_UI.bat` lagi |
| `⚠️ Port 4321 tidak bisa dipakai (EACCES)` | Port masuk range yang dikunci Hyper-V/WSL. Range ini berubah tiap restart | Tidak perlu apa-apa — server otomatis pindah ke port bebas. Pakai alamat yang tercetak di jendela hitam |
| `⚠️ Port 4321 tidak bisa dipakai (EADDRINUSE)` | Masih ada server lama yang jalan | Otomatis pindah port juga. Untuk membersihkan: `taskkill /IM node.exe /F` |
| Muncul prompt Windows Firewall | Jarang terjadi — server hanya bind ke `127.0.0.1` | Boleh di-**Cancel**, tool tetap jalan normal |
| Antivirus memblokir `node.exe` | Kebijakan endpoint di perusahaan | Minta IT untuk allow-list folder project |
| `Misformed armored text` | `majoo_private.pem` rusak saat copy | Copy ulang file kuncinya dari komputer lama |
| `secrets.json` not found | File rahasia belum dicopy, atau namanya jadi `secrets.json.txt` | Ulangi langkah 3, aktifkan *File name extensions* di Explorer |
| Karakter aneh seperti `âœ…` di jendela hitam | Codepage console | Sudah ditangani (`chcp 65001`). Kosmetik saja, tidak mempengaruhi hasil |

### Ganti port secara manual

```powershell
$env:PORT=5000; npm run ui        # PowerShell
```

```cmd
set PORT=5000 && npm run ui       :: Command Prompt
```

---

## Catatan

- File yang sudah pernah diunduh tidak diunduh ulang — daftar `.gpg` di folder lokal
  yang menjadi penanda. Menghapus `.gpg` berarti file itu akan diunduh lagi.
- Hasil dekripsi masuk ke sub-folder `Decrypted/` di masing-masing folder.
- Download yang terputus menyisakan file `.part` dan otomatis diulang saat run berikutnya.
- Server hanya mendengarkan di `127.0.0.1`, tidak bisa diakses dari komputer lain di jaringan.
- File `.bat` lama di folder induk (`WIN_PULL_SUBS_*.bat`) memakai alur `gpg` + `before_sync.txt`
  yang sudah tidak dipakai script Node ini. Keduanya berdiri sendiri.
