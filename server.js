// UI lokal supaya user bisa menjalankan script tanpa terminal.
// Jalankan: node server.js  (atau double-click START_UI.bat)

const path = require('path');
const express = require('express');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 4321;

// Whitelist: nama script TIDAK PERNAH diambil langsung dari input user.
const SCRIPTS = {
    success: { file: 'sync_decrypt_success.js', label: 'Submission Success' },
    rejected: { file: 'sync_decrypt_rejected.js', label: 'Submission Rejected' },
    reports: { file: 'sync_decrypt_reports.js', label: 'Report QRIS' }
};

const app = express();
let running = null;

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'ui.html')));

app.get('/scripts', (req, res) =>
    res.json(Object.entries(SCRIPTS).map(([key, s]) => ({ key, label: s.label }))));

app.get('/run', (req, res) => {
    const script = SCRIPTS[req.query.script];
    if (!script) return res.status(400).type('text').send('❌ Script tidak dikenal.\n');
    if (running) return res.status(409).type('text').send('⏳ Masih ada proses berjalan. Tunggu sampai selesai.\n');

    const date = String(req.query.date || '').trim();
    // spawn tanpa shell: argumen tanggal diteruskan apa adanya, tidak diinterpretasi shell.
    const args = date ? [script.file, date] : [script.file];

    res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    res.write(`▶ node ${args.join(' ')}\n\n`);

    const child = spawn(process.execPath, args, { cwd: __dirname });
    running = child;

    child.stdout.on('data', d => res.write(d));
    child.stderr.on('data', d => res.write(d));
    child.on('error', err => res.write(`\n❌ Gagal menjalankan: ${err.message}\n`));
    child.on('close', code => {
        running = null;
        res.end(`\n${code === 0 ? '✅ Selesai.' : `❌ Berhenti dengan kode ${code}.`}\n`);
    });

    // User menutup tab / menekan Stop -> hentikan prosesnya juga.
    res.on('close', () => { if (running === child) child.kill(); });
});

function openBrowser(url) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
        : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
}

// Bind ke localhost saja — server ini punya akses ke kunci privat & kredensial SFTP.
function listen(port) {
    const server = app.listen(port, '127.0.0.1', () => {
        const url = `http://localhost:${server.address().port}`;
        console.log(`✅ UI siap: ${url}`);
        console.log('   Tekan Ctrl+C untuk menutup.');
        openBrowser(url);
    });
    server.on('error', err => {
        // Windows sering memblokir port (Hyper-V reserved range, berubah tiap reboot) -> ambil port bebas.
        if (port !== 0 && (err.code === 'EACCES' || err.code === 'EADDRINUSE')) {
            console.log(`⚠️  Port ${port} tidak bisa dipakai (${err.code}), mencari port lain...`);
            return listen(0);
        }
        throw err;
    });
}

listen(PORT);
