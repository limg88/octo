# «Oggi»: il riepilogo giornaliero del PM

Data: 15/11/2026. Documento di progetto: nessun file dell'app è stato modificato. L'implementazione parte, un incremento per volta, quando il PM la chiede.

**Stato.** Scritto il 15/11/2026, tutti e sette gli incrementi: demo `demo/23-oggi`. Che cosa è stato fatto in modo diverso da qui, e che cosa non è stato fatto, è in `roadmap.md` alla voce «Oggi».

**Come è stato fatto.** Dalla lettura del codice, delle demo e di `roadmap.md`, `valutazione-interfaccia.md` e `glossario.md`. L'app non è stata avviata e il progetto reale non è stato aperto: gli esempi vengono dal progetto finto «Aurora». Ciò che non è verificato è elencato al §12.

## Contesto

Octo tiene per ogni progetto una memoria letta da posta, documenti, Azure DevOps, Jira, Confluence e NetSuite, ma i segnali che ne ricava stanno sparsi in otto sezioni: il PM deve sapere dove guardare. Serve una pagina che apre ogni mattina e che gli dice che cosa fare, da dove viene ogni cosa e dove si risolve.

**Decisioni del PM (15/11/2026).**
- La valutazione di Claude lavora **come Chiedi oggi**: legge la cartella del progetto, con i nomi delle persone visibili.
- La valutazione si aggiorna **alla prima apertura del giorno**, e a richiesta.
- Oltre al riepilogo del progetto c'è **una pagina «Tutti i progetti»**.
- I rischi sono un **registro** del progetto, non un elenco rifatto ogni mattina.
- Octo deve sapere chi lo usa: **login con Entra ID**, progettato a parte in `identita-e-login.md`. Gli indirizzi del PM che servono alle mail (§4) vengono dal login, non da un campo scritto a mano.

## 1. Che cosa ho verificato nel codice

| Tema | Che cosa c'è davvero | Dove |
|---|---|---|
| Ore | quadratura (`tieOut.ok`), righe per persona con stato `outlier`, `no_worklog`, `no_timesheet`, `expected`; possibili doppioni; ore escluse (non approvate, altri codici) | `packages/domain/src/hours/reconcile.ts` |
| Previsionale | dati mancanti tipizzati: `no_cost`, `no_rate`, `no_external_rate`, `no_total_costs`, `no_ordered` | `packages/domain/src/forecast/compile.ts:36` |
| Cruscotto | bug aperti con giorni nello stato, conteggio dei fermi (soglia `stuckDays`, predefinita 30), età dell'esportazione (avviso oltre 24 ore, vecchia oltre 72), requisiti con segnali S1–S5, decisioni del PM con data | `domain/src/tracker/{bugs,requirements,export,model}.ts` |
| Allineamento | voci senza ticket, ticket altrove, doppi, ticket orfani, stati incoerenti; richiede lo sprint impostato | `domain/src/alignment/align.ts:32` |
| Fonti | per fonte: ultima lettura, errore, punto raggiunto; se manca la credenziale (`hasSecret`) | `domain/src/sources.ts`, `application/src/feeds.ts:42` |
| Deliverable | stati `writing`, `review`, `approved`, `failed`; verdetto della rilettura critica | `domain/src/deliverables/deliverable.ts:78` |
| Persone e calendario | persone con dal/al e allocazione, periodi con date | `domain/src/team/model.ts` |
| Lettura periodica | ogni 15 minuti ad app aperta, per tutti i progetti; evento `sourcesChanged` verso l'interfaccia | `apps/desktop/src/main/main.ts:87,134` |
| Claude | un'esecuzione con forma d'uscita fissa, sola lettura, annullabile; citazioni controllate dal codice | `infrastructure/src/claude/structured-run.ts`, `domain/src/answer.ts` |

**Tre cose diverse da come le ricordavi.**

1. **I nomi non sono nascosti al modello.** Le mail in memoria hanno `da`, `a`, `cc` in chiaro (`domain/src/mail/document.ts:68`); `persone-e-calendario.md` scrive i nomi ed è fatto per essere citato; gli elementi di Jira e Confluence elencano le persone nell'intestazione del file che Claude legge. Nessun punto del codice li sostituisce prima di un'esecuzione. Il commento «hidden from every model» (`domain/src/feed.ts:48`) viene da octobrief-new; la roadmap dice «pseudonimizzazione tolta». La riga della roadmap su Confluence («i loro nomi sono nascosti al modello») descrive un elenco, non un mascheramento: va corretta.
2. **Di una mail Octo non sa se è stata risposta.** Vedi §4.
3. **La posta non si legge su Windows** (`main.ts:120`): il pilota è su Windows, quindi lì il blocco delle mail non esiste finché non c'è quel lettore.

## 2. Calcolato e giudicato: la separazione

- **Calcolato** (codice, nessun Claude): certo, immediato, rifatto a ogni apertura e a ogni lettura delle fonti. Ogni voce porta la data del dato da cui nasce.
- **Giudicato** (Claude): sta in un riquadro a parte, con l'etichetta «Valutazione di Claude», la data, il modello che ha lavorato e le fonti citate. Il codice controlla ogni citazione come in Chiedi: una fonte non trovata resta marcata, non tolta.
- Regola di disegno: **Claude non decide mai se una voce esiste, quando la voce si può calcolare.** Che una mail sia senza risposta da tre giorni lo dice il codice; che sia importante lo dice Claude. Se Claude non c'è (quota finita, non installato), la pagina funziona lo stesso e le mail restano «senza valutazione».

## 3. Le voci

| Voce | Nasce da | Tipo | Che cosa vede il PM | Che cosa può fare | Sparisce quando |
|---|---|---|---|---|---|
| Fonte ferma o guasta | stato delle letture | calcolata | «Jira non si legge da 3 giorni: tutto ciò che segue su Jira è di venerdì» (in cima, come avviso) | Leggi ora; apri Impostazioni | la lettura riesce |
| Mail a cui rispondere | mail verso il PM senza una sua risposta (§4) | calcolata; l'importanza è giudicata | mittente, oggetto, da quanti giorni aspetta; sotto, la valutazione con la frase citata | apri la mail; scrivi la risposta (deliverable «email al cliente» già con il contesto); fatto; non serve risposta | parte una risposta del PM, o il PM la chiude |
| In attesa di altri | mail del PM senza risposta da N giorni | calcolata | «Aspetti da 6 giorni una risposta su…» | sollecita (email); fatto | arriva la risposta |
| Ore che non quadrano | riconciliazione del mese | calcolata | «Ottobre: Bianchi Anna 160 ore di timesheet, 80 sul tracker»; quadratura fallita; possibili doppioni | apri Ore su quel mese; segna «atteso» | la differenza rientra sotto soglia o la persona è marcata attesa |
| Dati che mancano al previsionale | `ForecastGap` del mese | calcolata | «Manca la tariffa di Costa Elena su PRJ000101» | apri Previsionale su quel dato | il dato è scritto |
| Scadenze del mese | calendario e file già prodotti | calcolata | «Previsionale di ottobre non ancora compilato»; «ore di ottobre mai confrontate» (solo a ridosso di fine mese) | apri la sezione | il file del mese esiste |
| Bug fermi | cruscotto | calcolata, **raggruppata** | «6 bug fermi da più di 30 giorni (2 gravi)» | apri Cruscotto | nessun bug oltre soglia |
| Requisiti poco chiari del periodo | segnali S1–S5 | calcolata, raggruppata | «2 storie del periodo senza criteri di accettazione» | apri Cruscotto | segnali risolti o tolti dal PM |
| Voci senza ticket, doppi, orfani | allineamento dello sprint | calcolata | «Sprint 28: 1 voce senza ticket, 1 con due ticket, 1 ticket orfano» | apri Allineamento; scrivi il file di import | le liste sono vuote |
| Bozze in attesa | deliverable in `review` o `failed` | calcolata | «Stato di avanzamento in bozza da 2 giorni; la rilettura critica dice: da correggere prima» | apri il deliverable | approvato |
| Calendario | periodi e persone | calcolata | «Sprint 28 finisce fra 2 giorni con 3 voci aperte»; «Neri Sara lascia il progetto venerdì» | apri la sezione collegata | passata la data |
| Rischi | registro del progetto (§6) | accettati dal PM; i candidati sono giudicati | rischi aperti; «2 candidati nuovi» | apri il registro; accetta o scarta | rischio chiuso |

**Proposte in più** (dai dati che Octo ha già): «In attesa di altri», «Scadenze del mese», la riga «Dall'ultima volta» (quante mail, voci e pagine nuove per fonte: conteggi, nessuna voce).

**Che cosa non regge o va ridotto.**
- *Rischi rigenerati ogni mattina*: deciso, diventano un registro.
- *Bug fermi uno per uno*: sei voci uguali sono rumore. Una voce per tipo, con il conteggio, che porta al Cruscotto.
- *«Lista di attività» scritta a mano*: non la propongo. Il PM non aggiunge voci proprie in «Oggi»: sarebbe un secondo gestore di attività. Le voci nascono solo dai dati.

## 4. Le mail

**Che cosa Octo sa oggi di una mail** (`domain/src/mail/message.ts`, `document.ts`): mittente, destinatari e copia (nome e indirizzo), data, cartella di posta, oggetto, testo senza i messaggi citati, nomi degli allegati, identificativo del messaggio, se è un invito. La posta inviata entra come quella ricevuta, se rispetta le regole.

**Che cosa non sa:**
1. *Chi è il PM.* Nessuna impostazione ha il suo indirizzo: Octo non distingue «scritta a me» da «scritta da me».
2. *A quale mail risponde una mail.* Le intestazioni «In-Reply-To» e «References» non sono conservate. Il lettore le fornisce già (verificato nella libreria `postal-mime` 4.2.0), ma `emlx.ts` non le prende.
3. *Se è letta o segnata come risposta in Mail.* L'indice di Mail viene letto solo per data e cartella. Che l'indice abbia un segno affidabile di «risposta» **non l'ho verificato** e cambia con la versione di macOS: non lo userei.
4. *Le risposte che non nominano il progetto.* Una risposta del PM entra in memoria solo se rispetta le parole chiave (di solito sì, per l'oggetto «R: …»).

**Che cosa serve e quanto costa** (stime mie):
- gli indirizzi del PM nelle impostazioni della posta, proposti da Octo (il mittente più frequente della posta inviata): piccolo;
- «risponde a» e «riferimenti» nell'intestazione del file della mail: piccolo (tre file: `message.ts`, `emlx.ts`, `document.ts`); le mail già scritte si rileggono dal giorno di inizio, e i file vengono riscritti;
- regola nuova: una mail che risponde a una mail del progetto entra anche senza parola chiave: medio (serve l'elenco degli identificativi già presi);
- il calcolo «aspetta me / aspetto io» sui file della posta: medio, tutto nel dominio.

**Resta fuori dalla portata del codice:** una risposta data a voce, in riunione o su Teams. Per questo la voce ha «Non serve risposta».

**Candidata a «devi rispondere»** (calcolato): scritta da un'altra persona, il PM è fra i destinatari diretti, non è un invito né un mittente escluso, nessuna mail successiva del PM la cita, ha meno di 14 giorni. **Importanza** (giudicato): alta, media, bassa, con il motivo in una riga e la frase della mail citata; se la mail nomina una data («entro venerdì»), Claude la riporta e il codice la usa per l'ordine.

## 5. Quando si aggiorna, quanto costa, a quando risale

- **Calcolato:** a ogni apertura della pagina e dopo ogni lettura periodica. Sotto il titolo, una riga per fonte: «Posta: letta oggi 8:45 · Jira: oggi 8:45 · Tracker del cliente: esportazione del 12/11 (3 giorni) · Timesheet: ottobre».
- **Giudicato:** una volta al giorno, alla prima apertura di «Oggi» di quel progetto, **e solo se l'insieme delle mail candidate è cambiato** dall'ultima valutazione. Mai per un progetto non aperto. Nel frattempo si vede la valutazione precedente con la sua data («Valutazione di ieri 9:02 · sto aggiornando…»). «Aggiorna» sempre disponibile; «Ferma» come in Chiedi.
- **Costo:** un'esecuzione di Claude per progetto aperto al giorno, al massimo. Durata: **non misurata**; per riferimento una bozza di deliverable vera ha preso 96 secondi (roadmap). Va misurata con Claude vero nell'incremento 4.
- **Dove sta la valutazione:** `_octo/.oggi/valutazione.json` nel progetto (cartella nascosta: non è una fonte), con data, modello ed elenco delle mail valutate.

## 6. Lo stato delle voci

- **Chiave stabile** per voce (tipo + oggetto: `ore:2026-10:bianchi anna`, `mail:<id>`, `bug-fermi`) e **impronta** dei fatti (fascia della differenza, numero di bug, giorni).
- **Tre gesti:** *Fatto* · *Rimanda* (domani, lunedì, una data) · *Non mi interessa*.
- **Che cosa succede dopo:**
  - una voce calcolata sparisce da sola quando il dato si sistema: «Fatto» serve per «me ne sono occupato, il dato si aggiornerà»;
  - dopo «Fatto», se il problema c'è ancora dopo 3 giorni lavorativi torna, marcata «ancora aperta dal …»;
  - se l'impronta peggiora (da 6 a 9 bug fermi, differenza che raddoppia) torna subito, con «era… ora…»;
  - «Rimanda» la riporta quel giorno, in cima;
  - «Non mi interessa» la tace per sempre per quella chiave; alla terza volta sullo stesso tipo Octo propone «Non mostrarmi più questo tipo», che si riattiva dalle impostazioni della pagina.
- **Dove si conserva:** `_octo/.impostazioni/oggi.json` nel progetto, come le decisioni del cruscotto: viaggia con la cartella, non è una fonte, ogni decisione ha la data. Su una cartella condivisa via git resta personale (`_octo/` è esclusa).
- **Contro il rumore:** al massimo 7 voci nella lista principale, il resto dietro «Altre N»; raggruppamento per tipo; soglie per ogni tipo; pagina vuota detta in chiaro («Oggi Octo non ha nulla da segnalarti»). Il registro delle decisioni dà la misura: quante voci per tipo sono state fatte e quante scartate.

**Registro dei rischi.** Claude propone candidati con le fonti (a richiesta, o con la valutazione del lunedì); il PM accetta, riscrive o scarta. Gli accettati stanno in `_octo/progetto/rischi.md` (titolo, da quando, fonte, stato, nota del PM): un file che Chiedi e i deliverable leggono e citano, come `persone-e-calendario.md`. Uno scartato non viene riproposto se la fonte è la stessa.

## 7. L'ordine

Nessuna classifica fatta dal modello: fasce con regole che si possono spiegare, e ogni voce dice in una frase perché è lì.

0. **Avviso in cima:** fonti ferme o guaste. Tolgono valore a tutto ciò che segue.
1. **Scade oggi:** date del calendario, voci rimandate a oggi, mail con una scadenza entro domani.
2. **Qualcuno aspetta te:** mail senza risposta (prima per importanza, poi per giorni), bozze da approvare.
3. **Numeri che non quadrano:** ore, previsionale, allineamento. Salgono in fascia 1 negli ultimi 3 e nei primi 5 giorni lavorativi del mese (ore, previsionale) e negli ultimi 2 dello sprint (allineamento).
4. **Da tenere d'occhio** (riquadro separato, nessuna azione oggi): bug fermi, requisiti, rischi aperti, in attesa di altri.

## 8. Dove sta e come si chiama

- Nome: **«Oggi»**. Prima voce della colonna di sinistra, da sola sopra il gruppo «Lavoro». Octo si apre lì; un progetto appena aggiunto si apre ancora su «Impostazioni».
- **«Tutti i progetti»**: in cima al selettore dei progetti. Per ogni progetto il numero di voci per fascia e le prime tre, solo dalla parte calcolata più l'ultima valutazione già salvata, con la sua data. Non chiama mai Claude. Un clic porta a «Oggi» di quel progetto.
- Parole da aggiungere al glossario con il primo incremento: **«segnalazione»** (una cosa che Octo mostra in «Oggi»; non «voce», che è già l'elemento del tracker del cliente: in questo documento «voce del riepilogo» va letto così), **«valutazione»** (ciò che dice Claude, con le fonti), **«registro dei rischi»**.

## 9. Bozza della pagina (progetto «Aurora» delle demo)

Valori da `demo/lib/hours-data.ts`, `fake-tracker.ts`, `fake-alignment.ts`, `fake-forecast.ts`, `fake-mail.ts`; i conteggi dei bug e le ore di `fake-hours.ts` non li ho ricalcolati riga per riga.

```
 Oggi · Aurora                                   lunedì 16 novembre
 Posta: oggi 8:45 · Jira: oggi 8:45 · Tracker del cliente: esportazione
 di 5 giorni fa · Timesheet: ottobre                       [Leggi ora]

 ! Il tracker del cliente è di 5 giorni fa: bug e requisiti qui sotto
   sono a quella data.                          [Leggi da Azure DevOps]

 DA FARE OGGI                                                   4 di 6
 ┌──────────────────────────────────────────────────────────────────┐
 │ Rispondi a Carla Bianchi · «Aurora: budget aggiuntivo approvato» │
 │ Posta · aspetta da 1 ora                                         │
 │ Valutazione di Claude (oggi 9:02): alta. Comunica un budget in   │
 │ più: «ha approvato un budget aggiuntivo di 8.000 euro» [fonte ✓] │
 │ [Apri la mail] [Scrivi la risposta]   Fatto · Rimanda · Non serve│
 ├──────────────────────────────────────────────────────────────────┤
 │ Stato di avanzamento in bozza da 2 giorni                        │
 │ Deliverable · la rilettura critica dice «da correggere prima»    │
 │ [Apri la bozza]                               Fatto · Rimanda · ×│
 ├──────────────────────────────────────────────────────────────────┤
 │ Ottobre: le ore di 3 persone non tornano                         │
 │ Ore · Bianchi Anna 160 di timesheet, 80 sul tracker · Neri Sara  │
 │ senza ore sul tracker · Ugo Gialli senza timesheet               │
 │ Perché oggi: il previsionale di ottobre non è ancora compilato   │
 │ [Apri Ore su ottobre]                         Fatto · Rimanda · ×│
 ├──────────────────────────────────────────────────────────────────┤
 │ Previsionale di ottobre: manca la tariffa di Costa Elena         │
 │ Previsionale · PRJ000101: le sue ore contano solo a costo        │
 │ [Scrivi la tariffa]                           Fatto · Rimanda · ×│
 └──────────────────────────────────────────────────────────────────┘
   Altre 2: Sprint 28 (1 voce senza ticket, 1 con due ticket, 1 ticket
   orfano) · Mail di Monitor «disco pieno» (senza valutazione)

 DA TENERE D'OCCHIO
   Bug fermi da più di 30 giorni: N (di cui M gravi)       → Cruscotto
   2 storie del periodo R2 poco chiare (2002, 2004)        → Cruscotto
   Collaudo giovedì 17 dicembre · consegna ordini 12 dicembre
   Rischi aperti: 1 · 2 candidati nuovi                    → Registro

 Dall'ultima volta (venerdì 18:10): 1 mail · 0 ticket · 0 pagine
```

## 10. Architettura: che cosa si riusa, che cosa si estende

**Si riusa così com'è**
- i calcoli del dominio: `reconcileHours`, la compilazione del previsionale con i suoi `ForecastGap`, `bugDashboard`, `unclearRequirements`, `exportAge`, `alignTrackers`, `peopleAway`, `periodsOn`;
- i casi d'uso che li espongono: `hours.view`, `forecasts.view`, `dashboard.view`, `alignments.view`, `deliverables.list`, `sources.mail`, `feeds.view`, `team.get`, `feeding.fill`;
- `runStructured` (sola lettura, forma d'uscita fissa, annullamento, modello scelto), `checkAnswer` ed `EvidenceReader` per le citazioni, `createSourceMap` per dire a Claude quanto sono fresche le fonti;
- nell'interfaccia: il componente degli errori, l'attesa con il segno che gira, «Salvato.», l'evento `sourcesChanged`, `onOpenSection`.

**Si estende**
- *Dominio* — nuova cartella `packages/domain/src/today/`: modello della segnalazione (chiave, tipo, fascia, origine calcolata o giudicata, fatti tipizzati, sezione di destinazione, data del dato); una funzione pura per tipo che traduce un risultato esistente in segnalazioni; ordine e tetto; decisioni e ritorno. In `mail/`: i due campi nuovi del messaggio, la lettura dell'intestazione di una mail già scritta, il calcolo dei fili («aspetta me», «aspetto io»). In `team/` o accanto: il registro dei rischi e il suo testo.
- *Applicazione* — `today.ts`: compone i casi d'uso esistenti; un «non impostato» di una sezione è un'assenza, non un errore. Porte nuove in `ports.ts`: `TodayStore` (decisioni e valutazione salvata), `TodayJudge` (la valutazione), `RiskRegisterStore`. `sources.ts`: regola delle risposte a mail del progetto. Per «Tutti i progetti»: lo stesso caso d'uso su ogni progetto, senza giudizio.
- *Infrastruttura* — `claude/today-judge.ts` (prompt e schema, su `runStructured`); `fs/` gli archivi JSON nuovi; `mail/emlx.ts` i due campi.
- *Interfaccia* — `TodayView.tsx`, `AllProjectsView.tsx`, `RiskRegister.tsx`; `sections.ts`, `SectionNav.tsx`, `App.tsx` (sezione nuova, apertura, destinazione con il mese o lo sprint già scelto: oggi `onOpenSection` porta solo alla sezione, le viste devono accettare un punto di arrivo), `ProjectSwitcher.tsx`, `messages.ts`, `styles.css`.
- *Ponte* — `shared/api.ts`, `preload.ts`, `main/ipc.ts`, `main/main.ts` (unico punto di composizione).

**Vincolo da tenere presente:** la roadmap chiede «codice nuovo sotto le 15.000 righe»; oggi i sorgenti senza test sono circa 29.900 righe (connettori portati compresi; non so quante contino come «nuove»). Stimo per tutto il riepilogo 1.800–2.500 righe più i test: **stima mia, non verificata**.

## 11. Piano a incrementi

Sforzo: piccolo = fino a un giorno; medio = due-quattro giorni; grande = una settimana o più (stesse misure di `valutazione-interfaccia.md`). Ogni incremento ha test, demo in `demo/NN-<slug>/` e riga in `demo/README.md`.

| # | Incremento | Effetto per il PM | File toccati | Sforzo | Rischi | Demo |
|---|---|---|---|---|---|---|
| 1 | **«Oggi» calcolato** | Apre Octo e vede in una pagina fonti ferme, ore, previsionale, bug, requisiti, allineamento, bozze, calendario, ordinati e con la data dei dati; ogni voce porta alla sezione | `domain/src/today/*`, `application/src/today.ts`, `ports.ts`, `shared/api.ts`, `preload.ts`, `ipc.ts`, `main.ts`, `TodayView.tsx`, `sections.ts`, `App.tsx`, `messages.ts`, `styles.css` | medio–grande | lentezza se ogni apertura rilegge tutti i file delle ore (da misurare); cambia la pagina di apertura: test, e2e e copioni che partono da Chiedi | `demo/23-oggi`: Aurora con esportazione vecchia; si sistema la tariffa di Costa Elena e la voce sparisce |
| 2 | **Stato delle voci** | Fatto, Rimanda, Non mi interessa; ciò che torna dice perché; tetto di 7 e gruppi | `today/decisions.ts`, `TodayStore` e suo archivio, `TodayView.tsx` | medio | regole di ritorno troppo insistenti o troppo mute: soglie da tarare sull'uso vero | `demo/24-stato-delle-voci`: si rimanda una voce, si peggiora un dato, la voce torna con «era… ora…» |
| 3 | **Mail a cui rispondere e in attesa di altri (calcolato)** | Vede chi aspetta lui e chi sta aspettando, da quanti giorni | `mail/{message,document,match}.ts`, `mail/thread.ts` nuovo, `emlx.ts`, `sources.ts`, impostazioni della posta (`SourcesView.tsx`), `today.ts` | medio | le mail già in memoria vanno rilette e i file riscritti; solo Mac; risposte fuori dalla posta non viste | `demo/25-mail-da-rispondere`: delle due mail di Carla Bianchi una ha la risposta e non compare, l'altra sì |
| 4 | **Valutazione di Claude sulle mail** | Accanto a ogni mail, importanza, motivo e frase citata; data e modello della valutazione; funziona anche senza Claude | `claude/today-judge.ts`, `TodayJudge`, `today.ts`, `TodayView.tsx`, `fake-claude.mjs` | medio | quota e tempo d'attesa (da misurare con Claude vero); giudizi diversi da un giorno all'altro sulla stessa mail: una mail già valutata non si rivaluta | `demo/26-valutazione`: con Claude finto, poi `REAL=1` |
| 5 | **Registro dei rischi** | Candidati con le fonti, accetta o scarta; i rischi aperti in «Oggi»; Chiedi e i deliverable li citano | dominio e archivio del registro, `today-judge.ts`, `RiskRegister.tsx`, `today.ts` | medio | candidati ripetuti con parole diverse; un registro che nessuno aggiorna | `demo/27-rischi`: un candidato accettato compare nello stato di avanzamento |
| 6 | **«Tutti i progetti»** | Una pagina con le prime voci di ogni progetto, senza chiamare Claude | `today.ts`, `AllProjectsView.tsx`, `ProjectSwitcher.tsx`, `App.tsx` | medio | tempo di calcolo con molti progetti; una seconda lista da leggere | `demo/28-tutti-i-progetti`: Aurora e Boreale |
| 7 | **Riunioni di oggi dagli inviti nella posta** | «Oggi alle 15 collaudo con il cliente», con ciò che la memoria dice sull'argomento | `emlx.ts` (lettura dell'invito), dominio delle riunioni, `today.ts` | medio | riunioni ricorrenti, spostate e annullate; solo gli inviti che rispettano le regole della posta; **non verificato** che l'invito sia sempre leggibile dal file della mail | `demo/29-riunioni` |

**Dipendenze:** 2 dopo 1; 4 dopo 3; 5 e 6 dopo 2; 7 indipendente dopo 3. L'incremento 3 viene dopo il login e l'identità (incrementi 0a e 0b di `identita-e-login.md`); l'incremento 1 non ne dipende. I numeri delle demo slittano di quanti ne prende il login.

**Fonte nuova: il calendario.** La via che costa meno è l'incremento 7: gli inviti sono già nella posta che Octo legge (oggi ne riconosce solo le risposte, per scartarle). Un collegamento vero al calendario di Microsoft 365 darebbe tutte le riunioni, ma richiede una registrazione presso l'IT, contro la scelta «nessuna richiesta all'IT»; la roadmap mette Teams in T1 con «Verbale». Lo terrei per T1.

## 12. Non verificato

- Nulla è stato provato nell'app in esecuzione: tutto viene dalla lettura del codice e delle demo.
- Durata e consumo di quota della valutazione; tempo del calcolo a ogni apertura su una cartella vera.
- Che l'indice di Mail offra un segno affidabile di «risposta» (scelto di non usarlo).
- Che le risposte del PM entrino sempre in memoria con le regole di oggi.
- I conteggi esatti di bug fermi e ore nella bozza della pagina.
- Il mese che la sezione Ore propone all'apertura; che cosa segnala `ProgressWarning` (l'avanzamento non ha voci nel riepilogo finché non lo leggo).
- Stime di sforzo e di righe: mie.
