# Demo 18 — Progetti: passare dall'uno all'altro, toglierne uno senza perdere nulla

Durata: 4 minuti. Mostra il selettore dei progetti in cima alla colonna di sinistra, il dialogo «I tuoi progetti» e un progetto tolto dall'elenco che torna com'era, con le sue letture.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude o ad altri sistemi: progetti e posta sono finti.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/18-progetti/run.sh
   ```
   Atteso: si apre Octo su «Aurora». In alto a sinistra, sotto «Progetto», c'è un solo pulsante con il nome del progetto e una freccia.

2. **Cambia progetto.** Premi il pulsante «Aurora»: si apre l'elenco con «Aurora» spuntato e «Boreale». Scegli «Boreale».
   Atteso: la testata dice «Boreale»; l'elenco si chiude. Con ⌘1 (Ctrl+1 su Windows) torni ad Aurora, con ⌘2 a Boreale.
   Dimostra: l'elenco dei progetti è un selettore, e c'è un solo posto dove si cambia progetto.

3. **Fai leggere la posta ad Aurora.** Torna su «Aurora», apri «Fonti», premi «Collega» nella riga «Posta», poi «Salva» e «Leggi ora».
   Atteso: «Ultima lettura …: 3 nuove, 0 già presenti.»

4. **Prova a togliere Aurora e ripensaci.** Apri l'elenco, premi «Gestisci i progetti…», poi «Togli da Octo» accanto ad Aurora.
   Atteso: la domanda «Togliere «Aurora» da Octo?» spiega che la cartella, le credenziali e il punto delle letture restano. Premi «Annulla»: Aurora è ancora in elenco.
   Dimostra: nessun progetto sparisce con un clic.

5. **Toglila davvero.** Di nuovo «Togli da Octo», poi «Togli».
   Atteso: si apre «Boreale». In alto: ««Aurora» non è più in elenco. La cartella è rimasta dov'è.» con il pulsante «Rimettilo in elenco».

6. **Rimettila.** Premi «Rimettilo in elenco» e apri «Fonti».
   Atteso: Aurora è di nuovo aperta; in «Posta» c'è la stessa «Ultima lettura» del passo 3.
   Dimostra: togliere non cancella né le letture né le credenziali.

7. **Toglila ancora e falla rientrare dalla cartella.** Ripeti il passo 5 e chiudi l'avviso con la «×». Apri l'elenco, premi «Aggiungi un progetto…», poi «Scegli la cartella…» sotto «Ho già una cartella» e scegli la cartella `Aurora` stampata nel terminale.
   Atteso: Aurora torna e si apre su «Fonti», con la stessa «Ultima lettura»: la stessa cartella è lo stesso progetto.

8. **Guarda l'altra strada.** Riapri «Aggiungi un progetto…».
   Atteso: sotto «Parto da zero» si scrive un nome e Octo crea la cartella; «Annulla», Esc o un clic fuori chiudono senza fare nulla. In «Gestisci i progetti…», sotto «Se cambi computer», ci sono «Copia di sicurezza» e «Ripristina».

## Che cosa dimostra
- Passare da un progetto all'altro è un gesto solo, anche da tastiera.
- Togliere un progetto chiede conferma, si annulla con un clic e non fa perdere credenziali né letture.
- Aggiungere, creare, togliere e la copia di sicurezza stanno in due dialoghi, fuori dalla vista di tutti i giorni; gli avvisi si chiudono.

## Limiti
- Su questo computer le credenziali e le letture di un progetto tolto restano finché non lo si rimette: non c'è ancora un modo per cancellarle del tutto.
- «Apri la cartella» dal dialogo dei progetti non c'è ancora.
