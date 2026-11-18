# Demo 70 — Deliverable: tu o lei, e la rilettura critica che si corregge un rilievo alla volta

Durata: 5 minuti. Incremento I3 di `docs/esiti-prova-deem.md`: chi scrive un'email dà del tu o del lei come fa il PM con quella persona; i rilievi della rilettura critica sono di una frase, ognuno si corregge da solo, e il campo della modifica generale parte da una proposta.

## Prerequisiti
- Node 24, pnpm 12. Nessun accesso a Claude: Claude finto. Scrive «Ciao Carla,» quando il testo sulle persone dice che il PM le dà del tu, altrimenti «Gentile dottoressa Bianchi,»; se fra i dati c'è `#inventa` mette nella bozza una cifra senza fonte, che la rilettura critica contesta.

## Passi

1. **Avvia la demo e scrivi un'email senza aver detto nulla.**
   ```bash
   bash demo/70-deliverable-tu-e-rilettura/run.sh
   ```
   «Deliverable» → «Email al cliente». A chi scrivi: `Carla Bianchi`. Di che cosa: `Collaudo #inventa`. Che cosa chiedi: `Conferma la data`. «Scrivi la bozza».
   Atteso: la bozza comincia con «Gentile dottoressa Bianchi,». Senza una parola del PM e senza mail già mandate, vale il lei.

2. **Leggi la rilettura critica.** A destra, «Rilettura».
   Atteso: «Da correggere prima di farlo uscire.» e un rilievo di una frase, «Il budget non ha una fonte», con il passo del testo a cui si riferisce. Sotto, «Che cosa vuoi cambiare?» è già compilato: «Correggi i rilievi della rilettura critica: - Il budget non ha una fonte». Si manda così o ci si scrive sopra.

3. **Correggi solo quel rilievo.** Sul rilievo premi «Correggi questo», scrivi `Togli la cifra`, poi «Riscrivi solo questo passo».
   Atteso: la bozza torna senza la frase sul budget; il resto è com'era; la rilettura dice «Può uscire: nessun punto contestabile trovato.»
   Dimostra: a chi scrive arriva il passo da riscrivere, il rilievo, ciò che hai chiesto e l'ordine di lasciare il resto parola per parola.

4. **Fissa il tu.** «Impostazioni» → «Persone e calendario» → «Aggiungi una persona»: `Carla Bianchi`, parte «Cliente», «Tu / lei» → `tu`. Salva.
   ```bash
   grep -A1 "Carla Bianchi" .tmp/demo-70/Aurora/_octo/progetto/persone-e-calendario.md
   ```
   Atteso: sotto la persona, «Il PM gli o le dà del tu.»

5. **Scrivi di nuovo l'email.** «Deliverable» → «Nuovo deliverable» → «Email al cliente», gli stessi dati senza `#inventa`.
   Atteso: la bozza comincia con «Ciao Carla,».
   Dimostra: l'ordine è la parola del PM sulla persona, poi le mail che il PM le ha già mandato, poi il lei. Nelle istruzioni del tipo «Email al cliente» il registro formale non è più scritto fisso.

## Che cosa non fa
- Con Claude finto non si vede il secondo gradino (il registro preso dalle mail già mandate): è un'istruzione a chi scrive, da provare con Claude vero (R6c.8 in `docs/verifiche-da-fare.md`).
- «Riscrivi solo questo passo» è una richiesta di modifica con un perimetro: è Claude a lasciare intatto il resto. La rilettura critica riparte sulla bozza nuova.

## Verifica automatica
```bash
pnpm e2e:esiti
```
