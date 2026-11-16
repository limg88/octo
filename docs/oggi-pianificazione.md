# «Oggi» come strumento di pianificazione: seconda revisione

Data: 16/11/2026. Documento di progetto: nessun file dell'app è stato modificato. Segue `oggi-revisione.md` (incrementi A–D, fatti). L'implementazione parte, un incremento per volta, quando il PM la chiede.

**Come è stato fatto.** Lettura del codice (`packages/domain/src/today/`, `packages/application/src/today.ts` e `meetings.ts`, `packages/domain/src/meetings/model.ts`, `packages/domain/src/mail/invite.ts`, `apps/desktop/src/renderer/TodayView.tsx`) e di `roadmap.md`. L'app non è stata avviata.

## Che cosa chiede il PM

«Oggi» deve servire a pianificare la giornata:

1. **All'apertura**, un riepilogo breve a punti degli open point rimasti aperti dal giorno prima.
2. **A fine giornata**, la verifica attraverso le riunioni: un open point è risolto o va in coda per domani.
3. **Le criticità della settimana**: quelle da risolvere e quelle imminenti.
4. **Preparare le riunioni del giorno**, senza mai risultare impreparato.

## 1. Che cosa c'è e che cosa manca

| Richiesta | Che cosa c'è oggi | Che cosa manca |
|---|---|---|
| Riepilogo degli open point | Segnali calcolati ogni volta dalle fonti; «Adesso» con 3 voci; etichette «Nuovo» e «Peggiorato» dall'ultima visita | **L'open point non esiste**: un segnale è un fatto delle fonti (una mail, un conteggio), non un impegno che ha un responsabile e una storia. Non c'è nulla che dica «ieri era aperto, oggi lo è ancora» |
| Verifica a fine giornata dalle riunioni | Le riunioni registrate da Verbale entrano nella cartella (`transcript.md`, `notes.md`, `report.md`) e le legge solo «Chiedi». In «Oggi» compaiono solo quelle senza progetto (`meeting_unassigned`) | **«Oggi» non legge ciò che si è detto in riunione.** Nessun passaggio di chiusura della giornata |
| Criticità della settimana | Rischi aperti in «Da tenere d'occhio» con peso 0 e senza data; fine periodo entro 3 giorni e uscita di una persona entro 7 (`calendarItems`); fine sprint e chiusura del mese come `dueBecause` | Sono sparse in tre fasce e ordinate per fascia, non per data. **Nessuna vista della settimana**; un rischio non ha né scadenza né gravità |
| Preparare le riunioni | La riunione di oggi è una riga con titolo, ora e luogo (`meetingItems`); entra in «Adesso» se comincia entro 2 ore | **Nessun contenuto**: chi c'è, che cosa era rimasto aperto, che cosa è successo dall'ultima volta. E un difetto che viene prima di tutto: vedi sotto |

**Il difetto che viene prima.** Le riunioni di oggi vengono dagli inviti in posta, e di un invito si legge solo il primo evento (`mail/invite.ts`; in `roadmap.md`: «di una riunione ricorrente si vede solo la prima data»). Lo stand-up quotidiano e il SAL settimanale, cioè le riunioni in cui gli open point si chiudono, **oggi non compaiono**. Senza questo, i punti 2 e 4 non stanno in piedi.

Altri limiti che pesano:
- gli inviti arrivano solo se la mail dell'invito entra nel progetto (parole chiave, indirizzi), e solo su Mac;
- l'invito salvato non ha i partecipanti (`meeting` ha `uid`, `summary`, `start`, `end`, `location`);
- una riunione non registrata con Verbale non lascia nulla da leggere.

## 2. L'open point

Una cosa che il PM deve chiudere o far chiudere. Non è un segnale: resta finché qualcuno non la chiude, anche se la fonte da cui è nata non cambia.

| Campo | Contenuto |
|---|---|
| Titolo | una riga, scritta dal PM o da Claude |
| Di chi | il PM o una persona del progetto (da «Persone e calendario») |
| Aperto il | giorno |
| Entro | giorno, facoltativo |
| Fonte | file del progetto e frase, controllata dal codice come per rischi e mail; assente se scritto a mano |
| Stato | aperto, risolto, tolto |
| Storia | una riga per giorno in cui è stato toccato: «in coda dal 14/11», «discusso nel SAL del 15/11: …» |
| Riunione | la serie in cui si discute, quando si sa (stesso `uid` dell'invito) |

**Da dove nasce**, in tre modi:
1. **da una riunione registrata**: Claude legge `report.md`, `notes.md` e `transcript.md` e propone gli impegni presi e le domande rimaste senza risposta, ognuno con la frase;
2. **da un segnale di «Oggi»**: un pulsante «Segna come open point» nel dettaglio (una mail a cui rispondere, i bug fermi, un rischio). Il punto resta legato al segnale: quando il segnale sparisce da solo, il punto si chiude da solo (regola di «Risolti da soli oggi», che esiste);
3. **a mano**.

**Dove sta.** Registro del progetto, come i rischi: stato in `_octo/.impostazioni/`, testo in `_octo/progetto/open-point.md`, così «Chiedi» e i deliverable (verbale, stato di avanzamento) lo citano. Dominio in `domain/src/today/open-points.ts` sul modello di `risks.ts`.

**Proposta, da confermare (§9):** un open point proposto da Claude con la frase trovata nel file entra subito nel registro, segnato «da Claude», e si toglie con un clic («Non è un open point», che non lo ripropone). Con la frase non trovata non entra. È diverso dai rischi, dove serve l'accettazione: qui lo scopo è che il riepilogo del mattino sia già pronto.

## 3. «Il punto»: il riepilogo all'apertura

Primo riquadro della pagina, sopra «Adesso». Lo compone **il codice** dal registro; Claude ha già fatto la sua parte la sera prima (§4). Al più 7 punti, gli altri dietro «tutti gli open point».

```
Il punto — lunedì 16/11
• 4 open point in coda da venerdì
  – Ambiente di prova per il collaudo · di Rossi · aperto da 6 giorni · entro mer 18/11
      ↳ se ne parla oggi alle 10:00, SAL settimanale
  – Risposta al cliente sulla variante CR-12 · tua · aperto da 2 giorni
  – …
• Chiusi venerdì: 2   (Stima della migrazione — «confermata a 12 giorni», SAL 13/11)
• Nuovi da venerdì: 1  (dal SAL del 13/11)
• Da confermare: 1    (riunione non registrata)
```

Regole:
- **«dal giorno precedente»** vale l'ultimo giorno lavorativo: il lunedì il riepilogo parla di venerdì;
- ordine: scaduti, poi con scadenza in settimana, poi i più vecchi;
- ogni punto dice di chi è, da quanto è aperto e **in quale riunione di oggi si può chiudere**;
- azioni sulla riga: Risolto, Entro… (data), Passa a… (persona), Apri la fonte;
- «Chiusi ieri» è la prova che la verifica ha lavorato: ogni chiusura ha la frase e «Riapri».

Il riquadro resta tutto il giorno; dopo la prima visita si chiude in una riga («4 in coda · 2 chiusi ieri») e si riapre con un clic.

## 4. La chiusura di giornata

Il passaggio che oggi manca del tutto.

**Quando.** Dopo che l'ultima riunione del giorno è finita ed è entrata da Verbale (la lettura periodica gira ogni 15 minuti). Se a quell'ora Octo è chiuso, alla prima apertura del giorno dopo, prima di comporre «Il punto». Sempre e solo per il progetto aperto, come la valutazione di oggi. C'è anche il pulsante «Chiudi la giornata».

**Che cosa fa Claude**, in una sola esecuzione di sola lettura: riceve gli open point aperti e i file delle riunioni registrate nel giorno (più le mail del giorno), e per ogni punto risponde:

| Esito | Condizione | Effetto |
|---|---|---|
| Risolto | una frase che lo dice, trovata nel file | stato «risolto», con la frase e la riunione |
| Ancora aperto | se n'è parlato, non è chiuso | resta aperto, **in coda per domani**; nella storia ciò che si è detto (nuova data, nuovo responsabile) |
| Non discusso | nessuna riunione ne parla | resta aperto, in coda; nessuna riga nella storia |

In più propone i **nuovi** open point nati in quelle riunioni (§2, modo 1).

**Che cosa controlla il codice**, come già per mail e rischi:
- una chiusura vale solo con la frase trovata nel file; altrimenti il punto resta aperto e la proposta va in «Da confermare»;
- una nuova scadenza o un nuovo responsabile detti in riunione sono **proposte** sulla riga, non modifiche;
- **Claude non toglie mai un punto**: lo chiude con la fonte, e «Riapri» è la parola del PM e vale di più.

**Senza registrazione.** Se nel giorno c'era la riunione legata a un open point ma Verbale non l'ha registrata, non c'è nulla da leggere: il punto va in «Da confermare» con la domanda «SAL del 16/11 non registrato: risolto o in coda?». Un clic.

**Senza Claude.** Tutto resta aperto e in coda; si chiude a mano. «Il punto» funziona lo stesso.

## 5. Criticità della settimana

Un riquadro sotto «Adesso», calcolato **dal codice**, ordinato per data e non per fascia. Due colonne.

**In corso (da risolvere)**
- open point scaduti, o aperti da più di 5 giorni lavorativi;
- rischi aperti del registro;
- bug fermi (`bugs_stuck`), con il conteggio e il più vecchio;
- ore e previsionale che non tornano, quando il mese chiude in settimana;
- fonti ferme o in errore (ciò che si legge è vecchio).

**In arrivo (entro la settimana)**
- scadenze degli open point;
- scadenze scritte nelle mail (`judgement.deadline`, già letta);
- fine dello sprint (`sprintEnd`) e ciò che lo sprint lascia indietro (requisiti, allineamento);
- chiusura del mese (`isMonthClosing`);
- fine di un periodo e uscita di una persona (`calendarItems`);
- riunioni della settimana con open point ancora aperti.

Regole:
- **la settimana** va da oggi a domenica; dal venerdì comprende anche la successiva;
- ogni riga: che cosa, quando («giovedì», «scaduto da 2 giorni»), di chi, dove si risolve;
- al **registro dei rischi** si aggiungono due campi facoltativi, «entro» e gravità (alta, media, bassa): un rischio con la data entra in «In arrivo», senza resta in «In corso»;
- una criticità compare una volta sola: ciò che è qui esce da «Da tenere d'occhio», che resta per le mail solo da seguire.

Funzione pura `weekItems(items, openPoints, risks, today)` in `domain/src/today/week.ts`.

## 6. Preparare le riunioni

**Prima, le riunioni giuste.** Le ricorrenze dell'invito (`RRULE`, eccezioni, occorrenze spostate o annullate) si espandono nel dominio: ogni occorrenza è una riunione del suo giorno, con la chiave `uid` più data. Dall'invito si tengono anche i partecipanti.

**L'agenda.** Sotto «Il punto», le riunioni di oggi in ordine d'orario, ognuna con lo stato della preparazione: «pronta», «3 open point», «niente da portare». Quelle di domani in una riga, per prepararsi la sera.

**La scheda di una riunione**, in due parti.

*Dal codice, sempre:*
- quando, dove, chi (dall'invito);
- **open point da portare**: quelli della stessa serie, e quelli di chi partecipa;
- **l'ultima volta**: la riunione registrata più recente della stessa serie, con il collegamento a `report.md`, e gli open point nati o chiusi lì;
- **da allora**: le mail dei partecipanti che aspettano il PM e quelle del PM senza risposta;
- le criticità della settimana che toccano i partecipanti o la serie;
- per le riunioni di avanzamento, i numeri del Cruscotto (bug aperti e fermi, storie dello sprint per stato).

*Da Claude, quando c'è:* «Da portare», da 3 a 5 punti: che cosa chiedere, che cosa ti chiederanno, che cosa decidere. Ognuno con la frase, controllata; un punto senza frase trovata non si mostra.

**Quando si prepara.** Alla prima apertura del giorno, per tutte le riunioni di oggi, nella stessa esecuzione della valutazione: non al clic, altrimenti cinque minuti prima della riunione si aspetta. Se dopo arriva qualcosa che tocca una riunione non ancora cominciata (una mail di un partecipante, un open point), la scheda dice «cambiato dalle 9:10» e la parte del codice è già aggiornata.

**Per non essere impreparato:**
- la notifica che esiste («entra in "Adesso"» entro 2 ore) porta alla scheda, non alla riga;
- una seconda, 15 minuti prima, solo se la scheda non è stata aperta;
- «Copia la scheda» come testo, per gli appunti.

**Dopo la riunione.** Quando arriva la registrazione, la scheda mostra che cosa è stato chiuso e che cosa è nato: è la chiusura di giornata (§4) vista dalla riunione.

## 7. La pagina dopo la revisione

Dall'alto:
1. Intestazione (com'è).
2. **Il punto**: open point in coda, chiusi ieri, nuovi, da confermare.
3. **Riunioni di oggi**: agenda con le schede.
4. «Adesso» (com'è; la riunione entro 2 ore apre la scheda).
5. **Criticità della settimana**: in corso e in arrivo.
6. «Da fare oggi» (com'è, più «Segna come open point»).
7. «Da tenere d'occhio», senza rischi e date di calendario.
8. Messe da parte, valutazione di Claude, impostazioni (com'è).

Il contatore nella barra laterale conta anche gli open point scaduti e quelli «da confermare».

## 8. Piano a incrementi

Ogni incremento ha la sua demo e i suoi test.

| # | Incremento | Paragrafi | Claude |
|---|---|---|---|
| E | Riunioni ricorrenti e partecipanti dall'invito; agenda di oggi e di domani | §6 (prima parte) | no |
| F | Registro degli open point (a mano e da un segnale), file del progetto, «Il punto» | §2, §3 | no |
| G | Criticità della settimana; «entro» e gravità nei rischi | §5 | no |
| H | Chiusura di giornata: Claude legge le riunioni registrate, chiude con la fonte, mette in coda, propone i nuovi | §2 (modo 1), §4 | sì |
| I | Scheda di preparazione: parte del codice, poi «Da portare» di Claude, notifica prima della riunione | §6 | sì |

E viene per primo perché tutto il resto si appoggia alle riunioni. E, F e G non dipendono da Claude e danno già il riepilogo del mattino e la settimana, con gli open point tenuti a mano; H toglie il lavoro a mano; I usa tutto ciò che c'è sotto.

## 9. Da decidere o verificare

Scelte fatte qui come proposta: se il PM non dice altro, valgono queste.

| Decisione | Proposta |
|---|---|
| Un open point proposto da Claude entra da solo? | Sì, con la frase trovata; si toglie con un clic |
| Una chiusura letta in riunione si applica da sola? | Sì, con la frase trovata; «Riapri» nel riepilogo del mattino |
| Che cos'è «la settimana» | Da oggi a domenica; dal venerdì anche la successiva |
| «Vecchio» per un open point senza scadenza | 5 giorni lavorativi |
| Riepilogo di più progetti | «Il punto» è del progetto; in «Tutti i progetti» il conteggio degli open point in coda e l'agenda del giorno di tutti, senza Claude |

Da verificare:
- **Il calendario.** Gli inviti in posta bastano solo se ogni invito entra nel progetto; su Windows la posta non si legge. Una fonte «Calendario» (file `.ics` o Microsoft 365) darebbe tutte le riunioni, ma chiede un permesso all'IT oltre al login: da decidere se serve dopo l'incremento E.
- **Le riunioni non registrate.** La verifica automatica vale quanto l'abitudine di registrare con Verbale: da misurare sul pilota quante finiscono in «Da confermare».
- **La serie di una riunione registrata.** Verbale non dà l'evento di calendario (`verbale-richieste.md`, richiesta 3): il legame si fa per sovrapposizione d'orario con l'occorrenza, come per l'assegnazione al progetto.
- **Il costo.** La chiusura legge le trascrizioni del giorno (lunghe): `report.md` e `notes.md` per primi, la trascrizione solo per cercare la frase. Da misurare con Claude vero.
- **La qualità** degli open point estratti da una trascrizione vera: quanti sono rumore. Se sono troppi, la prima proposta della tabella si rovescia (entrano solo quelli accettati).

## 10. Stato dell'implementazione

Il PM ha chiesto di procedere in autonomia il 16/11/2026: valgono le proposte del §9.

| # | Stato | Demo | Scelte fatte implementando |
|---|---|---|---|
| E | fatto (16/11/2026) | `demo/36-oggi-agenda` | Le ricorrenze seguite sono giornaliera, settimanale, mensile e annuale, con intervallo, numero di volte, ultimo giorno, giorni della settimana, giorno del mese e «il primo lunedì»; una regola che Octo non sa seguire vale per la sola prima data, mai a caso. Un invito per una sola occorrenza la sposta o la annulla. Gli inviti si cercano fino a 12 mesi indietro (prima si leggevano solo due mesi di posta). Le riunioni non stanno più in «Da fare oggi»: stanno nell'agenda; «Adesso» non cambia. La stessa regola serve ad attribuire al progetto una registrazione di Verbale fatta durante una riunione ricorrente. |
| F | fatto (16/11/2026) | `demo/37-oggi-il-punto` | Stato in `_octo/.impostazioni/open-point.json`, testo in `_octo/progetto/open-point.md`. Un punto aperto da una segnalazione si chiude da solo quando la segnalazione sparisce (non per riunioni e date di calendario, che finiscono con il giorno). «In quale riunione di oggi si chiude»: la serie del punto, oppure il nome di chi lo ha in carico fra gli invitati di una riunione non ancora cominciata. Il riquadro non si riduce da solo dopo la prima visita: si riduce con «Riduci». «Passa a…» è il campo «Di chi» di «Modifica». Il contatore nella barra laterale conta anche i punti scaduti e quelli da confermare. |
| G | fatto (16/11/2026) | `demo/38-oggi-settimana` | «In corso»: punti scaduti o aperti da più di 5 giorni lavorativi senza data, rischi senza data o scaduti (per gravità), mail con scadenza passata, bug fermi, fonti ferme, ore e previsionale quando una data li rende dovuti. «In arrivo»: scadenze di punti, rischi e mail, fine sprint e ciò che lascia indietro, chiusura del mese, date del calendario. Rischi del registro, date del calendario e bug fermi escono da «Da tenere d'occhio»; i rischi proposti restano lì. Non fatto: «riunioni della settimana con open point ancora aperti» (l'agenda copre oggi e il giorno lavorativo dopo). |
| H | fatto (16/11/2026) | `demo/39-oggi-chiusura` | Claude legge le registrazioni degli ultimi 7 giorni non ancora lette (al più 8 per volta): riepilogo e appunti, la trascrizione per la frase. Parte da solo con la valutazione del giorno, e da solo più tardi quando arriva una registrazione nuova; «Chiudi la giornata» lo chiede a mano. Una frase vale solo se sta in un file di una delle riunioni date a Claude. Una chiusura letta su una frase non trovata diventa «Da confermare». Per una riunione tenuta e non registrata Octo chiede dell'ultima, una volta: «Resta in coda» lascia una riga nella storia del punto. Un punto proposto da Claude e tolto dal PM non è riproposto (stesse parole della fonte). |
| I | fatto (16/11/2026) | `demo/40-oggi-preparazione` | L'ultima volta della stessa riunione si riconosce dalla registrazione fatta durante un'occorrenza della serie o, se il calendario non lo dice, dal titolo uguale, negli ultimi 60 giorni. La scheda della prossima riunione è aperta senza clic. Claude prepara le riunioni non ancora cominciate (al più 6, 5 note ciascuna) nella valutazione del giorno; le sue note valgono solo il giorno in cui sono scritte. La notifica 15 minuti prima parte dopo una lettura periodica, per ogni riunione del giorno, una volta, e non mentre il PM guarda «Oggi» di quel progetto; non dipende dall'aver aperto la scheda. Non fatto: «cambiato dalle 9:10» sulla scheda. |

**Verificato.** Test di dominio, applicazione, infrastruttura e interfaccia con Claude finto; lint, tipi e copertura. Nella finestra vera, con un progetto finto e Claude finto, una prova automatica una tantum: «Il punto», l'agenda con le riunioni ricorrenti, la scheda con le note di Claude, le criticità della settimana e la chiusura di giornata su una registrazione (un punto chiuso con la fonte, uno in coda con ciò che si è detto, uno nuovo). **Non verificato:** i copioni delle demo 36–40 passo per passo a mano, e la notifica 15 minuti prima; Claude vero (qualità degli open point estratti da una trascrizione, costo della chiusura e della preparazione); posta e Verbale veri; Windows, dove la posta non si legge e quindi agenda, chiusura per riunione e schede non hanno riunioni.

**Limiti noti.**
- Una riunione il cui invito è arrivato prima del giorno d'inizio della posta del progetto non c'è.
- Gli inviti già in memoria prendono ricorrenza e partecipanti quando la mail viene riletta: per averli su tutti va fatto ripartire il giorno d'inizio.
- Ogni calcolo della pagina legge gli inviti di 12 mesi e i `_meta.md` delle riunioni: su un progetto con molta posta va misurato.

