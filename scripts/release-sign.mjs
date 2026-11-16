// Signs the list of checksums of a draft release and publishes the release: from then on the
// installed Octos find it and accept it. Run on the computer that holds the key, never in CI.
// Usage: pnpm release:sign <tag> [name of the key]     (needs the GitHub CLI, signed in)
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/** Opens the key, asking its passphrase: only once there is something ready to sign. */
async function openKey() {
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
  return key
}

/**
 * What stops a list from being signed: a line that is not a checksum, a file that is not of
 * this version or is not in the draft, a checksum that is not the one of the file brought down,
 * a file of the draft the list does not name. A signature says «these are the files of this
 * version»: it is given only when that is so.
 */
function listProblems(text, folder) {
  const version = tag.replace(/^v/, '')
  const present = readdirSync(folder).filter((file) => file !== CHECKSUMS && file !== SIGNATURE)
  const named = new Set()
  const problems = []
  for (const line of text.split('\n').filter((entry) => entry.trim() !== '')) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim())
    const file = match?.[2]?.trim()
    if (!match || !file) {
      problems.push(`riga che non è un'impronta: «${line}»`)
      continue
    }
    named.add(file)
    if (!file.startsWith(`Octo-${version}-`)) {
      problems.push(`«${file}» non è un file della versione ${version}`)
    } else if (!present.includes(file)) {
      problems.push(`«${file}» è nella lista ma non nella release`)
    } else {
      const actual = createHash('sha256')
        .update(readFileSync(join(folder, file)))
        .digest('hex')
      if (actual !== match[1].toLowerCase()) {
        problems.push(`l'impronta di «${file}» non è quella del file scaricato`)
      }
    }
  }
  for (const file of present) {
    if (!named.has(file)) problems.push(`«${file}» è nella release ma non nella lista`)
  }
  if (named.size === 0) problems.push('la lista è vuota')
  return problems
}

const work = mkdtempSync(join(tmpdir(), 'octo-firma-'))
try {
  // Every file of the draft is brought down: what is signed is what was checked here, not what
  // the list says of itself.
  console.log(
    `Scarico i file di ${tag} per ricontrollarli: può volerci qualche minuto. Non scrivere nulla finché non chiedo la passphrase.`,
  )
  gh('release', 'download', tag, '--dir', work)
  console.log('Scaricati. Ricontrollo le impronte…')
  const list = readFileSync(join(work, CHECKSUMS))
  const problems = listProblems(list.toString('utf8'), work)
  if (problems.length > 0) {
    console.error(`Non firmo ${tag}:\n- ${problems.join('\n- ')}`)
    process.exit(1)
  }
  console.log(`La lista dei file di ${tag}, ricontrollata qui:\n${list.toString('utf8')}`)
  // Asked last: nothing is typed while the script works in silence, where it would be seen.
  const key = await openKey()
  writeFileSync(join(work, SIGNATURE), `${sign(null, list, key).toString('base64')}\n`)
  gh('release', 'upload', tag, join(work, SIGNATURE), '--clobber')
  gh('release', 'edit', tag, '--draft=false', '--latest')
  console.log(`Pubblicata ${tag}: gli Octo installati la troveranno al prossimo controllo.`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
