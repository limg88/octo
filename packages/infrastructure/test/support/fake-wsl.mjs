// Stands in for `wsl.exe` in tests and in the demo: lists one distribution of version 2 as the
// real one does (UTF-16), and runs what it is asked with the shell of this computer, from the
// folder it is told. It prints what it was asked on standard error when OCTO_FAKE_WSL_ECHO is set.
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
if (args[0] === '-l') {
  const list =
    '  NAME      STATE           VERSION\r\n* Ubuntu    Running         2\r\n  Vecchia   Stopped         1\r\n'
  process.stdout.write(Buffer.from(`\uFEFF${list}`, 'utf16le'))
  process.exit(0)
}
const at = (flag) => args[args.indexOf(flag) + 1]
const command = args.slice(args.indexOf('--exec') + 1)
if (process.env.OCTO_FAKE_WSL_ECHO) console.error(`wsl ${args.join(' ')}`)
const child = spawn(command[0], command.slice(1), {
  cwd: args.includes('--cd') ? at('--cd') : process.cwd(),
  stdio: 'inherit',
})
child.on('close', (code) => process.exit(code ?? 1))
