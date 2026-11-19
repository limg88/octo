# Esiti della seconda prova sul progetto reale

Prova della build R6c (`feat/r6c-esiti-prova`) su una copia del primo progetto reale, il 19/11/2026. Dieci rilievi, chiusi nel ramo `feat/r6d-esiti-seconda-prova` in cinque incrementi (J1–J5) più la chiusura. Nessun dato del progetto reale è riportato qui: nomi, sigle e testi restano fuori dal repository.

Che cosa resta da verificare sul progetto vero è in `verifiche-da-fare.md`, righe R6d.1–R6d.11.

## Rilievi e stato

| # | Rilievo | Incremento | Stato |
|---|---|---|---|
| 1 | Il logo non si legge in tema scuro | J2 | codice chiuso, da verificare (R6d.5) |
| 2 | «Che cosa hai fatto per gli acronimi?» | — | risposta sotto; esteso in J2 (R6d.11) |
| 3 | Un deliverable lanciato non è nell'elenco finché non è una bozza: da «Nuovo deliverable» non ci si torna | J2 | codice chiuso, da verificare (R6d.6) |
| 4 | Le colonne non si ridimensionano trascinandole | J2 | codice chiuso, da verificare (R6d.4) |
| 5 | «Il punto»: punti e riunioni di un altro progetto; il controllo sulle persone della squadra non viene fatto | J1 | codice chiuso, da verificare (R6d.1–R6d.3) |
| 6 | «Chiedi» va rivista come interfaccia, sul modello di una chat | J3 | codice chiuso, da verificare (R6d.7) |
| 7 | La rilettura critica è prolissa e sproporzionata | J4 | codice chiuso, da verificare (R6d.8) |
| 8 | I tipi «Memoria: …» non dicono che cosa fanno | J4 | codice chiuso, da verificare (R6d.9) |
| 9 | «Voce di backlog» non dice che cosa esce | J4 | ora «Storia con criteri di accettazione» (R6d.9) |
| 10 | L'allineamento dello sprint deve poter scrivere sul Jira interno | J5 | codice chiuso, da verificare (R6d.10) |

## Gli acronimi (rilievo 2)

Da R6c il progetto ha un glossario («Impostazioni» → «Persone e calendario» → «Glossario»): coppie «come lo scrive la trascrizione → forma giusta». Octo le applica ai testi delle riunioni quando entrano nel progetto e le dà a chi scrive i deliverable; Claude può proporre le coppie leggendo le trascrizioni, e il PM le approva una per una. Da J2 la correzione vale anche per `notes.md` e `report.md`, non solo per `transcript.md`, e una coppia aggiunta dopo corregge anche le riunioni già lette alla lettura successiva («Leggi ora»). Limite che resta: una riunione che non è più nella cartella di Verbale non viene riscritta.

## Esito di J1 — Una riunione è del progetto solo se c'è una sua persona

Causa: nella lettura delle riunioni registrate il calendario (un invito alla stessa ora nella posta del progetto) e le parole decidevano prima delle persone; con un solo progetto ogni registrazione che cadeva su un invito qualsiasi entrava, e la chiusura della giornata ne ricavava punti.

Ora chi partecipa viene prima. Quando la squadra nomina persone e alla riunione partecipano altri ma nessuno della squadra (il PM non conta), la riunione non è del progetto finché il PM non lo dice: calendario e parole scelgono solo fra i progetti che passano questo controllo. Vale per gli inviti del calendario in «Oggi» e per le registrazioni di Verbale. Senza partecipanti noti la regola di prima resta (invito, titolo). Una registrazione già importata che non passa il controllo esce da `_octo/riunioni/` alla lettura successiva insieme ai punti che aveva aperto, e aspetta fra le «riunioni da assegnare» con «non partecipa nessuno della squadra»; per questo conta solo l'elenco dei partecipanti di Verbale, mai un invito letto dalla posta. Ciò che il PM assegna a mano o sposta resta dov'è, chiunque abbia partecipato. In più: un punto che nessuno ha preso non è più del PM, e una chiusura apre al massimo 6 punti.

Conseguenza da sapere: la squadra del progetto deve contenere anche le persone del cliente che partecipano alle riunioni, altrimenti quelle riunioni vanno confermate una volta a mano.

## Esito di J2 — Trasversali

Un solo meccanismo per le colonne in tutte le tabelle (`Resizable`): si prende il bordo destro di qualsiasi intestazione, ogni colonna tiene la sua larghezza e la tabella scorre di lato; prima c'era solo in alcune tabelle, con una maniglia invisibile, e allargare una colonna stringeva le altre. Il logo sta su una tessera chiara in tema scuro. Un deliverable in scrittura è in testa all'elenco e riporta al modulo compilato.

## Esito di J3 — Chiedi

Conversazione nuova con saluto e domande pronte al centro; una sola scheda per scrivere (campo che cresce, allegati, «Con calcoli», un tondo che manda o ferma); domanda a fumetto; conversazioni su una riga, per giorno. Nessun cambio a ciò che Chiedi fa.

## Esito di J4 — Deliverable

A Claude sono chiesti al massimo 5 rilievi di 12 parole, con il perché solo se aggiunge qualcosa; Octo ne mostra al massimo 5, i più gravi per primi. Ogni rilievo è una riga, il passo citato si apre al clic, «Visto» e «Correggi» stanno sotto. «Che cosa regge» non è più in pagina; i controlli prima dell'approvazione sono una riga che si apre. I tipi della memoria stanno a parte sotto «Memoria del progetto», con che cosa sono; i loro titoli nei file non cambiano, così le pagine già scritte restano valide.

## Esito di J5 — Ticket sul Jira interno

È la prima cosa che Octo scrive fuori dalla cartella del progetto, e l'unica. Dopo l'allineamento il PM apre l'elenco dei ticket mancanti, spunta, indica il progetto Jira e conferma una frase che dice quanti e dove. Octo crea quelle issue una per una; il client che scrive ha una sola regola (`POST /rest/api/3/issue` sull'host del sito) e non può fare altro; ciò che è stato creato resta in `_octo/.lavori/allineamento/scritture.json` e non viene creato due volte; un ticket rifiutato non ferma gli altri. Octo non modifica e non cancella nulla su Jira.

Da sapere per la prova vera: serve un token che possa creare issue in quel progetto, e il tipo deve esistere lì. Non fatto in questo giro: cambio di stato e modifica dei ticket esistenti, Azure DevOps in scrittura.

## Misure

Suite: 113 file, 1.485 test verdi con copertura sopra soglia. Righe effettive: 46.201 in tutto (tetto 50.000), 18.843 in `apps/desktop/src` (tetto 20.000). Prove nell'app vera passate: `pnpm e2e`, `e2e:esiti`, `e2e:catalogo`, `e2e:memoria`, `e2e:script` (che crea i ticket su un Jira finto).
