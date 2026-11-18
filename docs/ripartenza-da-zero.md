# Ripartire da zero con DEEM e Petrolvalves

Copione scritto il 18/11/2026 per la build 0.10.0 del ramo `feat/r6b-ripartenza`. Serve a provare Octo sui due progetti reali come li troverebbe un PM il primo giorno: cartelle con i soli documenti di partenza, stato dell'app vuoto, nessuna wiki e nulla di ciò che Octo aveva già letto o scritto. Ogni passo dice il gesto, che cosa aspettarsi e quale voce di `verifiche-da-fare.md` chiude.

Qui non ci sono cifre, nomi di persone o testi dei clienti: i valori veri stanno nel foglio privato (vedi sotto), fuori dal repository.

Tempo: mezza giornata per DEEM, un'ora per Petrolvalves, poi tre mattine da cinque minuti.

## Che cosa è già pronto

| Che cosa | Dove |
|---|---|
| Build per Mac (Apple silicon), non firmata | `apps/desktop/release/Octo-0.10.0-mac-arm64.dmg` |
| Cartella nuova di DEEM: i documenti, senza `_octo/` | `~/Documents/Projects/DEEM-da-zero` |
| Cartella nuova di Petrolvalves: i documenti, senza `_octo/` e senza `Wiki/` | `~/Documents/Projects/Petrolvalves-da-zero` |
| Foglio dei valori da riscrivere (fonti, persone, calendario, tariffe, cruscotto, ore, moduli) | `~/Documents/Projects/_ripartenza/valori.md` |

Le cartelle `DEEM` e `Petrolvalves` e lo stato dell'app di oggi non sono stati toccati: restano il termine di confronto e la via del ritorno.

Nelle cartelle nuove **non** ci sono: la posta e le voci dei sistemi già scaricate, il testo già estratto dai documenti, le impostazioni, i deliverable approvati, le pagine di memoria, la wiki della Suite v0. Ci sono ancora gli appunti delle riunioni e degli standup che stavano fra i documenti: sono materiale di partenza. Se vuoi una prova più dura, toglili dalla cartella nuova prima di cominciare e scrivilo nell'esito.

Per rifare il foglio dei valori dopo un cambio delle impostazioni: `python3 ~/Documents/Projects/_ripartenza/valori.py`.

## Prerequisiti

- Claude Code installato e con l'accesso fatto: `claude --version` risponde.
- Mail aperto almeno una volta con la casella aziendale, e la posta scaricata.
- Verbale, se vuoi provare le riunioni, con la sua cartella di esportazione.
- Le credenziali a portata di mano: token di Azure DevOps, token di Atlassian (Jira e Confluence), utente e password dell'archivio di NetSuite. Nessuna è stata copiata.
- La VPN o la rete che serve per NetSuite.
- Il Octo di oggi **chiuso**.

## 1. Installa la build e aprila su uno stato vuoto

1. Apri il `.dmg` e trascina Octo in Applicazioni, sostituendo quello che c'è.
   La build non è firmata. Costruita su questo Mac non viene messa in quarantena; se macOS la rifiuta: `xattr -dr com.apple.quarantine /Applications/Octo.app`.
2. Prepara la cartella dei dati nuova con il solo file che dice dove si entra (non è un segreto: sono gli identificativi dell'organizzazione):
   ```bash
   mkdir -p "$HOME/Library/Application Support/Octo-da-zero"
   cp "$HOME/Library/Application Support/Octo/accesso.json" "$HOME/Library/Application Support/Octo-da-zero/"
   ```
   Se salti la copia, Octo te li chiede alla prima apertura.
3. Fai partire il cronometro e apri Octo sulla cartella dei dati nuova:
   ```bash
   open -n --env OCTO_DATA_DIR="$HOME/Library/Application Support/Octo-da-zero" /Applications/Octo.app
   ```
   **Da qui in poi apri Octo sempre con questo comando**: con il doppio clic si apre sullo stato di prima.
4. «Entra con l'utente aziendale».
   Atteso: «Nessun progetto»; in basso a sinistra il tuo nome e la versione di Claude.
   Se la versione di Claude manca, Octo non trova Claude Code: fermati e scrivilo.

## 2. DEEM: il progetto e le fonti

5. «Aggiungi un progetto…» → «Scegli la cartella…» → `~/Documents/Projects/DEEM-da-zero`.
   Atteso: si apre «Impostazioni» sul pannello «Avvio del progetto», con «Niente è ancora collegato».
6. **Posta.** «Collega: Posta». Parole chiave, mittenti da escludere e giorno di inizio dal foglio dei valori. «Anteprima» prima di salvare: guarda quante mail entrerebbero e se fra i primi oggetti c'è rumore.
   Le parole chiave vanno **una per riga**: incollate su una riga sola con le virgole diventano un'unica parola che nessuna mail contiene, e l'anteprima dice «0 mail entrerebbero con queste regole». Il foglio dei valori le dà già una per riga; per gli altri campi vale ciò che dice l'etichetta (alcuni vogliono le virgole).
   Se Octo dice che non riesce a leggere Mail: Impostazioni di Sistema › Privacy e sicurezza › Accesso completo al disco, abilita Octo e riaprilo (con il comando del passo 3). Con una build nuova non firmata il permesso va quasi sempre ridato.
7. **Azure DevOps**, **Jira**, **Confluence**, **NetSuite**: per ciascuno «Collega», i valori dal foglio, la credenziale a mano, «Prova e salva».
   Atteso per ciascuno: «Collegamento riuscito e salvato.»
   Confluence è una fonte del cliente, non la wiki della Suite: va collegato. Se vuoi provare anche senza, lascialo fuori e scrivilo nell'esito.
8. **Riunioni (Verbale)**: la cartella di esportazione e il giorno di inizio.
9. «Leggi tutte le fonti». Segna quanto ci mette e, per ogni fonte, quante voci nuove dice.
   Atteso: «Fatto. Ora puoi fare domande in «Chiedi».» I documenti Office e PDF della cartella vengono convertiti in testo nello stesso giro.
   Confronta i conteggi a occhio con la cartella di prima (`ls ~/Documents/Projects/DEEM/_octo/posta | wc -l` e simili): l'ordine di grandezza deve tornare.
10. Ferma il cronometro alla prima risposta citata (passo 14). **Chiude R2.1** insieme alle cinque domande; il tempo dall'installazione è il dato di F1 sul Mac.

## 3. DEEM: ciò che scrivi a mano

11. «Impostazioni» → «Persone e calendario»: persone (nome, ruolo, parte, date, allocazione) e periodi dal foglio.
    Le persone servono anche alle riunioni: una riunione entra da sola solo se tutti i partecipanti noti sono di questo progetto.
12. «Impostazioni» → «Carta intestata» e i modelli dei tipi che usi (stanno in `Modelli/` nella cartella nuova). «Avanzate» → «Quale Claude lavora», se avevi scelto modelli diversi dal predefinito.
13. «Cruscotto»: «Leggi da Azure DevOps», poi tag e tipi dal foglio.

Scorciatoia, se riscrivere persone e tariffe a mano ti costa troppo: sono cose che avevi scritto tu, non la wiki. A Octo chiuso:
```bash
mkdir -p ~/Documents/Projects/DEEM-da-zero/_octo/.impostazioni
cp ~/Documents/Projects/DEEM/_octo/.impostazioni/team.json ~/Documents/Projects/DEEM-da-zero/_octo/.impostazioni/
```
Lo stesso vale per `forecast.json` (tariffe e tipi delle commesse). Se la usi, scrivilo nell'esito: il tempo di avvio non è più quello di un PM che parte da zero.

## 4. DEEM: «Chiedi» senza wiki

14. Fai le cinque domande del confronto con la Suite v0 del 14/11 (non sono scritte nel repository: le hai tu), una per conversazione. Se non le hai più, scegline cinque che chiedono contesto: «perché abbiamo deciso…», «da quando…», «a che punto siamo su…».
    Per ciascuna guarda: la risposta ha fonti riscontrate; le fonti sono mail, voci dei sistemi o documenti (non può più essere la wiki); che cosa manca rispetto a ciò che sai.
    Segna per ognuna: alla pari, meglio, peggio di prima, e perché. **Chiude R2.1.** Tieni le risposte: le rifai al passo 22.
15. Una domanda «Con calcoli» su un file della cartella (una somma o un confronto che sapresti rifare a mano).
    Atteso: una tabella con la fonte e il file prodotto; nella cartella del progetto nulla finché non scegli tu che cosa tenere.
    Se «Con calcoli» non è offerto, Octo dice perché. **Chiude R3.1** se rifai un'analisi del vault e le cifre tornano; **R3.3** per il solo fatto che l'interprete dell'app installata parte.

## 5. DEEM: «Oggi»

16. Apri «Oggi» dopo la prima lettura.
    Guarda: le mail che aspettano te sono quelle che ti aspetti; le riunioni di oggi ci sono; bug fermi e storie poco chiare hanno i conteggi che conosci; le fonti sono segnate come lette.
    Segna che cosa manca e che cosa è di troppo.

## 6. DEEM: «Commessa»

17. «Commessa» → «Sintesi», per ogni commessa: ordinato, fatturato, riconosciuto, costi, margine contro NetSuite aperto accanto. **Chiude R1.1.**
18. Guarda l'avanzamento e la fonte scritta sotto: sistema, riconosciuto su ordinato, oppure stima dai costi. Per le commesse a corpo dice se la vista di NetSuite è popolata e in che forma. **Chiude R1.2 e R1.3.**
19. «Ore»: «Leggi i timesheet da NetSuite», «Leggi le ore da Jira», codici e soglie dal foglio. Poi «Previsionale»: tipi delle commesse e tariffe («Impostazioni del previsionale» → «Tariffe e costi che NetSuite non dice»), il modello dell'amministrazione, «Compila il modello Excel» sul mese scorso. **Chiude R1.5.**
    R1.6 (il piano esportato dalla versione precedente) non si prova qui: riguarda la cartella di prima.

## 7. DEEM: deliverable

20. «Deliverable» → «Stato di avanzamento» sul periodo in corso, dal modello delle slide. Leggi la bozza, chiedi una modifica a parole, approva. Cronometra dalla richiesta al file. **Conta per R2.3** (ne servono due reali) e per **R4b.2** (la struttura è quella delle bozze di prima).
21. Sullo stesso tipo: «Come Octo scrive questo tipo» → scrivi una correzione vera, di quelle che avresti fatto alla skill → leggi le istruzioni proposte **per intero** → «Usa queste istruzioni» → riscrivi la bozza.
    Guarda: la riscrittura ha cambiato solo ciò che hai chiesto; la bozza successiva segue la correzione. Meno di cinque minuti? **Chiude R4b.1.**
    Poi i due deliverable con script, sotto il catalogo: «Aggiungi al progetto» per «Modulo di avanzamento» e «Allineamento dello sprint», i dati dal foglio dei valori, «Esegui». **Chiudono R4.1 e R4.2** se il modulo e l'elenco sono quelli che avresti prodotto con la Suite; una correzione a parole dello script che resta nel progetto **chiude R4.3**.

## 8. DEEM: la memoria al posto della wiki

22. «Deliverable» → le tre «Memoria: …» (fatti correnti, decisioni e regole del PM, cronologia del progetto). Per ognuna: bozza, lettura con le fonti, correzione a parole dove sbaglia, approvazione.
    Atteso: tre pagine in `_octo/progetto/memoria/`, ognuna con le sue fonti. **Chiude R5.1**; una correzione fatta in meno di cinque minuti **chiude R5.3**.
23. Rifai le cinque domande del passo 14, in conversazioni nuove.
    Guarda: le risposte citano le pagine di memoria dove serve contesto; sono migliorate rispetto al passo 14; nessuna ripete una cosa sbagliata che avevi lasciato in una pagina. **Chiude R5.2**; per **R5.4** approva apposta una frase sbagliata, chiedi, poi correggi la pagina e chiedi di nuovo.
    È il confronto che conta: senza wiki, la memoria scritta da Claude e approvata da te riporta le risposte dov'erano con la Suite?

## 9. DEEM: una riunione

24. Registra con Verbale una riunione vera del progetto (o aspetta la prossima) e fai «Leggi ora» su «Riunioni (Verbale)».
    Atteso: se tutti i partecipanti noti sono persone di DEEM, la riunione è già nel progetto; altrimenti «Oggi» la segnala e la assegni tu. **Conta per R2.7** (servono due settimane).

## 10. Petrolvalves

Lo stesso giro su `~/Documents/Projects/Petrolvalves-da-zero`, con queste differenze:

- Fonti: posta, Jira, NetSuite, riunioni. Azure DevOps e Confluence non c'erano.
- Qui la wiki c'era davvero ed è rimasta fuori: è il progetto su cui il confronto del passo 14 contro il 23 dice di più.
- Una sola commessa, a corpo: i passi 17 e 18 sono quelli che contano (R1.2, R1.3).
- Nessun periodo di calendario e nessun modulo di avanzamento: salta la parte sugli script se non ti serve.
- Con due progetti aperti guarda anche che una riunione con persone di uno solo dei due vada nel progetto giusto, e che una con persone di tutti e due resti da assegnare.

## 11. Tre mattine senza toccare nulla

Per tre giorni lavorativi apri Octo (con il comando del passo 3), lascialo aperto, e la mattina guarda solo:

- «Impostazioni» → ogni fonte ha un'ultima lettura di oggi e nessun errore;
- «Oggi» → ciò che compare è ciò che troveresti tu guardando posta, tracker e calendario;
- non hai copiato, esportato o incollato nulla a mano.

Se una fonte si ferma, scrivi quale, quando e con che messaggio, e non rimediare a mano prima di averlo scritto. **Chiude R2.2.**

## 12. Dove scrivere gli esiti

In `docs/verifiche-da-fare.md`, nella colonna dello stato della voce: data, esito in una riga, e che cosa non è tornato. Senza cifre e senza nomi dei clienti: «coincide», «differenza sull'ordinato di una commessa, da capire», «due risposte su cinque peggio di prima». I dettagli tienili nel foglio privato.

Una voce è chiusa solo se l'hai vista tu; «raggiunto» lo scrivi tu.

## 13. Tornare indietro

- Octo di prima, con i progetti di prima: chiudi Octo e aprilo con il doppio clic. Lo stato in `~/Library/Application Support/Octo` e le cartelle `DEEM` e `Petrolvalves` sono come li hai lasciati. La build installata è però quella nuova: se vuoi anche la versione di prima, reinstallala dal suo `.dmg`.
- Buttare la prova: chiudi Octo, poi cancella tu `~/Library/Application Support/Octo-da-zero`, le due cartelle `…-da-zero` e `~/Documents/Projects/_ripartenza`. Sono tutte copie.
- Tenere la prova come progetto vero: rinomina le cartelle quando vuoi; Octo ritrova un progetto spostato da «Aggiungi un progetto…» sulla cartella nuova.

## Che cosa questo copione non prova

- Nulla su Windows: recinto in WSL2, installazione sul PC del pilota e posta (R2.4-R2.6, R6.1-R6.9). Per la posta si aspetta l'IT: `richiesta-it-posta.md`.
- La cartella condivisa con due persone su SharePoint (R2.9) e il lavoro della collega (R2.8, R4.4, R4.5).
- Un Mac con processore Intel (R3.4): la build è solo per Apple silicon.
- La prova ostile del recinto (R3.2) si lancia a parte, dal repository: `pnpm test:recinto`.
