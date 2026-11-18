/** Shows a notice of the system and tells when the person clicks it. */
export type SystemNotify = (title: string, body: string, onClick: () => void) => void

/** Whether the system refuses the notices of Octo: the option is on and nothing would be shown. */
export const notifyRefused = (): boolean =>
  typeof Notification !== 'undefined' && Notification.permission === 'denied'

/** The notice of the system as the browser part of Electron gives it; nothing where it is not. */
export const systemNotify: SystemNotify = (title, body, onClick) => {
  if (typeof Notification === 'undefined') return
  const notice = new Notification(title, { body })
  notice.onclick = onClick
}
