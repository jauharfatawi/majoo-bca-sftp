const fs = require('fs-extra');
const path = require('path');
const SFTPClient = require('ssh2-sftp-client');
const openpgp = require('openpgp');
const secrets = require('./secrets.json');

// Load config from file
const CONFIG = {
    privateKeyFile: 'majoo_private.pem',
    sftp: {
        host: '10.128.0.96',
        port: 8081,
        username: 'MAJOOTEKIN',
        password: secrets.sftpPassword,
        remoteDir: '/BCA/MAJOOTEKIN/Fitur Non Finansial/File Transfer HEI/Report QRIS'
    },
    localDir: 'Report_QRIS'
};

const sftp = new SFTPClient();

const paths = {
    decryptedDir: path.join(CONFIG.localDir, 'Decrypted'),
    before: 'before_sync.txt',
    newFiles: 'new_files.txt'
};

// Validate private key exists
async function validatePrivateKey() {
    if (!await fs.pathExists(CONFIG.privateKeyFile)) {
        throw new Error(`Private key file not found: ${CONFIG.privateKeyFile}`);
    }
}

async function main() {
    try {        
        await validatePrivateKey();
        await fs.ensureDir(CONFIG.localDir);
        await fs.ensureDir(paths.decryptedDir);

        const localFiles = (await fs.readdir(CONFIG.localDir)).filter(f => f.endsWith('.gpg'));
        await fs.writeFile(paths.before, localFiles.join('\n'));

        
        await sftp.connect(CONFIG.sftp);

        const remoteList = await sftp.list(CONFIG.sftp.remoteDir);
        const matchedRemoteFiles = remoteList
            .map(f => f.name)
            .filter(name => /MA_qris_.*\.(csv|xls)\.gpg$/i.test(name));

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
            const datePart = tokens.length >= 4 ? tokens[3] :
                file.match(/(\d{6,8})/)?.[0] || 'unknown';
            const inputPath = path.join(CONFIG.localDir, file);
            const outputPath = path.join(paths.decryptedDir, `${datePart}_${file.replace('.gpg', '')}`);

            await decryptGPG(inputPath, outputPath, privateKey);
        }

        console.log('✅ Sinkronisasi dan dekripsi selesai.');
        await fs.remove(paths.before);
        await fs.remove(paths.newFiles);
    } catch (err) {
        console.error('❌ Error:', err.stack || err.message);
        try {
            await fs.remove(paths.before);
            await fs.remove(paths.newFiles);
        } catch (cleanupErr) {
            console.error('⚠️ Failed to clean up temp files:', cleanupErr.message);
        }
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
