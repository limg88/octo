/** A project is a folder on the PM's computer: the folder is the memory. */
export type Project = {
  id: string
  name: string
  folder: string
  addedAt: string
}

const PATH_SEPARATORS = /[\\/]+/
const FALLBACK_PROJECT_NAME = 'Progetto'

/** The last segment of a folder path, on Windows and on POSIX. */
export function projectNameFromFolder(folder: string): string {
  const segments = folder.split(PATH_SEPARATORS).filter((segment) => segment.length > 0)
  return segments.at(-1) ?? FALLBACK_PROJECT_NAME
}

export function sameFolder(a: string, b: string): boolean {
  return normalizeFolder(a) === normalizeFolder(b)
}

function normalizeFolder(folder: string): string {
  return folder.replace(/[\\/]+$/, '').normalize('NFC')
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters cannot be in a folder name.
const FORBIDDEN_IN_NAME = /[<>:"/\\|?*\u0000-\u001F]/
const MAX_NAME_LENGTH = 80

/** The name of a new project as the name of its folder; null when no system would accept it. */
export function projectFolderName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, ' ')
  const usable =
    clean !== '' &&
    clean.length <= MAX_NAME_LENGTH &&
    !FORBIDDEN_IN_NAME.test(clean) &&
    !clean.startsWith('.') &&
    !clean.endsWith('.')
  return usable ? clean : null
}

/** A file a new project starts with. */
export type StarterFile = { path: string; content: string }

const note = (title: string, body: string): string => `# ${title}\n\n${body}\n`

/**
 * What the folder of a new project holds: a place for each kind of material and a note that
 * says what goes where. Octo reads all of it, wherever a file is put; the folders only help
 * the people.
 */
export function starterFiles(name: string): StarterFile[] {
  return [
    {
      path: 'LEGGIMI.md',
      content: note(
        name,
        [
          'Cartella del progetto, creata da Octo. Metti qui tutto quello che riguarda il progetto: Octo lo legge e risponde citando i file.',
          '',
          '- `Contratti/`: ordini, offerte, capitolati, verbali di consegna.',
          '- `Documenti/`: analisi, specifiche, presentazioni, fogli di calcolo.',
          '- `Riunioni/`: trascrizioni e appunti, un file per riunione con la data nel nome.',
          '- `Tracker/`: le esportazioni del tracker, se non lo leggi da «Fonti».',
          '- `_octo/`: quello che scrive Octo (posta, testi estratti, deliverable). Non serve toccarla.',
          '',
          'Le cartelle sono un suggerimento: puoi rinominarle o aggiungerne altre.',
        ].join('\n'),
      ),
    },
    {
      path: 'Contratti/LEGGIMI.md',
      content: note('Contratti', 'Ordini, offerte, capitolati, verbali di consegna.'),
    },
    {
      path: 'Documenti/LEGGIMI.md',
      content: note('Documenti', 'Analisi, specifiche, presentazioni, fogli di calcolo.'),
    },
    {
      path: 'Riunioni/LEGGIMI.md',
      content: note(
        'Riunioni',
        'Trascrizioni e appunti: un file per riunione, con la data nel nome.',
      ),
    },
    {
      path: 'Tracker/LEGGIMI.md',
      content: note('Tracker', 'Le esportazioni del tracker, quando non lo leggi da «Fonti».'),
    },
  ]
}
