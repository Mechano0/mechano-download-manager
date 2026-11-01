#!/usr/bin/env node
'use strict';
/**
 * Writes dist/version.json for a release: version, notes and the Setup.exe's size + SHA-256,
 * signed with the private Ed25519 key that stays on the developer's PC.
 *
 *   node tools/sign-release.js [--notes "What changed"] [--key <path to .pem>]
 *
 * Default key: .private\update-signing-key.pem inside this program folder (gitignored: it is never uploaded,
 * and build-portable.ps1 does not copy it). Keep a backup copy on a USB stick / cloud drive.
 * Upload dist/version.json next to "Mechano.DM.Setup.exe" in the GitHub release.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { signedText, verifyManifest } = require('../src/selfupdate');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

const keyPath = opt('--key', path.join(root, '.private', 'update-signing-key.pem'));
if (!fs.existsSync(keyPath)) throw new Error(`Signing key not found: ${keyPath}`);
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const setupFile = path.join(root, 'dist', 'Mechano DM Setup.exe');
const assetName = 'Mechano.DM.Setup.exe'; // GitHub turns the spaces into dots
const repo = 'Mechano0/mechano-download-manager';

const data = fs.readFileSync(setupFile);
const manifest = {
  version,
  notes: opt('--notes', ''),
  date: new Date().toISOString().slice(0, 10),
  setup: {
    url: `https://github.com/${repo}/releases/download/v${version}/${assetName}`,
    size: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  },
};
const key = crypto.createPrivateKey(fs.readFileSync(keyPath));
manifest.signature = crypto.sign(null, Buffer.from(signedText(manifest)), key).toString('base64');
if (!verifyManifest(manifest)) throw new Error('Signature check failed: the key does not match the public key in src/selfupdate.js');
fs.writeFileSync(path.join(root, 'dist', 'version.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`dist/version.json: v${version}, ${data.length} bytes, sha256 ${manifest.setup.sha256.slice(0, 16)}…  (signature OK)`);
