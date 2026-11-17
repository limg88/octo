import { type Clock, createReadings, type Readings } from '@octo/application'
import type { Reader } from '@octo/domain'
import { createFsSharedReadings, createJsonSourceStates } from '../../src/index.ts'

export const PAOLA_AT_HER_MAC: Reader = { name: 'Paola Verdi', computer: 'mac-di-paola' }

/**
 * The turns of the readings as one computer takes them: what it did last in its own data folder,
 * what the project knows in the folder of the project.
 */
export function fsReadings(
  dataFolder: string,
  clock: Clock,
  me: Reader = PAOLA_AT_HER_MAC,
): Readings {
  return createReadings({
    shared: createFsSharedReadings(),
    states: createJsonSourceStates(dataFolder),
    clock,
    me: () => me,
  })
}
