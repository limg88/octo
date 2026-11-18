# Verifica di Octo su DEEM e Petrolvalves

Data: 17 novembre 2026. Versione verificata: 0.8.0.

## Sintesi

Octo regge bene DEEM, il progetto per cui è nato (a giornate, Azure DevOps più Jira). Su Petrolvalves (a corpo, solo Jira) tre sezioni su nove non danno niente di utile e il previsionale non risponde alla domanda che conta: quanto margine fa la commessa.

Tre errori vanno corretti prima di tutto, perché mostrano numeri o contenuti sbagliati senza avvisare:

1. Il previsionale a corpo calcola l'avanzamento solo sui mesi di timesheet scaricati a mano in «Ore».
2. Il riepilogo del cruscotto che Claude cita nei report conta su DEEM alcune decine di bug aperti; il cruscotto ne mostra meno di venti.
3. Due riunioni di DEEM sono finite in Petrolvalves: tutti i punti aperti di Petrolvalves (un paio di decine) sono di DEEM.

Il piano interventi è in fondo. Nessuna correzione al codice è stata fatta in questa verifica.

*Nota del 18/11/2026*: importi e conteggi sono sostituiti da ordini di grandezza, i nomi di riunioni e temi da descrizioni generiche (decisione del PM, `docs/revisione-roadmap.md` §10).

## Come è stata fatta

- **Dati reali**: le cartelle `_octo/` dei due progetti (impostazioni, letture, ore, cruscotto, riunioni, punti aperti), in sola lettura.
- **Ricalcolo**: `compileForecast` e `reconcileHours` del dominio eseguiti sui file reali.
- **Confronto**: l'Excel di marginalità del progetto contro le estrazioni NetSuite e i worklog Jira tenuti da Octo.
- **Interfaccia**: una seconda copia dell'app, avviata dalla build del repo su copie delle due cartelle, senza credenziali. L'istanza in uso non è stata toccata. Screenshot e testo di ogni sezione per entrambi i progetti.
- **Limiti**: senza credenziali la copia non legge le fonti dal vivo, quindi gli avvisi «manca la credenziale» visti in «Oggi» sono un effetto della prova. «Chiedi» e i deliverable non sono stati esercitati con Claude vero. I numeri del cruscotto DEEM non sono stati ricontati su Azure DevOps.

## Errori di correttezza

### 1. Previsionale a corpo: dipende in silenzio dai mesi letti in «Ore»

Gravità: alta. Progetto: Petrolvalves, e ogni futuro progetto a corpo.

Il previsionale legge i timesheet dai file che «Ore» ha scaricato, e «Ore» propone il mese scorso. Petrolvalves ha su disco un solo mese; NetSuite ha anche il mese precedente (alcune decine di ore).

- Mese precedente: Octo scrive «nessuna attività nel mese». Non è vero.
- Mese letto: l'avanzamento è costi fino al mese diviso costi a budget, ma i costi del mese precedente valgono zero. Con i costi a budget inseriti, avanzamento e ricavi uscirebbero più bassi del vero, senza alcun avviso.

Dove: `packages/domain/src/forecast/compile.ts:235` (`costsBefore`), `packages/application/src/forecast.ts:95`, `packages/application/src/hours.ts:333`.

### 2. Riepilogo del cruscotto: «Bug aperti» conta anche i validati

Gravità: alta. Progetto: DEEM.

| Fonte | Bug aperti |
|---|---|
| Scheda «Bug» del cruscotto | meno di venti (in lavorazione più in verifica) |
| `_octo/cruscotto/riepilogo.md` | alcune decine (gli stessi più i validati, circa il triplo) |

Il cruscotto dice in chiaro che i validati non sono più aperti. Il riepilogo è il testo che Claude cita nei report e in «Chiedi»: un report di stato può uscire con il conteggio più alto. Lo stesso conto è nella tabella per tag.

Dove: `packages/domain/src/tracker/summary.ts:98` e `:56`. La regola giusta esiste già: `isOpenPhase` in `packages/domain/src/tracker/model.ts`.

### 3. Riunioni di DEEM finite in Petrolvalves

Gravità: alta. Progetti: entrambi.

Due riunioni quotidiane del 17/11 (una con il cliente, una interna), con i partecipanti del team DEEM, stanno nella cartella delle riunioni di Petrolvalves. Conseguenze:

- «Il punto» di Petrolvalves mostra un paio di decine di punti aperti, tutti presi da quelle due riunioni e tutti su temi tecnici di DEEM.
- DEEM non ha le riunioni quotidiane di oggi.

Nessun invito e nessuna parola chiave le lega a Petrolvalves: l'assegnazione è stata fatta a mano. Il pulsante «Assegna a questo progetto» compare uguale in ogni progetto, non confronta i partecipanti con le persone del progetto e non offre una via di ritorno visibile. Il riconoscimento automatico non ha saputo dare le daily a DEEM.

Dove: `packages/domain/src/meetings/assign.ts`, `packages/application/src/meetings.ts:289`.

### 4. Segnale «Criteri di accettazione assenti» su Jira

Gravità: media. Progetto: Petrolvalves.

Jira non ha un campo per i criteri di accettazione, quindi Octo lo lascia vuoto e il segnale scatta su ogni storia. A video: la voce di gestione del progetto compare fra i «Requisiti poco chiari» con due segnali. La demo 43 dichiara che su Jira questi segnali non scattano.

Dove: `packages/domain/src/tracker/requirements.ts:63`, `packages/connectors/src/jira/tracker.ts` (`acceptance_criteria: ''`).

## Previsionale

### Petrolvalves contro l'Excel

| Voce | Excel | Octo |
|---|---|---|
| Ore | alcune decine | circa un terzo (un solo mese) |
| Costo | alcune migliaia di euro | circa un terzo |
| Prezzo di vendita | meno di diecimila euro | uguale (letto da NetSuite, giusto) |
| Margine | oltre la metà | vuoto |

L'Excel è corretto. Le sue ore si ricostruiscono così:

- la gran parte dai due mesi chiusi, da NetSuite;
- poche ore del mese in corso di una persona, dal worklog Jira: non sono ancora in NetSuite;
- poche ore di una persona che non ha timesheet sulla commessa.

Il costo ricostruito dai dati di Octo coincide con l'Excel a meno di centesimi. Tutti gli ingredienti erano già nella cartella del progetto: mancava chi li mettesse insieme.

A video la pagina mostra una riga con i soli costi interni del mese letto, ricavi a zero, margini «—», e sotto due righe di «Dati che mancano» che chiedono i costi a budget e i costi totali previsti.

### Che cosa manca per un progetto a corpo

- **Una vista a vita intera.** Il previsionale è mensile, perché nasce dal modello dell'amministrazione. La domanda di un progetto a corpo è cumulativa: speso finora, quanto resta, margine a finire. Oggi il «Margine finale» chiede al PM di scrivere i costi totali previsti, cioè proprio il numero calcolato a mano.
- **Le ore del mese in corso.** NetSuite le riceve a mese chiuso. Il worklog Jira c'è e il costo orario di ogni persona è noto dalle righe passate: basterebbe a una stima dichiarata come tale.
- **Le persone senza timesheet.** L'unica via è «Esterni senza timesheet», che chiede costo al giorno e tariffa al giorno per commessa: pensata per chi vende giornate.
- **I costi a budget.** Le persone del progetto hanno già un tetto in giornate nel ruolo (pochi giorni ciascuna). Octo non lo usa per proporre il budget. A titolo indicativo, con quei tetti l'avanzamento sarebbe vicino a quello dei ricavi che NetSuite riconosce (circa due terzi). I due numeri si parlano.
- **Fatturato e ricavi riconosciuti.** Octo li ha già letti da NetSuite (un acconto fatturato, circa un terzo; riconosciuti circa due terzi) ma la pagina non li mostra.

### Leggibilità della pagina

- La riga porta solo il codice della commessa: il nome compare al passaggio del puntatore.
- La colonna «Giorni o %» cambia significato da una riga all'altra.
- Manca l'ordinato accanto ai margini, e manca una riga di totale del progetto.
- Le lacune stanno in fondo alla pagina: una riga con ricavi incompleti mostra comunque un margine, senza un segno sulla riga stessa.

### DEEM

- Commessa del periodo nuovo: alcune centinaia di ore e ricavi a zero. Le tariffe sono per commessa e la nuova non ne ha: una lacuna per persona, meno di dieci. A ogni periodo vanno riscritte tutte.
- Commessa del periodo precedente: una persona senza tariffa, un centinaio di ore fuori dai ricavi. Il margine del mese è calcolato su ricavi incompleti.
- Dati orfani: tariffe, un esterno con oltre cento ore e i dati di un mese su un codice che non è più fra le commesse lette. Sono ignorati senza avviso.
- Il margine finale è sempre vuoto: i costi totali non sono mai stati inseriti.

## Cruscotto

### Petrolvalves, da Jira

Il cruscotto è costruito per bug, sprint e periodi di pianificazione di un tracker del cliente. Qui Jira è il registro interno delle attività: una manciata di voci, nessun bug, nessuno sprint.

- **Sprint**: «Le voci del perimetro non portano uno sprint», poi la tabella dei requisiti poco chiari con il falso segnale del punto 4.
- **Bug**: tutti i riquadri a zero e la frase che dice zero aperti e zero fermi.
- **Andamento**: un grafico vuoto e le mediane «—».
- **Quasi metà delle voci non compare.** Octo legge i tipi `Bug`, `User Story` e `Story`; le `Task` restano fuori. La voce esclusa più importante è l'unica «In corso», con una decina di commenti che fanno da diario del progetto e tutte le ore registrate.
- **Etichette che non tornano**: «Tracker del cliente» (è il Jira interno), «Gravità» (è la priorità di Jira), «Periodo» (sempre vuoto).
- **Stati doppi**: la cronologia porta i nomi inglesi del changelog («To Do», «Done»), lo stato corrente quelli italiani («Da completare», «Completata»). La fase è calcolata bene, ma l'elenco degli stati raddoppia.

Ciò che su un progetto così servirebbe non c'è: le ore per attività e per persona contro i tetti, e il diario dei commenti.

### DEEM, da Azure DevOps

La pagina funziona e si legge. Annotazioni minori:

- Storie nello stato di dimostrazione al cliente: «in verifica» per il cruscotto, «chiuso» per l'allineamento. Le due sezioni possono dare conti diversi dello stesso sprint.
- Le mediane dell'andamento usano il punto decimale invece della virgola. `apps/desktop/src/renderer/messages.ts:1316`.
- Le voci di progettazione dei test contano come storie dello sprint.

## Ore

- **DEEM, mese chiuso**: quadra. Circa millecinquecento ore di timesheet contro altrettante sul tracker, scostamento intorno all'uno per cento.
- **Petrolvalves, mese chiuso**: una persona risulta «Nessuna ora sul tracker»: è il PM, che non registra su Jira. Basta dichiararlo atteso.
- **Petrolvalves, mese in corso**: finché non c'è il timesheet la persona compare con il nome utente di Jira e non con nome e cognome.
- Il periodo predefinito è il mese scorso. Per le ore va bene; è la causa a monte dell'errore 1.

## Oggi, riunioni, punti aperti

- Petrolvalves: «Il punto» è inutilizzabile finché le due riunioni non tornano a DEEM (errore 3).
- La riga di stato in alto chiama Jira «Tracker del cliente» anche su Petrolvalves.
- DEEM: una decina di punti in coda, coerenti con le riunioni del giorno prima.

## Avanzamento e Allineamento

Le sezioni sono le stesse per ogni progetto.

- **Avanzamento** su Petrolvalves chiede il modulo Excel del cliente, la mappa delle celle e le posizioni dell'ordine: è la richiesta di SAL di DEEM. Un progetto a corpo con un acconto e un saldo non ha niente di tutto questo; l'acconto già fatturato non ha un posto dove comparire.
- **Allineamento** su Petrolvalves chiede sprint e due tracker da confrontare: non c'è niente da allineare.
- Su DEEM entrambe funzionano: poche richieste per poco meno di metà di un ordine di alcune centinaia di migliaia di euro, uguali al fatturato su NetSuite. L'allineamento è fermo sullo sprint precedente a quello in corso: lo sprint va cambiato a mano a ogni giro.

## Piano interventi

Ordinati per priorità. Taglia: P piccola (ore), M media (una giornata), G grande (più giornate).

| # | Intervento | Priorità | Taglia | Dove |
|---|---|---|---|---|
| 1 | Riepilogo del cruscotto: «aperti» sono lavorazione più verifica | Alta | P | `domain/tracker/summary.ts` |
| 2 | Previsionale: leggere da solo tutti i mesi di timesheet dall'inizio della commessa; in mancanza, avvisare dei mesi non letti | Alta | M | `application/forecast.ts`, `application/hours.ts` |
| 3 | Riunioni: spostare o annullare un'assegnazione, con i punti aperti che ne derivano; avviso quando i partecipanti sono di un altro progetto | Alta | M | `application/meetings.ts`, `domain/meetings/assign.ts`, `TodayView.tsx` |
| 4 | Vista «Commessa» a vita intera: persona, ore, costo come nell'Excel; margine a oggi e a finire; fatturato e riconosciuto da NetSuite; copia per mail | Alta | G | `domain/forecast/`, `ForecastView.tsx` |
| 5 | Cruscotto per un Jira usato come registro attività: tipi proposti dai dati letti, scheda «Attività» con ore e ultimo commento, schede vuote nascoste, etichette corrette, niente segnale sui criteri di accettazione | Alta | G | `domain/tracker/`, `connectors/jira/tracker.ts`, `Dashboard*.tsx`, `messages.ts` |
| 6 | Ore non ancora in NetSuite stimate dal worklog per il costo orario; persone senza timesheet a costo orario | Media | M | `domain/forecast/compile.ts`, `model.ts` |
| 7 | Costi a budget proposti dai tetti delle persone | Media | M | `domain/team/model.ts`, `ForecastMonth.tsx` |
| 8 | Tariffe a giornate: proporre a una commessa nuova quelle della precedente; avviso per i dati su codici non più del progetto | Media | M | `domain/forecast/compile.ts`, `ForecastView.tsx` |
| 9 | Pagina del previsionale: nome della commessa in riga, ordinato, totale, lacuna segnata sulla riga | Media | P | `ForecastMonth.tsx` |
| 10 | Navigazione per tipo di progetto: «Allineamento» solo con due tracker; «Avanzamento» a corpo dalle fatture di NetSuite | Bassa | M | `sections.ts`, `App.tsx`, `ProgressView.tsx` |
| 11 | Minori: virgola decimale nelle mediane, nome e cognome al posto del nome utente Jira, stato di dimostrazione coerente fra cruscotto e allineamento | Bassa | P | `messages.ts`, `domain/hours/`, `domain/tracker/model.ts` |

Da fare a mano subito, senza aspettare il codice:

- riportare a DEEM le due riunioni del 17/11 e togliere da Petrolvalves i punti aperti che ne vengono;
- in «Ore» di Petrolvalves leggere i timesheet dal primo mese della commessa;
- in «Previsionale» di DEEM scrivere le tariffe della commessa del periodo nuovo e quella mancante sulla precedente.

## Comandi

- Test e copertura: `pnpm test:coverage`. Non lanciati: nessuna modifica al codice.
