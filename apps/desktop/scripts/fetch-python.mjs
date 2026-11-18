// Puts in resources/python/<system>-<arch>/ the interpreter Octo ships for the calculations
// Claude runs inside its fence: a standalone CPython with the libraries for Excel files. The
// folder is not versioned: this script fills it, and the installers take it from there.
// Usage: node scripts/fetch-python.mjs [<system>-<arch> ...]   (default: this computer's)
//        node scripts/fetch-python.mjs --dist   (what the installers built on this system ship)
// Systems are named as the installers name them: mac-arm64, mac-x64, linux-x64, linux-arm64.
// Every file is pinned by its SHA-256: a download that differs is refused and nothing is kept.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('..', import.meta.url))
/** python-build-standalone, release of 26/10/2026: published more than 14 days before use. */
const RELEASE = '20261026'
const VERSION = '3.13.18'
const SITE_PACKAGES = 'lib/python3.13/site-packages'
const BUILDS = {
  'mac-arm64': {
    triple: 'aarch64-apple-darwin',
    sha256: '8392b6ea51d94391befb2c31ebe75463f045d0b69dfcf5e1bb3234e1f5fa3405',
  },
  'mac-x64': {
    triple: 'x86_64-apple-darwin',
    sha256: '7412c19d896c99431b74a18a5643e110449a7f9590fbab179c3e5ab27b9aa9e3',
  },
  // The copy that runs inside WSL2 on a Windows PC.
  'linux-x64': {
    triple: 'x86_64-unknown-linux-gnu',
    sha256: 'df15fe60d3ff55bf9dcf25824b5572756bb8816ff93865a273d3301d7066a8b7',
  },
  'linux-arm64': {
    triple: 'aarch64-unknown-linux-gnu',
    sha256: '578d9da1983463ffb0c8c98ab0da2f18177f44069328eb0af847860c1eb05c3e',
  },
}
/** Pure Python wheels, the same for every system: openpyxl and the one library it needs. */
const WHEELS = [
  {
    url: 'https://files.pythonhosted.org/packages/c0/da/977ded879c29cbd04de313843e76868e6e13408a94ed6b987245dc7c8506/openpyxl-3.1.5-py2.py3-none-any.whl',
    sha256: '5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2',
  },
  {
    url: 'https://files.pythonhosted.org/packages/c1/8b/5fe2cc11fee489817272089c4203e679c63b570a5aaeb18d852ae3cbba6a/et_xmlfile-2.0.0-py3-none-any.whl',
    sha256: '7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa',
  },
]
/** Written last: a folder that holds it is whole, and is not fetched again. */
const DONE_MARK = '.octo-python'

async function download(url, sha256, file) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const found = createHash('sha256').update(bytes).digest('hex')
  if (found !== sha256) throw new Error(`${url}: checksum ${found}, expected ${sha256}`)
  writeFileSync(file, bytes)
}

async function fetchPython(target) {
  const build = BUILDS[target]
  if (!build) throw new Error(`no interpreter for ${target}: one of ${Object.keys(BUILDS)}`)
  const folder = `${appRoot}resources/python/${target}`
  const mark = `${folder}/${DONE_MARK}`
  const wanted = `${VERSION}+${RELEASE}`
  if (existsSync(mark) && readFileSync(mark, 'utf8').trim() === wanted) return folder
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  const archive = `${folder}/python.tar.gz`
  const name = `cpython-${VERSION}+${RELEASE}-${build.triple}-install_only_stripped.tar.gz`
  await download(
    `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE}/${encodeURIComponent(name)}`,
    build.sha256,
    archive,
  )
  // The archive holds one folder, `python/`: its content becomes the folder of the target.
  execFileSync('tar', ['-xzf', archive, '-C', folder, '--strip-components', '1'])
  rmSync(archive)
  // Nothing is ever installed in the shipped interpreter: its installer does not travel.
  for (const name of readdirSync(`${folder}/${SITE_PACKAGES}`)) {
    if (name.startsWith('pip')) rmSync(`${folder}/${SITE_PACKAGES}/${name}`, { recursive: true })
  }
  for (const name of readdirSync(`${folder}/bin`)) {
    if (name.startsWith('pip')) rmSync(`${folder}/bin/${name}`)
  }
  for (const wheel of WHEELS) {
    const file = `${folder}/wheel.zip`
    await download(wheel.url, wheel.sha256, file)
    // A wheel is a zip: opened with the system's own tool, so a Linux copy is made on a Mac.
    execFileSync('unzip', ['-q', '-o', file, '-d', `${folder}/${SITE_PACKAGES}`])
    rmSync(file)
  }
  writeFileSync(mark, `${wanted}\n`)
  return folder
}

const SYSTEMS = { darwin: 'mac', linux: 'linux' }
/** A Mac installer is built for both its processors; a Windows one carries the copy for WSL2. */
const DIST = { darwin: ['mac-arm64', 'mac-x64'], win32: ['linux-x64'], linux: ['linux-x64'] }
const asked = process.argv.slice(2)
const targets = asked.includes('--dist')
  ? DIST[process.platform]
  : asked.length > 0
    ? asked
    : [`${SYSTEMS[process.platform] ?? process.platform}-${process.arch}`]
for (const target of targets) {
  console.log(await fetchPython(target))
}
