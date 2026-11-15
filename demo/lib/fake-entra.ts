// A fake sign-in of an organization on this computer, in place of Microsoft Entra ID: the page it
// shows has one button, and no password is asked.
// Usage: node demo/lib/fake-entra.ts            (prints where the sign-in lives and keeps running)
import { startFakeEntra } from '../../packages/infrastructure/test/support/fake-entra.ts'

export const DEMO_ENTRA = {
  tenantId: '11111111-2222-3333-4444-555555555555',
  clientId: 'octo-demo',
  person: { id: 'demo-paola', name: 'Paola Verdi', email: 'pm@example.test' },
}

if (import.meta.main) {
  const fake = await startFakeEntra({ ...DEMO_ENTRA, interactive: true })
  console.log(fake.authority)
  process.on('SIGTERM', () => {
    void fake.close().then(() => process.exit(0))
  })
}
