/**
 * The models a PM can choose among, by the name Claude Code gives the latest of each family: a
 * name here never goes out of date when a family gets a new model.
 */
export const MODEL_CHOICES = ['fable', 'opus', 'sonnet', 'haiku'] as const
export type ModelChoice = (typeof MODEL_CHOICES)[number]

/** What Claude is asked to do in a project: each can have its own model. */
export const MODEL_TASKS = ['ask', 'write', 'review'] as const
export type ModelTask = (typeof MODEL_TASKS)[number]

/** The model of each task; null: the one Claude Code uses by default on this seat. */
export type ModelSettings = Record<ModelTask, ModelChoice | null>

export const DEFAULT_MODEL_SETTINGS: ModelSettings = { ask: null, write: null, review: null }

const choiceOf = (value: unknown): ModelChoice | null =>
  MODEL_CHOICES.find((choice) => choice === value) ?? null

/** Settings as they were kept or typed: a model that is not among the choices is the default. */
export function cleanModelSettings(settings: Partial<Record<ModelTask, unknown>>): ModelSettings {
  return {
    ask: choiceOf(settings.ask),
    write: choiceOf(settings.write),
    review: choiceOf(settings.review),
  }
}
