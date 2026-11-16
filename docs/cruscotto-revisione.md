# «Cruscotto»: revisione critica e miglioramenti

Data: 16/11/2026. Raccoglie l'analisi della pagina com'era e ciò che il PM ha deciso in una revisione a domande. I paragrafi 1–13 sono il piano; **il §14 dice che cosa è stato fatto** e le scelte prese implementando; il §15 che cosa resta.

**Come è stato fatto.** Lettura del codice del Cruscotto (`apps/desktop/src/renderer/DashboardView.tsx`, `DashboardSettingsForm.tsx`, `packages/application/src/dashboard.ts`, `tracker-snapshot.ts`, `packages/domain/src/tracker/`), della roadmap (§ «Cruscotto bug e requisiti») e di `valutazione-interfaccia.md` §4.4. L'app non è stata avviata.

## Contesto

Il PM apre il Cruscotto per tre cose:
- **preparare riunioni e stato di avanzamento**: numeri e andamento da portare al cliente;
- **seguire i bug fermi**;
- **sollecitare le voci che aspettano una risposta**.

I problemi sentiti nell'uso, tutti e quattro quelli proposti:
- **elenco dei bug poco lavorabile**;
- **numeri senza confronto**;
- **requisiti rumorosi**;
- **dati da aggiornare a mano**.

Mancano: **l'avanzamento dello sprint**, **le ripartizioni** dei bug, **una sintesi di Claude**.

Rapporto con «Oggi»: **«Oggi» segnala, il Cruscotto analizza**. Le decisioni prese in una pagina valgono nell'altra.

## 1. La pagina com'è

Dall'alto:
1. «Impostazioni del cruscotto», chiuse.
2. Periodo: 8 settimane, 3, 6, 12 mesi, «Scelgo io» (due date e passo).
3. Età dei dati («Tracker letto il…») e «Leggi da Azure DevOps».
4. «Qualità: i bug del perimetro»: cinque numeri che fanno da filtro (aperti, in lavorazione, in verifica, fermi, validati), elenco e dettaglio affiancati. Nel dettaglio: ultimo commento, nota del PM, «Chiedi di questo bug», «Scrivi una nota».
5. «Andamento»: grafico di entrati, usciti e aperti a fine passo.
6. «Dove si fermano»: tre mediane (apertura → verifica → validazione → chiusura), solo con la cronologia.
7. «Requisiti poco chiari»: tabella con i segnali S1–S5, «×» sul segnale e «È chiaro» sulla storia.

Tutto è calcolato dal codice; Claude entra solo da «Chiedi di questo bug».

## 2. Che cosa non va

| Punto | Che cosa succede | Dove |
|---|---|---|
| Periodo | sta in cima a tutta la pagina ma cambia solo andamento e mediane; numeri ed elenco dei bug restano quelli di oggi | `DashboardView.tsx:254`, `dashboard.ts` `view` |
| Confronto | aperti, fermi e mediane sono valori di un istante: non dicono se va meglio o peggio | `bugs.ts` `bugDashboard` |
| Elenco dei bug | un solo ordine (giorni nello stato); nessun filtro per gravità, persona o ambiente; nessuna ricerca; nessun collegamento al bug su Azure DevOps | `bugs.ts:267`, `DashboardView.tsx` `Quality` |
| Ripartizioni | gravità, ambiente e assegnatario sono letti ma compaiono solo nel dettaglio di un bug | `bugs.ts` `BugRow` |
| Storie | la pagina mostra solo bug e requisiti poco chiari; storie e bug per sprint e stato sono calcolati per Claude (`_octo/cruscotto/riepilogo.md`) e non mostrati | `tracker/summary.ts` |
| Solleciti | non c'è un elenco di ciò che aspetta una risposta; il PM lo ricava bug per bug dall'ultimo commento | — |
| Requisiti | controllato tutto il lavoro da fare, non ciò che sta per essere pianificato; sigle S1–S5; S5 cerca parole anche nei commenti vecchi | `requirements.ts:37`, `:82` |
| Decisioni | «È chiaro», segnale tolto e note sono permanenti: nessun elenco, nessun ripristino; la nota di un requisito è calcolata e non mostrata | `DashboardView.tsx:606`, `model.ts` `DashboardDecisions` |
| Aggiornamento | il tracker si legge solo premendo il pulsante, e la lettura è completa ogni volta | `tracker-snapshot.ts` `read` |
| «Fermo» | nel Cruscotto è «oltre N giorni» (`>`), in «Oggi» «almeno N giorni» (`>=`): lo stesso bug può essere fermo in una pagina e non nell'altra | `bugs.ts:247`, `today/signals.ts:156` |
| Ordine della pagina | le impostazioni sono la prima riga; i requisiti stanno in fondo dopo grafico e mediane | `DashboardView.tsx:244` |

## 3. Decisioni del PM (16/11/2026)

- **Tre schede dentro la pagina**: «Sprint», «Bug», «Andamento». Solleciti e requisiti stanno nella scheda a cui appartengono.
- **Elenco dei bug lavorabile**: filtri, ripartizioni per gravità, ambiente e persona, ricerca, collegamento ad Azure DevOps. **È il primo incremento.**
- **Da sollecitare**: voci il cui **ultimo commento è una domanda** senza risposta e voci **in attesa del cliente**. A richiesta, **bozza di Claude da copiare** e collegamento alla voce. Octo non scrive nel tracker e non invia nulla.
- **Avanzamento dello sprint**: storie per stato, bug dello sprint, rischio a fine sprint, confronto fra sprint.
- **Il periodo in cima vale per tutta la pagina**: i numeri mostrano la differenza fra inizio e fine del periodo scelto.
- **Lettura del tracker da sola, in sottofondo**; il pulsante resta.
- **Sintesi di Claude a richiesta, sul periodo**. I numeri restano del codice.
- **Requisiti poco chiari solo sul prossimo sprint**; le regole S1–S5 non cambiano.
- **Decisioni prese**: un elenco con ripristino, e «Annulla» subito dopo il clic.
- **«Fermo»**: la soglia unica resta. Si allinea solo la regola fra Cruscotto e «Oggi».

Scartato: soglie di «fermo» per fase o gravità, «fermo, ma lo so» con scadenza, giudizio di Claude sui requisiti, sintesi automatica a ogni lettura, bozza di mail in Outlook, memoria dei solleciti fatti.

## 4. Struttura della pagina

Sopra le schede, sempre visibili: periodo, età dei dati con «Leggi da Azure DevOps», «Impostazioni del cruscotto» (un pulsante a destra, non più la prima riga).

| Scheda | Contenuto |
|---|---|
| **Sprint** | storie per stato, bug dello sprint, rischio a fine sprint, confronto fra sprint, requisiti poco chiari del prossimo sprint |
| **Bug** | numeri con differenza sul periodo, ripartizioni, elenco con filtri e dettaglio, «Da sollecitare» |
| **Andamento** | grafico, «Dove si fermano», sintesi di Claude |

La scheda aperta e i filtri si tengono in `DashboardFocus` (`renderer/context.ts`), come oggi filtro e bug in vista: arrivando da «Oggi» si apre la scheda giusta.

## 5. Scheda «Bug»: l'elenco lavorabile (primo incremento)

**Filtri.** Ai cinque numeri di oggi (che restano il primo filtro) si aggiungono, combinabili:
- gravità, ambiente, persona: valori presi dai bug del perimetro, «non indicato» compreso;
- ricerca su id e titolo;
- ordine: giorni nello stato (di partenza), gravità, data di apertura.

**Ripartizioni.** Tre tabelle piccole sopra l'elenco: per gravità, per ambiente, per persona. Ogni riga: aperti, di cui fermi. **Un clic su una riga è il filtro corrispondente**; un secondo clic lo toglie. I filtri attivi stanno in una riga sola con «Togli i filtri».

**Collegamento.** In ogni riga e nel dettaglio «Apri su Azure DevOps». L'indirizzo si costruisce da organizzazione e progetto della fonte e dall'id; con un'esportazione a mano, senza fonte collegata, il collegamento non si mostra. Da verificare se la lettura salva già l'indirizzo della voce.

**Dove.**
- Dominio: funzione pura `bugBreakdowns(rows)` e `filterBugs(rows, filter)` in `domain/src/tracker/`; `BugFilter` di `context.ts` diventa un oggetto (fase, gravità, ambiente, persona, testo).
- Applicazione: `DashboardView.bugs` porta le ripartizioni; l'indirizzo base delle voci viene dalla configurazione della fonte.
- Interfaccia: `Quality` in `DashboardView.tsx`, che conviene portare in un file suo (`BugsTab.tsx`): il file ha già 695 righe.

**Allineamento di «fermo».** Una sola funzione di dominio `isStuck(daysInState, stuckDays)` usata da `bugs.ts` e da `today/signals.ts`. Vale «oltre N giorni», come dice il testo della pagina.

## 6. «Da sollecitare»

Un elenco nella scheda «Bug», sotto i numeri, che riguarda **bug e storie** del perimetro non chiusi.

**Quando una voce ci entra** (regola del codice):
1. **domanda senza risposta**: l'ultimo commento contiene una domanda e ha più di N giorni lavorativi (impostazione, di partenza 2);
2. **attesa dal cliente**: come sopra, e chi deve rispondere non è una persona del fornitore. Chi è del fornitore lo dice già `ProjectTeam` (`assignedToOwnPeople`): l'ultimo commento è di una persona nostra e la voce è assegnata a una persona del cliente, oppure il commento nomina una persona del cliente.

La regola 2 è un sottoinsieme della 1: l'elenco ha un filtro «solo in attesa del cliente», acceso di partenza.

**Che cosa mostra una riga**: id, titolo, a chi è rivolta la domanda, da quanti giorni, la frase della domanda citata dal commento.

**Azioni**: «Apri su Azure DevOps»; «Prepara il sollecito», che chiede a Claude una bozza breve (a chi, che cosa si aspetta, da quando, citando voce e commento) mostrata in un riquadro con «Copia». Nessun invio, nessuna scrittura nel tracker, nessuna memoria del sollecito fatto.

**Punto aperto.** «Contiene una domanda» con una regola semplice (punto interrogativo, «puoi», «potete», «could you»…) darà falsi positivi: va provata sui commenti veri prima di fissarla. La bozza di Claude riusa il percorso di «Chiedi» (`onAsk`) o una chiamata propria: da decidere all'incremento.

**«Oggi»**: il conteggio «N voci aspettano una risposta dal cliente» diventa un segnale che apre questa vista. Da decidere insieme alla revisione di «Oggi», che ha già il suo filtro del rumore.

## 7. Scheda «Sprint»

Lo sprint mostrato è quello in corso; un menu permette di sceglierne un altro. Quale sia «in corso» va ricavato: il tracker letto ha il nome dello sprint di ogni voce (`TrackerItem.sprint`), **non le date**. Servono date di inizio e fine, lette dalle iterazioni di Azure DevOps o impostate come per l'allineamento. Da verificare che cosa è già disponibile.

- **Storie per stato**: da fare, in lavorazione, in verifica, validate, chiuse (le fasi di `phaseOf`), come numeri che aprono l'elenco, con il totale. Non ci sono story point: si contano le voci.
- **Bug dello sprint**: aperti e chiusi nello sprint, accanto alle storie, con collegamento alla scheda «Bug» già filtrata.
- **Rischio a fine sprint**: negli ultimi N giorni lavorativi (la stessa `SPRINT_ENDING_WORKDAYS` prevista per «Oggi»), le storie non ancora in verifica. Elenco con assegnatario e giorni nello stato.
- **Confronto fra sprint**: per gli ultimi sprint, storie chiuse, storie portate avanti (ancora aperte a fine sprint), bug entrati. Richiede la cronologia degli stati **anche delle storie**: oggi la lettura la prende solo per i bug (`tracker-snapshot.ts`). Senza cronologia la colonna non si mostra, e si dice perché.
- **Requisiti poco chiari**: la tabella di oggi, ristretta al **prossimo sprint** (o periodo di pianificazione). `requirementPeriods` nelle impostazioni resta come correzione a mano. Nomi al posto delle sole sigle nella colonna dei segnali; la nota del PM mostrata.

## 8. Il periodo vale per tutta la pagina

- Ogni numero della scheda «Bug» (aperti, in lavorazione, in verifica, fermi, validati) mostra accanto la **differenza fra inizio e fine del periodo** scelto: «42 · +5 da 8 settimane».
- Aperti a una data si ricavano già dalla cronologia (`openMoments`, `trendOf`). **Fermi a una data** e la divisione per fase a una data vanno calcolati dalla cronologia degli stati: funzione nuova. Senza cronologia la differenza non si mostra: nessuna stima.
- Le mediane di «Dove si fermano» si confrontano con il periodo precedente di pari durata.
- L'elenco dei bug resta quello di oggi: il periodo cambia i confronti, non le righe.

## 9. Lettura in sottofondo

- Il tracker entra nella lettura periodica delle altre fonti (`application/src/feeding.ts`), con lo stesso intervallo; in più, aprendo il Cruscotto con dati di oltre 24 ore parte una lettura.
- La pagina mostra subito i dati che ha e si aggiorna quando la lettura finisce; «Leggi da Azure DevOps» resta.
- Una lettura già in corso non ne fa partire un'altra (`running` in `tracker-snapshot.ts` c'è già).
- Da valutare: lettura delle sole voci cambiate dall'ultima volta, se la lettura completa in sottofondo risulta pesante.
- Vale il limite già scritto in roadmap: la lettura non è provata su un'organizzazione vera.

## 10. Sintesi di Claude, a richiesta

Nella scheda «Andamento», un pulsante «Commenta il periodo»: che cosa è cambiato, che cosa preoccupa, quali voci guardare.
- Claude riceve i numeri già calcolati (gli stessi di `trackerSummary`, più le differenze del §8) e **non ne calcola**: un numero nella sintesi che non coincide con quelli della pagina non si mostra.
- Ogni voce nominata ha id e collegamento, controllati dal codice.
- La sintesi porta data della lettura e periodo; cambiando periodo o dati è segnata come vecchia, non rifatta da sola.
- Senza Claude la pagina funziona uguale.

## 11. Decisioni prese

In «Impostazioni del cruscotto», o come riga che si apre nella scheda «Sprint», un elenco:

| Colonna | Contenuto |
|---|---|
| Voce | id e titolo |
| Decisione | «È chiaro», segnale tolto (quale), nota |
| Da quando | giorno della decisione |
| | «Ripristina» |

- Subito dopo «È chiaro» o «×» compare «Annulla» per qualche secondo, nello stesso posto di «Salvato.».
- I dati ci sono già con la data (`DashboardDecisions`); manca solo togliere una voce dagli elenchi.
- Una decisione presa qui vale in «Oggi» e viceversa: un requisito giudicato chiaro non torna come segnale.

## 12. Ordine degli incrementi

| # | Incremento | Dipende da |
|---|---|---|
| 1 | **Elenco dei bug lavorabile**: filtri, ripartizioni, ricerca, collegamento; `isStuck` unica | — |
| 2 | **Schede** «Sprint», «Bug», «Andamento»; impostazioni fuori dalla prima riga | 1 |
| 3 | **Da sollecitare**, con bozza di Claude a richiesta | 1 (collegamento), prova della regola sui commenti veri |
| 4 | **Scheda «Sprint»**: storie per stato, bug, rischio; requisiti sul prossimo sprint | 2, date degli sprint |
| 5 | **Decisioni prese** con ripristino e «Annulla» | — |
| 6 | **Lettura in sottofondo** | — |
| 7 | **Periodo su tutta la pagina**, con le differenze | cronologia |
| 8 | **Confronto fra sprint** | cronologia delle storie nella lettura |
| 9 | **Sintesi di Claude** | 7 |

L'ordine dopo il primo è una proposta: il PM ha fissato solo da dove partire. Ogni incremento esce con la sua demo in `demo/NN-<slug>/` e i suoi test.

## 13. Punti aperti

- **Date degli sprint**: da dove si prendono (iterazioni di Azure DevOps o impostazione).
- **Indirizzo delle voci**: se la lettura lo salva o va costruito dalla fonte.
- **Regola «è una domanda»** e **«chi deve rispondere è il cliente»**: da provare sui dati veri.
- **Cronologia delle storie**: quanto allunga la lettura.
- **Tracker diverso da Azure DevOps**: collegamento e lettura in sottofondo valgono solo per la fonte collegata; con un'esportazione a mano restano spenti.
- **Segnale in «Oggi»** per i solleciti: da decidere con `oggi-revisione.md`.

## 14. Stato dell'implementazione (16/11/2026)

**Impatto delle modifiche a «Oggi»** (fatte fra il piano e l'implementazione, `oggi-revisione.md` §13). Nessun file del Cruscotto era stato toccato. Tre cose hanno cambiato il piano:
- le **date degli sprint** ci sono già: «Oggi» le prende dal calendario del progetto (`sprintEnd`, `isSprintEnding`, periodi con il nome dello sprint in «Impostazioni»). Il Cruscotto usa la stessa fonte: il punto aperto del §13 è chiuso;
- la **lettura periodica** ha già il suo ciclo (15 minuti, `main.ts`), l'avviso `sourcesChanged` e `OCTO_DEV_SYNC_SECONDS` per le demo: il tracker ci è entrato, senza un ciclo suo;
- requisiti e allineamento in «Oggi» compaiono solo a fine sprint: il segnale dei requisiti legge ora gli stessi requisiti del Cruscotto, cioè quelli del prossimo sprint.

Tutti e nove gli incrementi del §12 sono fatti, in due demo.

| # | Incremento | Stato | Demo | Scelte fatte implementando |
|---|---|---|---|---|
| 1 | Elenco dei bug lavorabile | fatto | `demo/34-cruscotto-schede-e-bug` | Le ripartizioni si calcolano sui bug del numero scelto in alto, così le righe sommano al conteggio. Una ripartizione in cui nessun bug indica il valore non si mostra. L'indirizzo della voce lo costruisce il processo principale da organizzazione e progetto della fonte (`https://dev.azure.com/<org>/<progetto>/_workitems/edit/<id>`), solo per un id numerico e solo quando il cruscotto usa la lettura di Octo: la finestra non passa mai un indirizzo. «Fermo» è una funzione sola, `isStuck`: più giorni della soglia, anche in «Oggi» (prima «almeno»). |
| 2 | Tre schede | fatto | 34 | Ordine «Sprint», «Bug», «Andamento»; la pagina si apre su «Bug», che c'è sempre anche quando il tracker non porta sprint. Periodo, età dei dati e impostazioni stanno sopra le schede. La scheda e i filtri restano quando si va in un'altra sezione e si torna. |
| 3 | Da sollecitare | fatto | `demo/35-cruscotto-solleciti-e-sintesi` | Entra una voce (bug o storia del perimetro, non chiusa) il cui ultimo commento ha una frase che finisce con «?» o contiene parole di richiesta («puoi», «potete», «fateci sapere», «could you»…), da almeno N giorni lavorativi contati fino alla lettura del tracker (impostazione nuova, di partenza 2). «In attesa del cliente»: ha chiesto una persona del fornitore e la voce è assegnata a una persona del cliente, o il commento ne nomina una. Si cerca anche fra le voci non assegnate ai nostri, anche con «solo le persone del fornitore» acceso. Senza le due parti in «Impostazioni» il filtro non c'è e la pagina dice perché. Il sollecito è una chiamata propria a Claude (non passa da «Chiedi»), firmata con il nome di chi usa Octo. |
| 4 | Scheda «Sprint» | fatto | 34 | Lo sprint in corso è il periodo del calendario più corto che contiene oggi e ha il nome di uno sprint del tracker (anche scritto come percorso: `Aurora\PI 3\Sprint 12`). «Da fare» è la fase di lavorazione con uno stato dal nome «New», «To Do», «Ready»…. A rischio, negli ultimi 2 giorni lavorativi: le storie da fare o in lavorazione. Senza un periodo con il nome dello sprint la pagina lo dice e indica dove aggiungerlo. |
| 5 | Decisioni prese | fatto | 34 | L'elenco sta in fondo alla scheda «Sprint». «Annulla» resta 8 secondi e riporta le decisioni com'erano. Per una nota «Ripristina» si chiama «Togli la nota». Una decisione non mostra «Salvato.», che resta per le impostazioni. |
| 6 | Lettura in sottofondo | fatto | 35 | Il tracker si rilegge nella lettura periodica quando la sua lettura ha più di un'ora (`TRACKER_REFRESH_MS`), e aprendo il Cruscotto quando ha più di 24 ore. Solo se il cruscotto usa già la lettura di Octo: un'esportazione scelta a mano non viene sostituita. La lettura resta completa, non incrementale. Un errore della rilettura all'apertura si mostra; uno della lettura periodica va nel registro. |
| 7 | Periodo su tutta la pagina | fatto | 34 | Ogni numero dei bug porta la differenza con l'inizio del periodo, dalla cronologia (anche dei bug usciti dal perimetro nel frattempo). Senza cronologia la pagina lo dice e non stima. Le mediane hanno accanto quelle del periodo precedente di pari durata. |
| 8 | Confronto fra sprint | fatto | 34 | Ultimi 6 sprint cominciati. La lettura prende ora cronologia e commenti **anche delle storie**. «Chiuse in tempo» = validate o chiuse entro l'ultimo giorno. |
| 9 | Sintesi di Claude | fatto | 35 | Claude riceve i numeri della pagina e al più 6 frasi. Il codice tiene una frase solo se ogni numero che contiene è fra quelli dati e ogni voce `#id` è del tracker; la pagina dice quante ne ha tolte. La sintesi non è salvata: vive finché la pagina è aperta, ed è segnata come vecchia se cambiano periodo o lettura. |

**Dove sta il codice.** Dominio: `packages/domain/src/tracker/` (`bug-list.ts`, `waiting.ts`, `sprint.ts`, `decisions.ts`, `comment.ts`, `countsAt` in `bugs.ts`) e `workdays.ts`. Applicazione: `dashboard.ts`, `dashboard-advice.ts`, `tracker-snapshot.ts` (`refresh`). Adattatore: `infrastructure/src/claude/tracker-advisor.ts`. Interfaccia: `DashboardView.tsx` e `DashboardBugs`, `DashboardWaiting`, `DashboardSprint`, `DashboardTrend`.

**Verifica.** `pnpm test:coverage`: 1202 test, righe 97%, rami 90%. `pnpm e2e` e `pnpm e2e:cruscotto` (i passi delle demo 34 e 35 nella finestra vera, con un Azure DevOps finto) passano. Non provato su un Azure DevOps vero né con Claude vero.

## 15. Che cosa resta

- **Ambiente dei bug**: la lettura da Azure DevOps non lo porta (non è un campo standard); la ripartizione compare solo con un'esportazione che lo ha. Serve sapere quale campo usa il cliente.
- **Storie «portate avanti»**: la cronologia tiene stati e tag, non i cambi di sprint. Il confronto mostra le storie ancora aperte in uno sprint finito e quelle chiuse dopo; per il dato vero va letta anche la storia del campo sprint.
- **Regola «è una domanda»**: provata su dati sintetici. Su un tracker vero va guardata per i falsi positivi (una domanda retorica, una citazione).
- **Costo della lettura**: cronologia e commenti delle storie allungano la lettura; se in sottofondo pesa, va letta solo la parte cambiata.
- **Segnale in «Oggi»** per le voci da sollecitare: non fatto, da decidere con il filtro del rumore di «Oggi».
- **Sintesi e solleciti con Claude vero**: quante frasi il controllo dei numeri toglie in pratica (un «8 settimane» scritto da Claude passa solo se 8 è fra i numeri dati).
- **Testo sotto i numeri**: con un solo bug validato la frase dice «I 1 validati…»; il plurale fisso c'era già prima di questa revisione.
