// Signs the list of checksums of a draft release and publishes the release: from then on the
// installed Octos find it and accept it. Run on the computer that holds the key, never in CI.
// Usage: pnpm release:sign <tag> [name of the key]     (needs the GitHub CLI, signed in)
import { execFileSync } from 'node:child_process'
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { askHidden } from './release-passphrase.mjs'

const [tag, name = 'primaria'] = process.argv.slice(2)
if (!tag) {
  console.error('Uso: pnpm release:sign <tag> [nome della chiave]')
  process.exit(1)
}
const CHECKSUMS = 'SHA256SUMS'
const SIGNATURE = 'SHA256SUMS.sig'
const repository = process.env.OCTO_RELEASE_REPOSITORY ?? 'limg88/octo'
const folder = process.env.OCTO_RELEASE_KEYS ?? join(homedir(), '.octo-release')
const publicFile =
  process.env.OCTO_RELEASE_PUBLIC_KEYS ??
  fileURLToPath(new URL('../apps/desktop/release-keys.json', import.meta.url))
const gh = (...args) => execFileSync('gh', [...args, '--repo', repository], { encoding: 'utf8' })

const passphrase =
  process.env.OCTO_RELEASE_PASSPHRASE ?? (await askHidden('Passphrase della chiave: '))
let key
try {
  key = createPrivateKey({ key: readFileSync(join(folder, `${name}.key`)), passphrase })
} catch {
  console.error(
    `Non riesco ad aprire la chiave «${name}» in ${folder}: passphrase o file sbagliati.`,
  )
  process.exit(1)
}
// A release signed with a key the app does not carry would be refused by every installed Octo.
const own = createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64')
if (!JSON.parse(readFileSync(publicFile, 'utf8')).keys.includes(own)) {
  console.error('Questa chiave non è fra quelle in apps/desktop/release-keys.json: non firmo.')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'octo-firma-'))
try {
  gh('release', 'download', tag, '--pattern', CHECKSUMS, '--dir', work)
  const list = readFileSync(join(work, CHECKSUMS))
  console.log(`Firmo la lista dei file di ${tag}:\n${list.toString('utf8')}`)
  writeFileSync(join(work, SIGNATURE), `${sign(null, list, key).toString('base64')}\n`)
  gh('release', 'upload', tag, join(work, SIGNATURE), '--clobber')
  gh('release', 'edit', tag, '--draft=false', '--latest')
  console.log(`Pubblicata ${tag}: gli Octo installati la troveranno al prossimo controllo.`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
