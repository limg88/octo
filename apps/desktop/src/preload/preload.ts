import type { AgentProgress } from '@octo/application'
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type OctoApi } from '../shared/api.ts'

const api: OctoApi = {
  agentStatus: () => ipcRenderer.invoke(CHANNELS.agentStatus),
  listProjects: () => ipcRenderer.invoke(CHANNELS.projectsList),
  addProject: () => ipcRenderer.invoke(CHANNELS.projectsAdd),
  removeProject: (projectId) => ipcRenderer.invoke(CHANNELS.projectsRemove, { projectId }),
  listQuestions: (projectId) => ipcRenderer.invoke(CHANNELS.questionsList, { projectId }),
  ask: (projectId, question) => ipcRenderer.invoke(CHANNELS.questionsAsk, { projectId, question }),
  cancelAsk: (projectId) => ipcRenderer.invoke(CHANNELS.questionsCancel, { projectId }),
  openEvidence: (projectId, path) => ipcRenderer.invoke(CHANNELS.evidenceOpen, { projectId, path }),
  mailSource: (projectId) => ipcRenderer.invoke(CHANNELS.mailGet, { projectId }),
  saveMailSource: (projectId, config) =>
    ipcRenderer.invoke(CHANNELS.mailSave, { projectId, config }),
  syncMail: (projectId) => ipcRenderer.invoke(CHANNELS.mailSync, { projectId }),
  onSourcesChanged: (listener) => {
    const handler = (_event: unknown, projectId: string) => listener(projectId)
    ipcRenderer.on(CHANNELS.sourcesChanged, handler)
    return () => ipcRenderer.removeListener(CHANNELS.sourcesChanged, handler)
  },
  onProgress: (listener) => {
    const handler = (_event: unknown, projectId: string, progress: AgentProgress) =>
      listener(projectId, progress)
    ipcRenderer.on(CHANNELS.questionsProgress, handler)
    return () => ipcRenderer.removeListener(CHANNELS.questionsProgress, handler)
  },
}

contextBridge.exposeInMainWorld('octo', api)
