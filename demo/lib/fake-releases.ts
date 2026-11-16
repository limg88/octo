// Stands for the place where the releases of Octo are published: answers for the latest release
// with the files of a folder, and serves them. The checksum list is made from the files, unless
// `tampered` is given: then the list declares another checksum, as if a file had been swapped.
// The list is signed with a key made on the spot, as the real publisher signs with theirs;
// with `unsigned` no signature is published, with `forged` it is of another key.
// Usage: node demo/lib/fake-releases.ts <folder of files> <version> [tampered|unsigned|forged]
// Prints on its first line the address it listens at, on the second its public key.
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

const [folder, version, mode] = process.argv.slice(2)
const tampered = mode === 'tampered'
if (!folder || !version) throw new Error('usage: fake-releases.ts <folder> <version> [tampered]')

const CHECKSUMS = 'SHA256SUMS'
const SIGNATURE = 'SHA256SUMS.sig'
const files = readdirSync(folder).filter((name) => !name.startsWith('.'))
const sha256 = (name: string): string =>
  tampered
    ? '0'.repeat(64)
    : createHash('sha256')
        .update(readFileSync(join(folder, name)))
        .digest('hex')
const checksums = `${files.map((name) => `${sha256(name)}  ${name}`).join('\n')}\n`
const publisher = generateKeyPairSync('ed25519')
const signer = mode === 'forged' ? generateKeyPairSync('ed25519') : publisher
const signature = sign(null, Buffer.from(checksums, 'utf8'), signer.privateKey).toString('base64')
const published = mode === 'unsigned' ? [CHECKSUMS] : [CHECKSUMS, SIGNATURE]

const server = createServer((request, response) => {
  const base = `http://${request.headers.host}`
  console.log(`${request.method} ${request.url}`)
  if (request.url?.endsWith('/releases/latest')) {
    response.writeHead(200, { 'content-type': 'application/json' })
    return response.end(
      JSON.stringify({
        tag_name: `v${version}`,
        body: 'Versione di prova.',
        assets: [...files, ...published].map((name) => ({
          name,
          browser_download_url: `${base}/files/${encodeURIComponent(name)}`,
          size: files.includes(name) ? statSync(join(folder, name)).size : 0,
        })),
      }),
    )
  }
  const name = decodeURIComponent((request.url ?? '').replace('/files/', ''))
  if (name === CHECKSUMS) return response.end(checksums)
  if (name === SIGNATURE && published.includes(SIGNATURE)) return response.end(`${signature}\n`)
  if (!files.includes(name)) {
    response.writeHead(404)
    return response.end()
  }
  response.writeHead(200, { 'content-length': statSync(join(folder, name)).size })
  createReadStream(join(folder, name)).pipe(response)
})

server.listen(0, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  console.log(publisher.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'))
})
