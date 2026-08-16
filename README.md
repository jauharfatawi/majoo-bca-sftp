# BCA SFTP — Download & Decrypt

Mengunduh file terenkripsi dari SFTP BCA, lalu mendekripsinya dengan kunci privat PGP.
Bisa dijalankan lewat halaman web lokal (tanpa terminal) atau lewat command line.

---

## Mulai cepat

Install: **[INSTALL_WIN.md](INSTALL_WIN.md)** (Windows) · **[INSTALL_MAC.md](INSTALL_MAC.md)** (macOS)

Setelah terpasang, pemakaian sehari-hari:

| Windows | macOS |
|---|---|
| Double-click `START_UI.bat` | Double-click `START_UI.command` |

Browser terbuka sendiri. Pilih folder, pilih tanggal, klik **Jalankan**.
Biarkan jendela terminal terbuka selama proses berjalan.

---

## Yang diunduh

Tiga folder BCA, masing-masing punya script sendiri:

| Script | Folder lokal | Isi |
|---|---|---|
| `sync_decrypt_success.js` | `Submission_Success/` | Response registrasi submerchant (`.xlsx`) |
| `sync_decrypt_rejected.js` | `Submission_Rejected/` | Rejected KYC submerchant (`.xls`) |
| `sync_decrypt_reports.js` | `Report_QRIS/` | Report QRIS harian (`.csv` / `.xls`) |

File `.gpg` tersimpan di folder tersebut, hasil dekripsinya masuk ke sub-folder `Decrypted/`.

---

## Filter tanggal

Tanpa argumen, semua file yang belum ada di lokal akan diunduh. Dengan argumen,
hanya file dengan tanggal yang cocok — tanggal dibaca dari nama filenya (format `DDMMYYYY`,
misalnya `MA_qris_dailyreport_01012025.csv.gpg`).

```bash
node sync_decrypt_reports.js                 # semua
node sync_decrypt_reports.js today
node sync_decrypt_reports.js kemarin
node sync_decrypt_reports.js last 7 days     # atau 7d, 30d
node sync_decrypt_success.js agustus         # atau august, august 2024
node sync_decrypt_success.js 04082025        # atau 04-08-2025, 2025-08-04
node sync_decrypt_reports.js 2025-08         # satu bulan penuh
node sync_decrypt_reports.js --help
```

Alias tersedia dalam Bahasa Indonesia maupun Inggris. Nama bulan tanpa tahun memakai
tahun berjalan, atau tahun lalu kalau bulannya belum lewat — jadi `desember` di bulan
Agustus 2026 berarti Desember 2025, bukan hasil kosong.

Argumen yang tidak dikenali akan ditolak dan script berhenti, bukan diam-diam
dianggap "semua tanggal".

**Kalau ada argumen tanggal**, file `.gpg` yang sudah terunduh tapi belum punya hasil
dekripsi juga ikut diproses. Tanpa argumen, hanya file baru yang didekripsi.

---

## Cara file dilacak

Tidak ada database atau file state. Daftar `.gpg` di folder lokal **adalah** penandanya:
file yang sudah ada di sana tidak diunduh ulang. Menghapus sebuah `.gpg` berarti
file itu akan diunduh lagi di run berikutnya.

Download berlangsung ke file `.part` dulu, baru di-rename setelah selesai. Download yang
terputus tidak akan dikira sudah lengkap.

---

## Isi folder

```
START_UI.bat / START_UI.command   Titik masuk untuk user — jalankan ini
server.js                         Web server lokal (127.0.0.1) yang menjalankan script
ui.html                           Halaman UI
date_filter.js                    Parsing argumen tanggal + self-check
sync_decrypt_success.js           \
sync_decrypt_rejected.js           }  Script sinkronisasi per folder BCA
sync_decrypt_reports.js           /
secrets.json                      Kredensial SFTP — tidak masuk git
majoo_private.pem                 Kunci privat PGP — tidak masuk git
```

---

## Menjalankan test

```bash
npm test
```

Menjalankan self-check `date_filter.js` (parsing alias, tanggal tidak valid, tahun kabisat,
dan memastikan `batch01` di nama file tidak salah dibaca sebagai tanggal).

---

## Keamanan

- `secrets.json` dan `majoo_private.pem` ada di `.gitignore` — jangan pernah di-commit,
  jangan dikirim lewat chat atau email.
- Server UI hanya bind ke `127.0.0.1`, tidak bisa diakses dari komputer lain.
- Nama script yang boleh dijalankan lewat UI diambil dari whitelist di `server.js`,
  dan proses dijalankan tanpa shell — input tanggal tidak bisa dipakai untuk menyisipkan perintah.

---

## Catatan

- Awalan nama file hasil dekripsi diambil dari kata ke-4 nama file, yang kebetulan hanya
  berupa tanggal untuk Report QRIS. Jadi hasilnya `01012025_...` (Report QRIS),
  `response_...` (Success), dan `registration_...` (Rejected). Dibiarkan apa adanya
  supaya nama file yang sudah terlanjur ada tidak berubah.
- File `.bat` di folder induk (`WIN_PULL_SUBS_*.bat`) adalah versi lama berbasis `gpg`
  dan `before_sync.txt`. Sudah tidak dipakai script Node ini dan berdiri sendiri.
