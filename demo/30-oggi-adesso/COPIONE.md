# Demo 30 — «Adesso»: ciò che viene prima, scelto da una regola

Durata: 4 minuti. Incremento A di `docs/oggi-revisione.md`: il riquadro «Adesso» in cima a «Oggi», requisiti e allineamento solo a fine sprint, la valutazione di Claude in fondo alla pagina.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a Claude né ad altri sistemi: la posta e Claude sono finti. Chi usa Octo è già «Paola Verdi».
- Nel progetto di prova la riunione del giorno comincia **40 minuti dopo l'avvio della demo** e lo sprint «Sprint 28» finisce domani.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/30-oggi-adesso/run.sh
   ```
   Atteso: Octo si apre su «Aurora», sezione «Oggi». Premi «Leggi ora».

2. **Leggi «Adesso».**
   Atteso: sopra «Da fare oggi» un riquadro «Adesso» con al più tre voci, ognuna con il perché davanti al titolo:
   - «Fra 40 minuti» (o poco meno) · «Alle …: Aurora: prova generale del collaudo»;
   - «Lo sprint sta finendo» · «Sprint 28: i due tracker non sono allineati».

   La mail di Carla Bianchi non c'è ancora: entra in «Adesso» come «Mail di importanza alta» appena Claude l'ha valutata (pochi secondi, da sola). Nei primi giorni lavorativi del mese ci sono anche ore e previsionale, con «Si chiudono i numeri del mese»: le voci restano tre, nell'ordine della regola.
   Dimostra: che cosa viene prima lo sceglie il codice, con una regola che si legge sulla voce; nessuna voce è lì «per riempire».

3. **Controlla che non siano ripetute.** Guarda «Da fare oggi» e «Da tenere d'occhio».
   Atteso: le voci di «Adesso» non compaiono una seconda volta sotto. Il numero accanto a «Da fare oggi» conta solo le altre.
   Dimostra: ogni cosa si legge una volta sola.

4. **Agisci su una voce di «Adesso».** Premi la voce dell'allineamento.
   Atteso: a destra il dettaglio, con «Apri «Allineamento»», «Fatto», «Rimanda», «Non mi interessa», come per ogni altra voce. Premi «Rimanda», poi «A domani»: la voce esce da «Adesso».
   Dimostra: «Adesso» non è un riassunto da leggere, è l'inizio dell'elenco.

5. **Guarda dove sta la valutazione di Claude.** Scorri in fondo.
   Atteso: il riquadro «Valutazione di Claude del …» è l'ultimo della pagina, sopra «Impostazioni di «Oggi»», e dichiara: «Con la valutazione delle mail, una volta a settimana, Claude propone anche i rischi del progetto».
   Dimostra: ciò che è giudicato non spezza più la lettura di ciò che è calcolato, e dice tutto ciò che fa.

6. **Requisiti e allineamento lontano dalla fine dello sprint.** Chiudi la finestra e rilancia:
   ```bash
   SPRINT_FAR=1 bash demo/30-oggi-adesso/run.sh
   ```
   Premi «Leggi ora».
   Atteso: né «Sprint 28: i due tracker non sono allineati» né «… requisiti poco chiari» compaiono, in nessuna parte della pagina. In «Cruscotto» e in «Allineamento» i dati ci sono come prima. I bug fermi e l'avviso del tracker vecchio restano.
   Dimostra: ciò che serve a fine sprint non fa rumore per tutto lo sprint.

## Che cosa dimostra, in breve
La pagina dice subito da dove cominciare, con una regola del codice e non con un giudizio; il tracker parla quando serve.

## Test
```bash
pnpm test:coverage
```
