// Parsing argumen tanggal dari CLI menjadi rentang hari [from, to] (inklusif).
// Nama file BCA memuat tanggal dengan format DDMMYYYY,
// contoh: MA_qris_dailyreport_01012025.csv.gpg

const MONTHS = {
    januari: 0, january: 0, jan: 0,
    februari: 1, february: 1, feb: 1,
    maret: 2, march: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4, may: 4,
    juni: 5, june: 5, jun: 5,
    juli: 6, july: 6, jul: 6,
    agustus: 7, august: 7, agu: 7, aug: 7,
    september: 8, sept: 8, sep: 8,
    oktober: 9, october: 9, okt: 9, oct: 9,
    november: 10, nov: 10,
    desember: 11, december: 11, des: 11, dec: 11
};

const USAGE = `
Penggunaan: node <script>.js [tanggal]

  (kosong)              semua file (perilaku default)
  today | hari ini      hari ini
  yesterday | kemarin   kemarin
  last 7 days | 7d      7 hari terakhir (termasuk hari ini)
  last 30 days | 30d    30 hari terakhir
  august | agustus      bulan Agustus (tahun berjalan, atau tahun lalu bila belum lewat)
  august 2024           bulan Agustus 2024
  08-2025 | 2025-08     satu bulan penuh
  04082025              satu hari (DDMMYYYY)
  04-08-2025            satu hari (DD-MM-YYYY)
  2025-08-04            satu hari (YYYY-MM-DD)
`.trim();

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const dayRange = (y, m, d) => {
    const from = new Date(y, m, d);
    // Tolak tanggal yang tidak ada, mis. 31-02-2025 (Date akan menggesernya ke Maret).
    if (from.getFullYear() !== y || from.getMonth() !== m || from.getDate() !== d) return null;
    return { from, to: from };
};

const monthRange = (y, m) => ({ from: new Date(y, m, 1), to: new Date(y, m + 1, 0) });

/**
 * @returns {{from: Date, to: Date}|null} null berarti "semua file, tanpa filter".
 * @throws {Error} bila argumen tidak dikenali — jangan pernah diam-diam dianggap "semua".
 */
function parseRange(arg, now = new Date()) {
    const s = String(arg || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s || s === 'all' || s === 'semua') return null;

    const today = startOfDay(now);
    const shiftDays = n => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

    if (s === 'today' || s === 'hari ini') return { from: today, to: today };
    if (s === 'yesterday' || s === 'kemarin') return { from: shiftDays(1), to: shiftDays(1) };

    // "last 7 days", "7 hari", "7d" — N hari terakhir termasuk hari ini.
    let m = s.match(/^(?:last |lalu )?(\d+) ?(?:d|days?|hari)(?: terakhir| ago)?$/);
    if (m) {
        const n = Number(m[1]);
        if (n < 1) throw new Error(`Jumlah hari harus >= 1: "${arg}"`);
        return { from: shiftDays(n - 1), to: today };
    }

    // "august", "agustus 2024"
    m = s.match(/^([a-z]+)(?: (\d{4}))?$/);
    if (m && m[1] in MONTHS) {
        const month = MONTHS[m[1]];
        // Tanpa tahun: pakai tahun berjalan, kecuali bulannya belum lewat -> tahun lalu.
        const year = m[2] ? Number(m[2])
            : now.getFullYear() - (month > now.getMonth() ? 1 : 0);
        return monthRange(year, month);
    }

    // Bulan penuh: "08-2025", "08/2025", "2025-08"
    m = s.match(/^(\d{2})[-/](\d{4})$/);
    if (m) return checkMonth(monthRange(Number(m[2]), Number(m[1]) - 1), Number(m[1]), arg);
    m = s.match(/^(\d{4})[-/](\d{2})$/);
    if (m) return checkMonth(monthRange(Number(m[1]), Number(m[2]) - 1), Number(m[2]), arg);

    // Satu hari: "04082025", "04-08-2025", "2025-08-04"
    m = s.match(/^(\d{2})[-/]?(\d{2})[-/]?(\d{4})$/);
    if (m) {
        const r = dayRange(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        if (r) return r;
        throw new Error(`Tanggal tidak valid: "${arg}"`);
    }
    m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (m) {
        const r = dayRange(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (r) return r;
        throw new Error(`Tanggal tidak valid: "${arg}"`);
    }

    throw new Error(`Argumen tanggal tidak dikenali: "${arg}"\n\n${USAGE}`);
}

function checkMonth(range, month, arg) {
    if (month < 1 || month > 12) throw new Error(`Bulan tidak valid: "${arg}"`);
    return range;
}

/** Ambil tanggal DDMMYYYY dari nama file; null bila tidak ada/tidak valid. */
function fileDate(name) {
    const m = String(name).match(/(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/);
    return m ? dayRange(Number(m[3]), Number(m[2]) - 1, Number(m[1]))?.from ?? null : null;
}

function matchesRange(name, range) {
    if (!range) return true;
    const d = fileDate(name);
    return d !== null && d >= range.from && d <= range.to;
}

const fmt = d => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const describeRange = r => !r ? 'semua tanggal'
    : r.from.getTime() === r.to.getTime() ? fmt(r.from) : `${fmt(r.from)} s/d ${fmt(r.to)}`;

/** Baca argumen tanggal dari argv. Mengembalikan null bila user minta --help. */
function rangeFromArgv(argv = process.argv.slice(2)) {
    const arg = argv.join(' ').replace(/^--date[= ]/, '').trim();
    if (/^(-h|--help|help)$/i.test(arg)) {
        console.log(USAGE);
        process.exit(0);
    }
    return parseRange(arg);
}

module.exports = { parseRange, fileDate, matchesRange, describeRange, rangeFromArgv, USAGE };

// Self-check: node date_filter.js --test
if (require.main === module && process.argv[2] === '--test') {
    const assert = require('assert');
    const NOW = new Date(2025, 7, 15); // 15 Agustus 2025
    const r = (a) => parseRange(a, NOW);

    assert.strictEqual(r(''), null);
    assert.strictEqual(r(undefined), null);
    assert.strictEqual(r('today').from.getDate(), 15);
    assert.strictEqual(r('yesterday').from.getDate(), 14);
    assert.strictEqual(r('kemarin').to.getDate(), 14);

    assert.strictEqual(r('last 7 days').from.getDate(), 9);   // 9..15 = 7 hari
    assert.strictEqual(r('last 7 days').to.getDate(), 15);
    assert.strictEqual(r('7d').from.getDate(), 9);
    assert.strictEqual(r('30 hari').from.getDate(), 17);      // 17 Juli
    assert.strictEqual(r('30 hari').from.getMonth(), 6);

    assert.strictEqual(r('august').from.getMonth(), 7);
    assert.strictEqual(r('august').from.getFullYear(), 2025); // bulan berjalan -> tahun ini
    assert.strictEqual(r('agustus').to.getDate(), 31);
    assert.strictEqual(r('juli').from.getFullYear(), 2025);   // sudah lewat -> tahun ini
    assert.strictEqual(r('desember').from.getFullYear(), 2024); // belum lewat -> tahun lalu
    assert.strictEqual(r('august 2024').from.getFullYear(), 2024);
    assert.strictEqual(r('02-2024').to.getDate(), 29);        // kabisat
    assert.strictEqual(r('2025-08').to.getDate(), 31);

    assert.strictEqual(r('04082025').from.getMonth(), 7);
    assert.strictEqual(r('04-08-2025').from.getDate(), 4);
    assert.strictEqual(r('2025-08-04').from.getDate(), 4);
    assert.throws(() => r('31022025'), /tidak valid/);
    assert.throws(() => r('13-2025'), /Bulan tidak valid/);
    assert.throws(() => r('besok'), /tidak dikenali/);
    assert.throws(() => r('0d'), /harus >= 1/);

    const SUCCESS = 'MAJOO_submerchant_registration_response_04082025_batch01_158.xlsx.gpg';
    const QRIS = 'MA_qris_dailyreport_01012025.csv.gpg';
    assert.strictEqual(fileDate(SUCCESS).getDate(), 4);
    assert.strictEqual(fileDate(SUCCESS).getMonth(), 7);      // bukan "01" dari batch01
    assert.strictEqual(fileDate(QRIS).getFullYear(), 2025);
    assert.strictEqual(fileDate('tanpa_tanggal.gpg'), null);
    assert.strictEqual(fileDate('MA_qris_dailyreport_31022025.csv.gpg'), null);

    assert.ok(matchesRange(SUCCESS, r('august')));
    assert.ok(matchesRange(SUCCESS, r('04082025')));
    assert.ok(!matchesRange(SUCCESS, r('juli')));
    assert.ok(!matchesRange(QRIS, r('august')));
    assert.ok(matchesRange(QRIS, null));
    assert.ok(!matchesRange('tanpa_tanggal.gpg', r('august')));

    assert.strictEqual(describeRange(null), 'semua tanggal');
    assert.strictEqual(describeRange(r('04082025')), '04-08-2025');
    assert.strictEqual(describeRange(r('august')), '01-08-2025 s/d 31-08-2025');

    console.log('✅ date_filter self-check OK');
}
