import type { AgentProgress, FeedingStep } from '@octo/application'
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type OctoApi } from '../shared/api.ts'

const api: OctoApi = {
  agentStatus: () => ipcRenderer.invoke(CHANNELS.agentStatus),
  listProjects: () => ipcRenderer.invoke(CHANNELS.projectsList),
  addProject: () => ipcRenderer.invoke(CHANNELS.projectsAdd),
  removeProject: (projectId) => ipcRenderer.invoke(CHANNELS.projectsRemove, { projectId }),
  restoreProject: (projectId) => ipcRenderer.invoke(CHANNELS.projectsRestore, { projectId }),
  chooseProjectPath: (projectId, what, extensions) =>
    ipcRenderer.invoke(CHANNELS.projectsChoosePath, { projectId, what, extensions }),
  listQuestions: (projectId) => ipcRenderer.invoke(CHANNELS.questionsList, { projectId }),
  ask: (projectId, question) => ipcRenderer.invoke(CHANNELS.questionsAsk, { projectId, question }),
  cancelAsk: (projectId) => ipcRenderer.invoke(CHANNELS.questionsCancel, { projectId }),
  openEvidence: (projectId, path) => ipcRenderer.invoke(CHANNELS.evidenceOpen, { projectId, path }),
  mailSource: (projectId) => ipcRenderer.invoke(CHANNELS.mailGet, { projectId }),
  saveMailSource: (projectId, config) =>
    ipcRenderer.invoke(CHANNELS.mailSave, { projectId, config }),
  syncMail: (projectId) => ipcRenderer.invoke(CHANNELS.mailSync, { projectId }),
  previewMail: (projectId, config) =>
    ipcRenderer.invoke(CHANNELS.mailPreview, { projectId, config }),
  feedingStatus: (projectId) => ipcRenderer.invoke(CHANNELS.feedingStatus, { projectId }),
  fill: (projectId) => ipcRenderer.invoke(CHANNELS.feedingFill, { projectId }),
  onFeedingStep: (listener) => {
    const handler = (_event: unknown, projectId: string, step: FeedingStep) =>
      listener(projectId, step)
    ipcRenderer.on(CHANNELS.feedingStep, handler)
    return () => ipcRenderer.removeListener(CHANNELS.feedingStep, handler)
  },
  feedChoices: (projectId, feed, config, secret) =>
    ipcRenderer.invoke(CHANNELS.feedChoices, { projectId, feed, config, secret }),
  feed: (projectId, feed) => ipcRenderer.invoke(CHANNELS.feedGet, { projectId, feed }),
  saveFeed: (projectId, feed, config, secret) =>
    ipcRenderer.invoke(CHANNELS.feedSave, { projectId, feed, config, secret }),
  syncFeed: (projectId, feed) => ipcRenderer.invoke(CHANNELS.feedSync, { projectId, feed }),
  documentsState: (projectId) => ipcRenderer.invoke(CHANNELS.documentsGet, { projectId }),
  convertDocuments: (projectId) => ipcRenderer.invoke(CHANNELS.documentsConvert, { projectId }),
  onSourcesChanged: (listener) => {
    const handler = (_event: unknown, projectId: string) => listener(projectId)
    ipcRenderer.on(CHANNELS.sourcesChanged, handler)
    return () => ipcRenderer.removeListener(CHANNELS.sourcesChanged, handler)
  },
  deliverableCatalog: (projectId) =>
    ipcRenderer.invoke(CHANNELS.deliverablesCatalog, { projectId }),
  saveDeliverableKind: (projectId, input) =>
    ipcRenderer.invoke(CHANNELS.kindSave, { projectId, input }),
  removeDeliverableKind: (projectId, kindId) =>
    ipcRenderer.invoke(CHANNELS.kindRemove, { projectId, kindId }),
  listDeliverables: (projectId) => ipcRenderer.invoke(CHANNELS.deliverablesList, { projectId }),
  startDeliverable: (projectId, kindId, inputs) =>
    ipcRenderer.invoke(CHANNELS.deliverablesStart, { projectId, kindId, inputs }),
  reviseDeliverable: (projectId, deliverableId, request) =>
    ipcRenderer.invoke(CHANNELS.deliverablesRevise, { projectId, deliverableId, request }),
  approveDeliverable: (projectId, deliverableId) =>
    ipcRenderer.invoke(CHANNELS.deliverablesApprove, { projectId, deliverableId }),
  deliverableInstructions: (projectId, kindId) =>
    ipcRenderer.invoke(CHANNELS.instructionsGet, { projectId, kindId }),
  saveDeliverableInstructions: (projectId, kindId, text) =>
    ipcRenderer.invoke(CHANNELS.instructionsSave, { projectId, kindId, text }),
  hasLetterhead: (projectId) => ipcRenderer.invoke(CHANNELS.letterheadGet, { projectId }),
  chooseLetterhead: (projectId) => ipcRenderer.invoke(CHANNELS.letterheadChoose, { projectId }),
  removeLetterhead: (projectId) => ipcRenderer.invoke(CHANNELS.letterheadRemove, { projectId }),
  hasDeckModel: (projectId) => ipcRenderer.invoke(CHANNELS.deckModelGet, { projectId }),
  chooseDeckModel: (projectId) => ipcRenderer.invoke(CHANNELS.deckModelChoose, { projectId }),
  removeDeckModel: (projectId) => ipcRenderer.invoke(CHANNELS.deckModelRemove, { projectId }),
  hoursSettings: (projectId) => ipcRenderer.invoke(CHANNELS.hoursSettingsGet, { projectId }),
  saveHoursSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.hoursSettingsSave, { projectId, settings }),
  hoursCandidates: (projectId) => ipcRenderer.invoke(CHANNELS.hoursCandidates, { projectId }),
  hoursView: (projectId, period) => ipcRenderer.invoke(CHANNELS.hoursView, { projectId, period }),
  readTrackerHours: (projectId, period) =>
    ipcRenderer.invoke(CHANNELS.hoursReadTracker, { projectId, period }),
  forecastSettings: (projectId) => ipcRenderer.invoke(CHANNELS.forecastSettingsGet, { projectId }),
  saveForecastSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.forecastSettingsSave, { projectId, settings }),
  forecastCandidates: (projectId) => ipcRenderer.invoke(CHANNELS.forecastCandidates, { projectId }),
  forecastView: (projectId, month) =>
    ipcRenderer.invoke(CHANNELS.forecastView, { projectId, month }),
  compileForecast: (projectId, month) =>
    ipcRenderer.invoke(CHANNELS.forecastCompile, { projectId, month }),
  progressSettings: (projectId) => ipcRenderer.invoke(CHANNELS.progressSettingsGet, { projectId }),
  saveProgressSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.progressSettingsSave, { projectId, settings }),
  progressCandidates: (projectId) => ipcRenderer.invoke(CHANNELS.progressCandidates, { projectId }),
  progressView: (projectId) => ipcRenderer.invoke(CHANNELS.progressView, { projectId }),
  compileProgress: (projectId, n) => ipcRenderer.invoke(CHANNELS.progressCompile, { projectId, n }),
  alignmentSettings: (projectId) =>
    ipcRenderer.invoke(CHANNELS.alignmentSettingsGet, { projectId }),
  saveAlignmentSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.alignmentSettingsSave, { projectId, settings }),
  alignmentView: (projectId) => ipcRenderer.invoke(CHANNELS.alignmentView, { projectId }),
  alignmentChoices: (projectId) => ipcRenderer.invoke(CHANNELS.alignmentChoices, { projectId }),
  exportMissingTickets: (projectId) => ipcRenderer.invoke(CHANNELS.alignmentExport, { projectId }),
  team: (projectId) => ipcRenderer.invoke(CHANNELS.teamGet, { projectId }),
  saveTeam: (projectId, team) => ipcRenderer.invoke(CHANNELS.teamSave, { projectId, team }),
  modelSettings: (projectId) => ipcRenderer.invoke(CHANNELS.modelsGet, { projectId }),
  saveModelSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.modelsSave, { projectId, settings }),
  preferences: () => ipcRenderer.invoke(CHANNELS.preferencesGet),
  savePreferences: (preferences) => ipcRenderer.invoke(CHANNELS.preferencesSave, preferences),
  createProject: (name) => ipcRenderer.invoke(CHANNELS.projectsCreate, { name }),
  readTimesheets: (projectId, period) =>
    ipcRenderer.invoke(CHANNELS.hoursReadTimesheets, { projectId, period }),
  readTrackerSnapshot: (projectId) =>
    ipcRenderer.invoke(CHANNELS.dashboardReadTracker, { projectId }),
  saveBackup: () => ipcRenderer.invoke(CHANNELS.backupSave),
  restoreBackup: () => ipcRenderer.invoke(CHANNELS.backupRestore),
  dashboardSettings: (projectId) =>
    ipcRenderer.invoke(CHANNELS.dashboardSettingsGet, { projectId }),
  saveDashboardSettings: (projectId, settings) =>
    ipcRenderer.invoke(CHANNELS.dashboardSettingsSave, { projectId, settings }),
  dashboardCandidates: (projectId) =>
    ipcRenderer.invoke(CHANNELS.dashboardCandidates, { projectId }),
  dashboardView: (projectId, range) =>
    ipcRenderer.invoke(CHANNELS.dashboardView, { projectId, range }),
  onDeliverableProgress: (listener) => {
    const handler = (_event: unknown, projectId: string, progress: AgentProgress) =>
      listener(projectId, progress)
    ipcRenderer.on(CHANNELS.deliverablesProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.deliverablesProgress, handler)
  },
  session: () => ipcRenderer.invoke(CHANNELS.sessionGet),
  signIn: () => ipcRenderer.invoke(CHANNELS.sessionSignIn),
  cancelSignIn: () => ipcRenderer.invoke(CHANNELS.sessionCancel),
  signOut: () => ipcRenderer.invoke(CHANNELS.sessionSignOut),
  todayView: (projectId) => ipcRenderer.invoke(CHANNELS.todayView, { projectId }),
  decideToday: (projectId, key, state, until) =>
    ipcRenderer.invoke(CHANNELS.todayDecide, { projectId, key, state, until }),
  muteTodayKind: (projectId, kind, muted) =>
    ipcRenderer.invoke(CHANNELS.todayMute, { projectId, kind, muted }),
  saveOwnAddresses: (projectId, addresses) =>
    ipcRenderer.invoke(CHANNELS.todayAddresses, { projectId, addresses }),
  evaluateToday: (projectId, all) => ipcRenderer.invoke(CHANNELS.todayEvaluate, { projectId, all }),
  cancelEvaluateToday: (projectId) => ipcRenderer.invoke(CHANNELS.todayCancel, { projectId }),
  onTodayProgress: (listener) => {
    const handler = (_event: unknown, projectId: string, progress: AgentProgress) =>
      listener(projectId, progress)
    ipcRenderer.on(CHANNELS.todayProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.todayProgress, handler)
  },
  todayOverview: () => ipcRenderer.invoke(CHANNELS.todayOverview),
  risks: (projectId) => ipcRenderer.invoke(CHANNELS.risksGet, { projectId }),
  proposeRisks: (projectId) => ipcRenderer.invoke(CHANNELS.risksPropose, { projectId }),
  acceptRisk: (projectId, candidateId, title) =>
    ipcRenderer.invoke(CHANNELS.risksAccept, { projectId, candidateId, title }),
  dismissRisk: (projectId, candidateId) =>
    ipcRenderer.invoke(CHANNELS.risksDismiss, { projectId, candidateId }),
  addRisk: (projectId, title) => ipcRenderer.invoke(CHANNELS.risksAdd, { projectId, title }),
  updateRisk: (projectId, riskId, change) =>
    ipcRenderer.invoke(CHANNELS.risksUpdate, { projectId, riskId, change }),
  assignment: (projectId) => ipcRenderer.invoke(CHANNELS.assignmentGet, { projectId }),
  onProgress: (listener) => {
    const handler = (_event: unknown, projectId: string, progress: AgentProgress) =>
      listener(projectId, progress)
    ipcRenderer.on(CHANNELS.questionsProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.questionsProgress, handler)
  },
}

contextBridge.exposeInMainWorld('octo', api)
