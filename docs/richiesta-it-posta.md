# Richiesta all'IT: leggere la posta del project manager su Windows

Scritta il 18/11/2026. È il testo da mandare all'IT; le parti fra parentesi quadre vanno completate da chi la manda. Lo stato della questione è in `verifiche-da-fare.md` («R6 — la posta su Windows»).

---

**Oggetto:** Octo — lettura della posta di un project manager su Windows (nuovo Outlook): che cosa è possibile

Ciao [nome],

stiamo provando Octo, un'applicazione desktop interna che aiuta i project manager a tenere il filo di un progetto: legge le fonti del progetto (documenti, tracker, posta), risponde a domande citando la fonte e prepara le bozze dei documenti ricorrenti. Gira sul computer del project manager; non ha un server.

Sul Mac Octo legge la posta dall'archivio locale del programma di posta. Sul PC del collega che fa da pilota questo non è possibile: usa il **nuovo Outlook per Windows** (versione 1.2026.1103.200, WebView2 157.0.4341.46), che non tiene un archivio locale leggibile e non offre l'automazione che aveva l'Outlook classico.

Prima di costruire qualunque cosa vorremmo sapere da voi quale di queste strade è percorribile.

**1. Microsoft Graph, permesso delegato `Mail.Read` (la strada che preferiamo)**

- Octo ha già, o avrà, una registrazione nel tenant per il solo accesso: applicazione pubblica, senza segreto, con i permessi di accesso e profilo. [ID dell'applicazione, se esiste già]
- Chiederemmo di aggiungere il permesso **delegato** `Mail.Read` (più `offline_access` per non chiedere l'accesso a ogni lettura). Non chiediamo permessi di applicazione né accesso a caselle altrui.
- Che cosa farebbe Octo: leggere, in sola lettura, la casella della persona che ha fatto l'accesso; tenere sul suo PC, nella cartella del progetto, il testo delle sole mail che riguardano il progetto (scelte con parole chiave, indirizzi e cartelle decise dal project manager). Non invia, non sposta, non cancella, non segna come letto.
- Domande: il consenso può darlo l'utente o serve quello dell'amministratore? Ci sono regole di accesso condizionale che lo impediscono (dispositivo gestito, posizione, applicazioni approvate)? Quanto durano i token e ogni quanto verrebbe richiesto l'accesso?

**2. In alternativa: l'Outlook classico sul PC del pilota**

- È consentito tornare all'Outlook classico, o tenerlo installato accanto al nuovo? Fino a quando lo prevedete?
- Con il classico la posta si può leggere sul PC senza permessi nel tenant. Ci servirebbe sapere se sui PC aziendali sono consentite l'automazione di Outlook e l'esecuzione di PowerShell.

**3. In alternativa: IMAP**

- IMAP è attivo sulle caselle del tenant, o attivabile per una casella? Con quale autenticazione?

**Che cosa non chiediamo**

- Nessun permesso sul calendario, sui file, su Teams.
- Nessun accesso a caselle condivise o di altre persone.
- Nessun dato esce dal PC verso un nostro server: non ne esiste uno. Il testo delle mail del progetto viene letto da Claude Code con la licenza aziendale della persona, come gli altri documenti del progetto. [confermare con chi gestisce la licenza che questo uso è previsto]

Se è più semplice parlarne dieci minuti, va benissimo. Per ora non costruiamo nulla: aspettiamo la vostra risposta per scegliere la strada.

Grazie,
[nome]
