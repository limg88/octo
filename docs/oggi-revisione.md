# «Oggi»: revisione critica e miglioramenti

Data: 16/11/2026. Documento di progetto: nessun file dell'app è stato modificato. Parte da `riepilogo-giornaliero.md` (la pagina com'è) e raccoglie ciò che il PM ha deciso in una revisione a domande. L'implementazione parte, un incremento per volta, quando il PM la chiede.

**Come è stato fatto.** Lettura del codice di «Oggi» (`apps/desktop/src/renderer/TodayView.tsx`, `packages/application/src/today.ts`, `packages/domain/src/today/`) e di `demo/23-oggi`. L'app non è stata avviata.

## Contesto

Il PM apre «Oggi» **più volte al giorno**, non solo al mattino. I problemi sentiti nell'uso:
- **troppo rumore**: soprattutto la posta e il tracker;
- **priorità poco chiara**: non si capisce subito che cosa fare per primo;
- **azioni poco efficaci**: ciò che è messo da parte non si ritrova, «Rimanda» ha solo tre date, «Fatto» va dichiarato a mano.

Claude deve essere **più attivo**, ma la scelta di che cosa viene prima resta **una regola del codice**.

## 1. La pagina com'è

Dall'alto:
1. Intestazione: giorno, freschezza delle fonti in una riga `Fonte: data · Fonte: data…`, «Registro dei rischi», «Leggi ora».
2. Avvisi (`alert`): fonti in errore, ferme o mai lette, tracker vecchio. Si possono solo aprire.
3. «Da fare oggi» (`due`, `waiting`, `numbers`): filtri per gruppo, al più 7 voci (`TODAY_LIMIT`) e «mostra altre», elenco e dettaglio affiancati. Azioni: Apri, Chiedi (solo mail), Fatto, Rimanda (domani, lunedì, +7), Non è mia, Metti da parte.
4. Valutazione di Claude: da sola una volta al giorno, solo sulle mail; una volta a settimana propone anche i rischi, senza dirlo.
5. «Da tenere d'occhio» (`watch`): tabella con Apri, ×, «È mia».
6. In fondo: offerte di silenziare un tipo, «N segnalazioni messe da parte».

## 2. Che cosa non va

| Punto | Che cosa succede | Dove |
|---|---|---|
| Ordine | dopo la fascia si ordina per `weight`, che non si confronta fra tipi diversi (giorni di una mail contro numero di bug) | `domain/src/today/model.ts` `orderToday` |
| Rumore della posta | mail messe in «Rispondi a…» che non chiedono nulla (informative, ringraziamenti, conferme); troppe righe «da seguire» in «Da tenere d'occhio» | `domain/src/today/mail-signals.ts` |
| Rumore del tracker | «Requisiti poco chiari» è un elenco statico, sempre presente; l'allineamento dello sprint sta in `numbers` per tutto lo sprint | `domain/src/today/signals.ts` `requirementItems`, `alignmentItems` |
| Messe da parte | si vede solo il conteggio; si può annullare solo l'ultima decisione | `TodayView.tsx` (`view.hidden`) |
| «Fatto» | è una dichiarazione: il codice non la verifica e il segnale torna dopo 3 giorni lavorativi | `domain/src/today/decisions.ts` `comesBack` |
| «Rimanda» | solo domani, lunedì, +7 | `TodayView.tsx` `SignalDetail` |
| Freschezza | la riga ripete gli avvisi delle fonti; con molte fonti non si legge | `TodayView.tsx` `today-freshness` |
| Valutazione | il riquadro sta fra «Da fare» e «Da tenere d'occhio» e spezza la lettura | `TodayView.tsx` `Judgement` |
| Costo | ogni decisione calcola la pagina due volte (`compute`, poi `view`) e rilegge le mail di due mesi | `application/src/today.ts` `decide`, `mailTurn` |

## 3. Decisioni del PM (16/11/2026)

- **«Adesso»**: in cima, le 3 cose che vengono prima. **Le sceglie il codice** con una regola leggibile; **Claude spiega** perché contano.
- **Filtro del rumore**: Claude giudica se un segnale chiede davvero qualcosa. Quello che non lo chiede va **fra le messe da parte, con il motivo**, e si può riaprire.
- **Requisiti e allineamento**: compaiono **solo a fine sprint**.
- **Messe da parte**: una vista che si consulta, con ripristino.
- **Fatto automatico** e **Rimanda a una data scelta**.
- **Fra una visita e l'altra**: novità segnate, lettura automatica, contatore accanto a «Oggi» nella barra laterale, notifica di sistema **solo quando un segnale entra in «Adesso»**.

## 4. «Adesso»

Un riquadro sopra «Da fare oggi» con al più tre voci, tolte dall'elenco sotto.

**La regola**, nell'ordine; a parità vale `orderToday`:
1. una riunione che comincia entro 2 ore;
2. un segnale con `dueBecause` (scadenza di una mail entro domani, fine sprint, chiusura del mese);
3. un segnale rimandato a oggi (`returned.why === 'later'`);
4. una mail «Rispondi a…» giudicata di importanza alta;
5. un segnale peggiorato (`returned.why === 'worse'`).

Ciò che non rientra in una di queste regole non entra in «Adesso», anche se resta spazio: meglio due voci certe che tre di riempimento.

Ogni voce dice **perché è lì** con le parole della regola («Fra 40 minuti», «Scade domani», «L'avevi rimandata a oggi»).

**La sintesi di Claude**: due o tre righe sotto le voci, scritte nella valutazione del giorno, che dicono perché quelle cose contano oggi. Ogni affermazione ha la sua citazione, controllata dal codice come per le mail; una frase senza citazione verificata non si mostra. Senza Claude (non installato, o valutazione non ancora fatta) il riquadro funziona lo stesso, senza sintesi.

Funzione di dominio pura `nowItems(items, now)` in `domain/src/today/`; la vista la riceve già calcolata in `TodayView`.

## 5. Claude filtra il rumore

Oggi la valutazione dice di una mail l'importanza, il destinatario (`addressee`), la citazione e la scadenza. Si aggiunge **se la mail chiede un'azione** al PM:

- campo `asksAction: boolean` in `MailJudgement`, con `reason` e `quote` già presenti come motivo;
- vale per `mail_reply` e per `mail_follow`;
- una mail con `asksAction === false` e citazione verificata è **messa da parte da Claude**: non sta né in «Da fare» né in «Da tenere d'occhio», sta nella vista delle messe da parte con l'etichetta «Claude: non chiede un'azione» e il motivo;
- con la citazione non verificata la mail resta dov'è: il codice non toglie dalla pagina su una parola che non ha trovato;
- «Ripristina» è la parola del PM e vale più di quella di Claude: si registra come `mailTurn` `mine` della conversazione, così la valutazione successiva non la toglie di nuovo.

Il giudizio vecchio, senza `asksAction`, vale come «chiede un'azione»: niente sparisce finché Claude non l'ha rivalutato.

## 6. Tracker: requisiti e allineamento solo a fine sprint

- `requirementItems` e `alignmentItems` producono un segnale solo negli ultimi `SPRINT_ENDING_WORKDAYS` giorni lavorativi dello sprint impostato.
- Senza sprint impostato: nessun segnale per nessuno dei due.
- Restano consultabili nel Cruscotto e in «Allineamento».
- Bug fermi e tracker vecchio non cambiano.

## 7. Le messe da parte

Al posto di «N segnalazioni messe da parte», un pulsante che apre l'elenco (sotto «Da tenere d'occhio», chiuso di partenza):

| Colonna | Contenuto |
|---|---|
| Che cosa | titolo del segnale |
| Stato | Fatto, Rimandato al …, Messo da parte, Claude: non chiede un'azione |
| Da quando | giorno della decisione |
| | «Ripristina» |

In una seconda parte, **i tipi silenziati** con «Mostra di nuovo» (oggi si tolgono solo dalle impostazioni).

`applyDecisions` restituisce già il conteggio; deve restituire anche **le voci nascoste con la loro decisione** (`hiddenItems`). Il ripristino usa `decide(..., 'open')`, che esiste già.

## 8. Fatto automatico e Rimanda a una data

**Fatto automatico.** Molti segnali spariscono da soli quando il dato cambia (la mail ha risposta, le ore tornano). Mancano due cose:
- una decisione «Fatto» il cui segnale non c'è più si cancella dalle impostazioni al calcolo successivo, così se il problema si ripresenta torna come nuovo e non come «ancora lì»;
- un segnale marcato fatto il cui peso **scende** resta nascosto senza attendere i 3 giorni lavorativi; torna solo se il peso risale sopra quello del giorno della decisione (regola `worse` già esistente).

Nell'elenco, sopra le messe da parte: «Risolti da soli oggi: N», per vedere che cosa la pagina ha chiuso senza il PM.

**Rimanda a una data.** Nel riquadro di «Rimanda», oltre a domani, lunedì e +7:
- «A fine sprint», quando lo sprint è impostato;
- un campo data (dopo oggi, come già controlla `decide`).

## 9. Fra una visita e l'altra

**Lettura automatica.** C'è già: ad app aperta ogni progetto si rilegge ogni 15 minuti (`apps/desktop/src/main/main.ts:127`) e «Oggi» si aggiorna su `sourcesChanged`. Da fare: dirlo nella pagina («Prossima lettura fra 12 minuti») invece della riga di freschezza; la freschezza resta, compatta, solo per le fonti che non sono già un avviso.

**Novità segnate.** Si tiene il momento dell'ultima visita alla pagina di ogni progetto (`lastSeenAt` in `TodaySettings`). Un segnale la cui chiave non c'era, o il cui peso è salito, porta l'etichetta «Nuovo» o «Peggiorato». La visita conta quando la pagina resta aperta almeno qualche secondo, non quando si passa.

**Contatore nella barra laterale.** Accanto a «Oggi»: il numero di voci di «Adesso» più «Da fare oggi», calcolato dal codice, aggiornato dopo ogni lettura. Nessun numero quando è zero.

**Notifica di sistema.** Solo quando, dopo una lettura, **entra in «Adesso» un segnale che prima non c'era**. Una notifica per lettura al più, con il titolo del primo segnale e il progetto; un clic apre «Oggi» di quel progetto. Non scatta se la finestra di Octo è in primo piano su quella pagina. Si può spegnere nelle impostazioni di «Oggi».

## 10. Pulizie

- Il riquadro della valutazione di Claude va in fondo alla pagina, sopra le impostazioni; in «Adesso» resta la sola sintesi.
- La proposta settimanale dei rischi si dichiara nel riquadro («e i rischi, una volta a settimana»).
- `decide`, `mailTurn`, `muteKind`, `saveAddresses` calcolano la pagina una volta sola: il risultato di `compute` passa a una funzione che costruisce la vista.

## 11. Piano a incrementi

Ogni incremento ha la sua demo (aggiornamento di `demo/23-oggi` o una demo nuova) e i suoi test.

| # | Incremento | Paragrafi | Claude |
|---|---|---|---|
| A | «Adesso» con la regola; requisiti e allineamento solo a fine sprint; pulizie | §4 (senza sintesi), §6, §10 | no |
| B | Messe da parte consultabili; Fatto automatico; Rimanda a una data | §7, §8 | no |
| C | Claude filtra il rumore (`asksAction`) e scrive la sintesi di «Adesso» | §4 (sintesi), §5 | sì |
| D | Novità segnate, contatore, notifica, prossima lettura | §9 | no |

A e B non dipendono da Claude e tolgono la maggior parte del rumore percepito; C si appoggia alla vista delle messe da parte di B.

## 12. Da decidere o verificare

- Le soglie di «Adesso» (2 ore per la riunione) sono proposte: da confermare con l'uso.
- Se una mail messa da parte da Claude debba contare nel contatore delle messe da parte o stare in un conteggio a parte.
- Il costo della valutazione con `asksAction` anche per le mail da seguire: oggi Claude giudica solo quelle che aspettano il PM (`threads.awaitingMe`).
- La notifica su Windows: da provare sul pilota.

## 13. Stato dell'implementazione

| # | Stato | Demo | Scelte fatte implementando |
|---|---|---|---|
| A | fatto (16/11/2026) | `demo/30-oggi-adesso` | Una riunione entra in «Adesso» solo se comincia entro 2 ore e non è già cominciata. Con lo sprint impostato ma senza un periodo del calendario con lo stesso nome, la fine dello sprint non si conosce: requisiti e allineamento non compaiono. `decide`, `mailTurn` e `muteKind` calcolano la pagina una volta sola. |
| B | fatto (16/11/2026) | `demo/31-oggi-messe-da-parte` | «Risolti da soli oggi» conta ogni segnale che c'era all'ultimo calcolo e non c'è più (decisione del PM), tranne riunioni e date del calendario, che finiscono con il giorno, e i tipi che in quel momento non si possono dire: sezione non leggibile, sprint non in chiusura per requisiti e allineamento, mese non in chiusura per le scadenze. Le chiavi dell'ultimo calcolo stanno in `oggi.json` (`present`, `resolved`). I segnali di un tipo silenziato non stanno nella tabella: si riaccende il tipo. |
| C | fatto (16/11/2026) | `demo/32-oggi-claude-filtra` | `asksAction` vale «il PM ha qualcosa da fare»: è falso solo se nulla si perde a non riaprire la mail; nel dubbio vero. Le mail tolte da Claude hanno un conteggio a parte nel pulsante (decisione del PM). Solo «Tocca a me» protegge una mail dal filtro. Un giudizio senza `asksAction` è da rifare: la valutazione automatica del giorno lo rilegge (costo una tantum; Claude giudicava già tutte le mail che aspettano il PM, anche quelle poi solo «da seguire»). La sintesi di «Adesso» è una seconda domanda nella stessa valutazione, una frase per voce al più, mostrata solo il giorno in cui è scritta; la valutazione automatica parte una volta al giorno anche senza mail nuove, se «Adesso» non è vuoto. |
