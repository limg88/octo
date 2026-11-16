// Changes the passphrase of a key Octo's releases are signed with. The key stays the same: the
// installed Octos go on accepting what it signs. Use it when the passphrase was seen by others.
// Usage: pnpm release:passphrase [name of the key]
import { createPrivateKey } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { askHidden } from './release-passphrase.mjs'

const name = process.argv[2] ?? 'primaria'
const folder = process.env.OCTO_RELEASE_KEYS ?? join(homedir(), '.octo-release')
const keyFile = join(folder, `${name}.key`)
const MIN_PASSPHRASE = 12

const old = process.env.OCTO_RELEASE_PASSPHRASE ?? (await askHidden('Passphrase di adesso: '))
let key
try {
  key = createPrivateKey({ key: readFileSync(keyFile), passphrase: old })
} catch {
  console.error(`Non riesco ad aprire ${keyFile}: passphrase o file sbagliati.`)
  process.exit(1)
}
const next = process.env.OCTO_RELEASE_NEW_PASSPHRASE ?? (await askHidden('Passphrase nuova: '))
if (next.length < MIN_PASSPHRASE || next === old) {
  console.error(
    `La passphrase nuova deve avere almeno ${MIN_PASSPHRASE} caratteri ed essere diversa.`,
  )
  process.exit(1)
}
if (
  process.env.OCTO_RELEASE_NEW_PASSPHRASE === undefined &&
  (await askHidden('Ripeti la passphrase nuova: ')) !== next
) {
  console.error('Le due passphrase non coincidono.')
  process.exit(1)
}
writeFileSync(
  keyFile,
  key.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: next }),
  { mode: 0o600 },
)
console.log(
  `Passphrase di «${name}» cambiata. La chiave è la stessa: aggiorna anche le copie che ne hai fatto.`,
)
