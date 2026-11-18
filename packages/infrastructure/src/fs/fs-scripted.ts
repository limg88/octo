import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { KeptSettings, ScriptedTemplates } from '@octo/application'
import { isScriptedName } from '@octo/domain'
import { isMissing, readJsonOr } from './json-file.ts'
import { PROJECT_SETTINGS_FOLDER } from './project-files.ts'

/** A file that is not part of a deliverable: a note of the system, a cache of the interpreter. */
const NOT_A_FILE = /^\.|\.pyc$/

/**
 * The deliverables with a script that travel with the app: one folder each, with its manifest,
 * its instructions and its script. A project starts its own copy from here.
 */
export function createFsScriptedTemplates(folder: string): ScriptedTemplates {
  const entriesOf = async (path: string) => {
    try {
      return await readdir(path, { withFileTypes: true })
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
  }
  return {
    async slugs() {
      const entries = await entriesOf(folder)
      return entries
        .filter((entry) => entry.isDirectory() && isScriptedName(entry.name))
        .map((entry) => entry.name)
        .sort()
    },
    async files(slug) {
      if (!isScriptedName(slug)) return []
      const entries = await entriesOf(join(folder, slug))
      const names = entries
        .filter((entry) => entry.isFile() && !NOT_A_FILE.test(entry.name))
        .map((entry) => entry.name)
        .sort()
      return Promise.all(
        names.map(async (name) => ({ name, content: await readFile(join(folder, slug, name)) })),
      )
    },
  }
}

/** The settings a section kept, read as they are: the file is never changed nor removed. */
export function createFsKeptSettings(): KeptSettings {
  return {
    read: (projectFolder, name) =>
      readJsonOr(join(projectFolder, PROJECT_SETTINGS_FOLDER, name), null).catch(() => null),
  }
}
