// Makes the key Octo's releases are signed with, and tells the app its public half.
// The private key is written outside the repository, encrypted with a passphrase asked here; the
// public key is added to apps/desktop/release-keys.json, to be committed.
// Usage: pnpm release:keys [name]      (name: `primaria` by default; make also a `riserva`)
import { generateKeyPairSync } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { askHidden } from './release-passphrase.mjs'

const name = process.argv[2] ?? 'primaria'
const folder = process.env.OCTO_RELEASE_KEYS ?? join(homedir(), '.octo-release')
const keyFile = join(folder, `${name}.key`)
const publicFile =
  process.env.OCTO_RELEASE_PUBLIC_KEYS ??
  fileURLToPath(new URL('../apps/desktop/release-keys.json', import.meta.url))
const MIN_PASSPHRASE = 12

if (existsSync(keyFile)) {
  console.error(`Esiste già ${keyFile}: non la sovrascrivo. Scegli un altro nome o spostala.`)
  process.exit(1)
}
const passphrase =
  process.env.OCTO_RELEASE_PASSPHRASE ?? (await askHidden('Passphrase della chiave: '))
if (passphrase.length < MIN_PASSPHRASE) {
  console.error(`La passphrase deve avere almeno ${MIN_PASSPHRASE} caratteri.`)
  process.exit(1)
}
if (
  process.env.OCTO_RELEASE_PASSPHRASE === undefined &&
  (await askHidden('Ripeti la passphrase: ')) !== passphrase
) {
  console.error('Le due passphrase non coincidono.')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
mkdirSync(folder, { recursive: true, mode: 0o700 })
writeFileSync(
  keyFile,
  privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase }),
  { mode: 0o600 },
)
chmodSync(keyFile, 0o600)

const known = JSON.parse(readFileSync(publicFile, 'utf8'))
const encoded = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
writeFileSync(
  publicFile,
  `${JSON.stringify({ ...known, keys: [...known.keys, encoded] }, null, 2)}\n`,
)

console.log(`Chiave privata: ${keyFile} (cifrata; non va mai nel repository né su GitHub)`)
console.log(`Chiave pubblica aggiunta a apps/desktop/release-keys.json: ${encoded}`)
console.log(
  'Ora: fai una copia della chiave privata fuori da questo computer, e committa release-keys.json.',
)
