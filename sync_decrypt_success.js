const fs = require('fs-extra');
const path = require('path');
const SFTPClient = require('ssh2-sftp-client');
const openpgp = require('openpgp');
const secrets = require('./secrets.json');
const { rangeFromArgv, matchesRange, describeRange } = require('./date_filter');

const CONFIG = {
    privateKeyFile: 'majoo_private.pem',
    sftp: {
        host: secrets.sftpHost,
        port: secrets.sftpPort,
        username: secrets.sftpUsername,
        password: secrets.sftpPassword,
        remoteDir: '/BCA/MAJOOTEKIN/Fitur Non Finansial/File Transfer HEI/Response Registrasi Submerchant'
    },
    localDir: 'Submission_Success'
};

const paths = {
    decryptedDir: path.join(CONFIG.localDir, 'Decrypted')
};

function outputPathFor(file) {
    const tokens = path.basename(file, '.gpg').split('_');
    const datePart = tokens[3] || 'unknown';
    return path.join(paths.decryptedDir, `${datePart}_${file.replace('.gpg', '')}`);
}

async function main() {
    const range = rangeFromArgv();
    console.log(`🗓️  Filter tanggal: ${describeRange(range)}`);

    await fs.ensureDir(CONFIG.localDir);
    await fs.ensureDir(paths.decryptedDir);

    const localFiles = (await fs.readdir(CONFIG.localDir)).filter(f => f.endsWith('.gpg'));

    const sftp = new SFTPClient();
    try {
        await sftp.connect(CONFIG.sftp);

        const remoteList = await sftp.list(CONFIG.sftp.remoteDir);
        const matchedRemoteFiles = remoteList
            .map(f => f.name)
            .filter(name => /^MAJOO_submerchant_registration_response_.*\.xlsx\.gpg$/.test(name));

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
        console.error('❌ Terjadi kesalahan:', err.message);
    } finally {
        sftp.end();
    }
}

async function decryptGPG(inputPath, outputPath, decryptedKey) {
    const encryptedText = await fs.readFile(inputPath, 'utf8');

    const message = await openpgp.readMessage({
        armoredMessage: encryptedText
    });

    const { data: decrypted } = await openpgp.decrypt({
        message,
        decryptionKeys: decryptedKey
    });

    await fs.writeFile(outputPath, decrypted, 'utf8');
  }

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
