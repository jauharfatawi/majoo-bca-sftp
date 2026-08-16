const fs = require('fs-extra');
const path = require('path');
const SFTPClient = require('ssh2-sftp-client');
const openpgp = require('openpgp');
const secrets = require('./secrets.json');
const { rangeFromArgv, matchesRange, describeRange } = require('./date_filter');

// Load config from file
const CONFIG = {
    privateKeyFile: 'majoo_private.pem',
    sftp: {
        host: secrets.sftpHost,
        port: secrets.sftpPort,
        username: secrets.sftpUsername,
        password: secrets.sftpPassword,        
        remoteDir: '/BCA/MAJOOTEKIN/Fitur Non Finansial/File Transfer HEI/Report QRIS'
    },
    localDir: 'Report_QRIS'
};

const sftp = new SFTPClient();

const paths = {
    decryptedDir: path.join(CONFIG.localDir, 'Decrypted')
};

// Validate private key exists
async function validatePrivateKey() {
    if (!await fs.pathExists(CONFIG.privateKeyFile)) {
        throw new Error(`Private key file not found: ${CONFIG.privateKeyFile}`);
    }
}

function outputPathFor(file) {
    const tokens = path.basename(file, '.gpg').split('_');
    const datePart = tokens.length >= 4 ? tokens[3] :
        file.match(/(\d{6,8})/)?.[0] || 'unknown';
    return path.join(paths.decryptedDir, `${datePart}_${file.replace('.gpg', '')}`);
}

async function main() {
    const range = rangeFromArgv();
    console.log(`🗓️  Filter tanggal: ${describeRange(range)}`);

    try {
        await validatePrivateKey();
        await fs.ensureDir(CONFIG.localDir);
        await fs.ensureDir(paths.decryptedDir);

        const localFiles = (await fs.readdir(CONFIG.localDir)).filter(f => f.endsWith('.gpg'));

        await sftp.connect(CONFIG.sftp);

        const remoteList = await sftp.list(CONFIG.sftp.remoteDir);
        const matchedRemoteFiles = remoteList
            .map(f => f.name)
            .filter(name => /MA_qris_.*\.(csv|xls)\.gpg$/i.test(name));

        const wanted = matchedRemoteFiles.filter(f => matchesRange(f, range));
        const newFiles = wanted.filter(f => !localFiles.includes(f));

        // Dengan filter tanggal, file yang sudah terunduh tapi belum ada hasil dekripsinya ikut diproses.
        const backfill = range
            ? wanted.filter(f => localFiles.includes(f) && !fs.pathExistsSync(outputPathFor(f)))
            : [];

        if (newFiles.length === 0 && backfill.length === 0) {
            console.log('Tidak ada file baru untuk didownload.');
            return;
        }

        // Download new files (via .part so an interrupted download isn't mistaken for a complete one)
        for (const file of newFiles) {
            const remotePath = path.posix.join(CONFIG.sftp.remoteDir, file);
            const localPath = path.join(CONFIG.localDir, file);
            console.log(`📥 Downloading: ${file}`);
            await sftp.get(remotePath, `${localPath}.part`);
            await fs.move(`${localPath}.part`, localPath, { overwrite: true });
        }

        // Load private key
        // File kunci kadang tersimpan dengan "\n" literal (bukan baris baru) -> openpgp menolaknya.
        const privateKeyArmored = (await fs.readFile(CONFIG.privateKeyFile, 'utf8')).replace(/\\n/g, '\n');
        const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

        // Decrypt new files
        for (const file of [...newFiles, ...backfill]) {
            console.log(`🔐 Decrypting: ${file}`);
            await decryptGPG(path.join(CONFIG.localDir, file), outputPathFor(file), privateKey);
        }

        console.log('✅ Sinkronisasi dan dekripsi selesai.');
    } catch (err) {
        console.error('❌ Error:', err.stack || err.message);
    } finally {
        await sftp.end().catch(err =>
            console.error('⚠️ Failed to close SFTP connection:', err.message)
        );
    }
}

async function decryptGPG(inputPath, outputPath, decryptedKey) {
    try {
        const encryptedText = await fs.readFile(inputPath, 'utf8');

        const message = await openpgp.readMessage({
            armoredMessage: encryptedText
        });

        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: decryptedKey
        });

        await fs.writeFile(outputPath, decrypted, 'utf8');
    } catch (err) {
        console.error(`❌ Decryption failed for ${inputPath}:`, err.message);
        throw err;
    }
}

main().catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
});
