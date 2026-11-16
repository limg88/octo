// Asks something on the terminal without showing what is typed.
import { createInterface } from 'node:readline'

export function askHidden(question) {
  return new Promise((resolve) => {
    const terminal = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    process.stdout.write(question)
    // What is typed is not echoed: only the line break at the end is.
    terminal._writeToOutput = (text) => {
      if (text.includes('\n') || text.includes('\r')) process.stdout.write('\n')
    }
    terminal.question('', (answer) => {
      terminal.close()
      resolve(answer)
    })
  })
}
