# Demo 56 — Pannelli di configurazione: liste richiuse, comandi che dicono cosa usano, campi che spiegano il vuoto

Durata: 5 minuti. Gli interventi UX-24 … UX-35 di `docs/revisione-ux.md` («Integrazione sui pannelli di configurazione»).

## Prerequisiti
- Node 24, pnpm 12, macOS o Linux.
- Nessun accesso a Claude né ad altri sistemi: posta, tracker e Claude sono finti e vivono su questo computer.
- Chi entra è già «Paola Verdi».

## Passi

1. **Cruscotto: prima le scelte, poi le liste.**
   ```bash
   bash demo/56-pannelli-di-configurazione/run.sh
   ```
   Apri «Cruscotto» › «Impostazioni del cruscotto».
   Atteso: una lista con almeno nove valori mostra i valori scelti con la loro «×» e una riga «Scegli tra N opzioni»; un clic (o Invio) apre ricerca e caselle. Le liste brevi restano tutte in vista. In fondo, in «Come leggo gli stati dei bug», ogni menu della fase sta accanto al nome dello stato e i menu partono dallo stesso bordo.
   Dimostra: le soglie si raggiungono senza attraversare tre liste (UX-24, UX-30).

2. **Ore: la data limite spiega il campo vuoto.** Apri «Ore» › impostazioni.
   Atteso: il campo si chiama «Confronta fino al»; sotto: «Le ore dei giorni successivi restano fuori dal confronto. Lascia vuoto per usare tutto il periodo scelto.». Le due liste di eccezioni, se lunghe, sono richiuse come nel passo 1.
   Dimostra: un campo vuoto dichiara il suo effetto (UX-31, UX-24).

3. **Previsionale: formato del mese e tariffe a richiesta.** Apri «Previsionale» › «Impostazioni del previsionale».
   Atteso: la colonna è «Mese di inizio (AAAA-MM)» e una cella vuota mostra solo «AAAA-MM», non un mese d'esempio. «Tariffe al giorno» è una riga che si apre. Aprila, scrivi una persona senza tariffa, richiudi e premi «Salva»: il blocco si riapre da solo con l'errore; ciò che avevi scritto è ancora lì.
   Dimostra: un esempio non sembra un valore, e un errore non resta nascosto (UX-32, UX-33).

4. **Avanzamento: la cella che riceve il dato.** Apri «Avanzamento» › impostazioni, alla mappa delle celle.
   Atteso: i pulsanti dei dati sono disattivati con «Scegli una riga con una cella valida per inserire un dato.». Scrivi `D2` in una riga e clicca nel suo testo: compare «Inserisci nella cella D2» e i pulsanti si attivano. Aggiungi una riga sopra o sotto e toglila: la destinazione resta D2. Togli la riga di D2: i pulsanti si disattivano.
   Dimostra: il dato non finisce mai in una riga diversa da quella indicata (UX-34).

5. **Allineamento: stati equivalenti leggibili.** Apri «Allineamento» › «Che cosa confronto», alle equivalenze fra stati.
   Atteso: le due liste di stati sono campi su due righe; scrivendo molti stati separati da virgole il testo va a capo invece di sparire oltre il bordo. I tag, se molti, sono richiusi come nel passo 1. Salva: i valori restano liste separate da virgole.
   Dimostra: si controlla tutta l'associazione prima di salvare (UX-35).

6. **Collegamenti: «Leggi» dichiara che cosa usa.** Apri «Impostazioni» › «Collegamenti», poi «Posta», «Riunioni» e un connettore.
   Atteso: dentro ogni modulo aperto il pulsante è «Leggi con le impostazioni salvate»; nella testata della fonte chiusa resta «Leggi ora». In Posta «Anteprima» c'è ancora e usa ciò che stai scrivendo. In NetSuite il server è «Server (nome DNS o indirizzo IPv4 privato)»; l'email sta prima di «Cerca le tue commesse» e i risultati compaiono subito sopra i codici (la ricerca vera richiede il NetSuite finto della demo 54).
   Dimostra: non si crede di leggere con valori non ancora salvati (UX-25, UX-26, UX-27).

7. **Oggi e Deliverable.** In «Oggi» apri il registro dei rischi; in «Deliverable» crea un tipo personalizzato.
   Atteso: ogni rischio con una fonte ha il pulsante «Apri la fonte» allineato a sinistra (il percorso si legge passandoci sopra) e l'estratto subito sotto. Nel tipo personalizzato il campo è «Domande da fare prima della bozza», con sotto «Scrivi una domanda per riga. Aggiungi * alla fine delle domande obbligatorie.».
   Dimostra: l'istruzione operativa sta nell'aiuto, non nel titolo (UX-28, UX-29).

## Test
```bash
pnpm test
pnpm test:coverage
pnpm exec vitest run apps/desktop/test/<file>.test.tsx   # mirati
```
