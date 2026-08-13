const fs = require('fs-extra');
const path = require('path');
const SFTPClient = require('ssh2-sftp-client');
const openpgp = require('openpgp');
const secrets = require('./secrets.json');

const CONFIG = {
    privateKeyFile: 'majoo_private.pem',
    sftp: {
        host: '10.128.0.96',
        port: 8081,
        username: 'MAJOOTEKIN',
        password: secrets.sftpPassword,
        remoteDir: '/BCA/MAJOOTEKIN/Fitur Non Finansial/File Transfer HEI/Response Registrasi Submerchant'
    },
    localDir: 'Submission_Success'
};

const paths = {
    decryptedDir: path.join(CONFIG.localDir, 'Decrypted'),
    before: 'before_sync.txt',
    newFiles: 'new_files.txt'
};

async function main() {
    await fs.ensureDir(CONFIG.localDir);
    await fs.ensureDir(paths.decryptedDir);

    const localFiles = (await fs.readdir(CONFIG.localDir)).filter(f => f.endsWith('.gpg'));
    await fs.writeFile(paths.before, localFiles.join('\n'));

    const sftp = new SFTPClient();
    try {
        await sftp.connect(CONFIG.sftp);

        const remoteList = await sftp.list(CONFIG.sftp.remoteDir);
        const matchedRemoteFiles = remoteList
            .map(f => f.name)
            .filter(name => /^MAJOO_submerchant_registration_response_.*\.xlsx\.gpg$/.test(name));

        const newFiles = matchedRemoteFiles.filter(f => !localFiles.includes(f));
        if (newFiles.length === 0) {
            console.log('Tidak ada file baru untuk didownload.');
            return;
        }

        await fs.writeFile(paths.newFiles, newFiles.join('\n'));

        // Download new files
        for (const file of newFiles) {
            const remotePath = path.posix.join(CONFIG.sftp.remoteDir, file);
            const localPath = path.join(CONFIG.localDir, file);
            console.log(`📥 Downloading: ${file}`);
            await sftp.get(remotePath, localPath);
        }

        // Load private key
        const privateKeyArmored = await fs.readFile(CONFIG.privateKeyFile, 'utf8');
        const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

        // Decrypt new files
        for (const file of newFiles) {
            console.log(`🔐 Decrypting: ${file}`);
            const baseName = path.basename(file, '.gpg');
            const tokens = baseName.split('_');
            const datePart = tokens[3] || 'unknown';
            const inputPath = path.join(CONFIG.localDir, file);
            const outputPath = path.join(paths.decryptedDir, `${datePart}_${file.replace('.gpg', '')}`);

            await decryptGPG(inputPath, outputPath, privateKey);
        }

        console.log('✅ Sinkronisasi dan dekripsi selesai.');
        await fs.remove(paths.before);
        await fs.remove(paths.newFiles);
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

main();
