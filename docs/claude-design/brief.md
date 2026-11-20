# Brief per Claude Design

Da incollare come primo messaggio, con gli allegati elencati in `README.md`. Le parti fra parentesi quadre sono da scegliere prima di inviare.

---

Voglio rivedere l'interfaccia di **Octo**, un'app desktop (Electron + React) per Project Manager di una società di consulenza. Ti allego le schermate di oggi in tema chiaro e scuro, il foglio di stile e una scheda dello stile.

## Il prodotto

Un progetto è una cartella del computer. Octo la legge con Claude e:

- **Oggi** — la pagina del mattino: riunioni, mail a cui rispondere, criticità della settimana, cose da fare, ognuna con la sua fonte.
- **Chiedi** — una chat sul progetto; ogni frase della risposta ha un richiamo numerato a una fonte, controllato dal codice.
- **Deliverable** — testi e file che escono dal progetto (stato di avanzamento, verbale, stima, email al cliente…), scritti da Claude, riletti criticamente, approvati dal PM.
- **Cruscotto** — bug, sprint e andamento letti dal tracker (Azure DevOps o Jira).
- **Commessa** — ogni mese: ordinato, fatturato, costi, margine, ore, previsionale. Documento interno.
- **Impostazioni** — fonti collegate, persone e calendario, carta intestata, quale Claude lavora.

Chi lo usa: un PM, da solo, sul suo computer, più volte al giorno, spesso fra una riunione e l'altra. Legge molto, scrive poco. Deve potersi fidare: di ogni cifra e di ogni frase deve vedere da dove viene.

## Che cosa ti chiedo

[Scegli una riga o riscrivila.]

- **A. Revisione critica.** Guarda le schermate e dimmi, sezione per sezione, che cosa ostacola: gerarchia, densità, coerenza fra sezioni, stati poco leggibili. Poi proponi la versione rivista delle [tre] schermate dove il guadagno è maggiore.
- **B. Una sezione a fondo.** Ridisegna [Oggi], in chiaro e in scuro, a 1280×860 e a 900×600, con gli stati: pieno, vuoto, in lettura, errore.
- **C. Sistema.** Dai componenti che vedi ricava un sistema coerente (pulsanti, schede, riquadri con cifra, tabelle, etichette, avvisi, elenco con dettaglio) e mostra dove oggi l'app se ne discosta.

## Vincoli

1. **È una revisione, non un prodotto nuovo.** Parti dai token allegati (`stile.md`, `styles.css`). Puoi proporre di cambiarli, ma dichiarandolo: token, valore di oggi, valore proposto, perché.
2. **Chiaro e scuro insieme.** Ogni proposta nei due temi, con contrasto del testo almeno 4,5:1 e del bordo dei campi almeno 3:1.
3. **Il colore ha un significato solo.** Viola = azione principale e selezione; blu = fonte; ambra = da verificare; verde = confermato; rosso = errore. I fondi restano neutri.
4. **Un solo pulsante pieno per contesto.**
5. **Nella prima schermata il risultato o l'azione frequente.** Impostazioni e dettagli occupano meno spazio del risultato.
6. **Una riga per elemento** finché non si apre un dettaglio; se serve scorrere in orizzontale scorre solo la tabella.
7. **Misure a destra, cifre tabulari.**
8. **Ogni stato ha un testo**, non solo un colore o un'icona.
9. **Parole dell'interfaccia in italiano, quelle di oggi.** Se cambi un'etichetta, segnalalo.
10. **Niente icone decorative né illustrazioni.** Oggi l'app ne ha pochissime, per scelta.
11. **Si può togliere o rinominare.** Se due schermate dicono la stessa cosa, proponi di unirle: un posto solo per ogni cosa.

## Da non toccare

- Il raggruppamento della colonna di sinistra per frequenza d'uso (Ogni giorno / Lavoro / Ogni mese / Progetto) e il badge di «Oggi».
- Il richiamo numerato con la fonte a fianco della risposta, in «Chiedi» e nei deliverable.
- I file approvati in cima al documento.
- L'avviso «Documento interno» in «Commessa».
- La distinzione fra ciò che calcola Octo e ciò che valuta Claude.

## Come voglio il risultato

- Tavole affiancate **prima / dopo** per ogni schermata toccata, nei due temi.
- Per ogni modifica una riga: che cosa cambia, perché, quale vincolo qui sopra applica.
- Alla fine un **elenco di consegna per lo sviluppo**: token cambiati (nome, valore), componenti cambiati (nome di oggi, che cosa cambia), schermate toccate. Lo passerò a Claude Code, che modifica `styles.css` e i componenti React: servono nomi e valori, non descrizioni.
- I dati nelle tavole restano quelli delle schermate (progetto di prova «Aurora»): nessun nome di cliente reale.
