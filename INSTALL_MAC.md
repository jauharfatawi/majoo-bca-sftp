# Instalasi di macOS

Panduan untuk memasang tool download & decrypt SFTP BCA di Mac baru.
Terminal hanya dipakai sekali saat instalasi. Pemakaian sehari-hari cukup double-click.

---

## 1. Software yang harus diinstall

macOS tidak membawa Node.js, jadi hanya satu software yang wajib dipasang.

| Software | Wajib? | Versi | Cara install |
|---|---|---|---|
| **Node.js** | Ya | 18 atau lebih baru (pakai LTS) | Download installer `.pkg` dari [nodejs.org](https://nodejs.org) → double-click → Next sampai selesai |
| Git | Tidak | — | Hanya kalau mau ambil project lewat `git clone`. Bisa dilewati, cukup copy foldernya |

Tidak perlu install GPG, Homebrew, Xcode, atau apa pun yang lain.

**Cek Node sudah terpasang** — buka **Terminal** (⌘ + Space → ketik `Terminal`):

```bash
node --version
```

Harus muncul misalnya `v22.11.0`. Kalau muncul `command not found`, installer Node belum jalan
atau Terminal perlu ditutup dan dibuka lagi.

---

## 2. Copy project ke Mac

Taruh folder `NodeJS` di mana saja, misalnya `~/Documents/BCA_SFTP/NodeJS`.

Hindari folder yang disinkronkan iCloud/Dropbox — file bisa dikosongkan otomatis
("optimize storage") dan script gagal membacanya.

Lewat git:

```bash
git clone <url-repo> ~/Documents/BCA_SFTP
```

Atau copy manual foldernya dari Windows (USB / drive jaringan). Folder `node_modules`
tidak perlu ikut dicopy — akan dibuat ulang di langkah 4.

---

## 3. Siapkan 2 file rahasia

Kedua file ini **sengaja tidak ikut di git** (lihat `.gitignore`), jadi harus dicopy manual
dari mesin Windows yang lama. Tanpa keduanya script tidak bisa jalan.

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

---

## 4. Install dependency (sekali saja)

Di Terminal:

```bash
cd ~/Documents/BCA_SFTP/NodeJS
npm install
chmod +x START_UI.command
```

- `npm install` mengunduh `express`, `openpgp`, `ssh2-sftp-client`, `fs-extra` — butuh internet.
- `chmod +x` membuat file bisa di-double-click dari Finder. Kalau project diambil lewat
  `git clone`, biasanya sudah otomatis executable dan baris ini bisa dilewati —
  menjalankannya dua kali tidak masalah.

Cek instalasi berhasil:

```bash
npm test
```

Harus muncul `✅ date_filter self-check OK`.

---

## 5. Pemakaian sehari-hari

**Double-click `START_UI.command` di Finder.**

Yang terjadi:

1. Jendela Terminal terbuka dan menampilkan `✅ UI siap: http://localhost:4321`
2. Browser terbuka sendiri ke alamat tersebut
3. Pilih **Folder** dan **Tanggal**, klik **Jalankan**
4. Output tampil langsung di halaman

**Biarkan jendela Terminal terbuka selama proses berjalan.** Menutupnya menghentikan server.
Kalau sudah selesai, tutup jendelanya atau tekan `Ctrl + C`.

> Jangan double-click `ui.html`. Halaman itu harus dibuka lewat server — kalau dibuka
> langsung dari file, semua tombolnya mati dan muncul pesan penjelasannya.

### Lewat Terminal (opsional)

```bash
npm run ui                                  # sama dengan double-click START_UI.command
node sync_decrypt_reports.js today          # tanpa UI
node sync_decrypt_success.js agustus
node sync_decrypt_reports.js --help         # daftar format tanggal
```

---

## 6. Kalau bermasalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| Finder: *"cannot be opened because it is from an unidentified developer"* | Gatekeeper — project diambil dari internet/zip | Klik kanan `START_UI.command` → **Open** → **Open**. Cukup sekali |
| Double-click membuka file di editor, bukan menjalankannya | Bit executable hilang saat copy manual | `chmod +x START_UI.command` |
| `bad interpreter: /bin/bash^M` | File tercopy dengan line ending Windows | Ambil ulang lewat `git clone` (sudah diatur di `.gitattributes`), atau `sed -i '' 's/\r$//' START_UI.command` |
| `Node.js tidak ditemukan` padahal sudah install | Node dipasang lewat nvm/Homebrew dan tidak terbaca Finder | Sudah ditangani script. Kalau masih gagal, jalankan `npm run ui` dari Terminal |
| Halaman menampilkan *"Halaman dibuka langsung dari file"* | `ui.html` di-double-click | Tutup tab, double-click `START_UI.command` |
| *"Tidak bisa menghubungi server"* saat klik Jalankan | Jendela Terminal sudah ditutup | Double-click `START_UI.command` lagi |
| `Cannot find module 'express'` | `npm install` belum dijalankan | Ulangi langkah 4 |
| `Misformed armored text` | `majoo_private.pem` rusak saat copy | Copy ulang file kuncinya dari mesin lama |
| `secrets.json` not found | File rahasia belum dicopy | Ulangi langkah 3 |
| Port sudah dipakai | Ada server lain di port 4321 | Otomatis pindah ke port bebas — pakai alamat yang tercetak di Terminal. Atau `PORT=5000 npm run ui` |

---

## Catatan

- File yang sudah pernah diunduh tidak diunduh ulang — daftar `.gpg` di folder lokal
  yang menjadi penanda. Menghapus `.gpg` berarti file itu akan diunduh lagi.
- Hasil dekripsi masuk ke sub-folder `Decrypted/` di masing-masing folder.
- Download yang terputus menyisakan file `.part` dan otomatis diulang saat run berikutnya.
- Server hanya mendengarkan di `127.0.0.1`, tidak bisa diakses dari komputer lain di jaringan.
