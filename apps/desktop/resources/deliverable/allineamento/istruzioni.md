# Allineamento fra il tracker del cliente e il tracker interno

Che cosa produce: `mancanti_<sprint>.csv`, i ticket da creare nel tracker interno (da importare a mano), e `allineamento.md`, con le voci dello sprint divise in tre liste: con ticket nello sprint, con ticket altrove, senza ticket.

Dove stanno i dati: in `config.json`, accanto a questo file.
- `sprint`: lo sprint confrontato, come lo chiamano i due tracker.
- `period`: il periodo di pianificazione delle voci del cliente (vuoto: qualunque).
- `tags`: i tag che dicono quali voci del cliente sono nostre (nessuno: tutte).
- `referencePrefixes`: che cosa precede l'id di una voce nel titolo di un ticket, per esempio `[AZDO 123]`.
- `stateGroups`: stati dei due tracker che vogliono dire la stessa cosa.
- `typeMap`: il tipo di una voce e il tipo che prende il suo ticket.

Da dove legge: le voci del cliente e i ticket interni li prepara Octo (`ingressi/voci.json`, `ingressi/ticket.json`), con gli stessi lettori del Cruscotto. Quale esportazione e quale cartella sono scritti in `deliverable.json`, alla voce `inputs`; vuoti: l'esportazione del Cruscotto e la cartella della fonte Jira.

Regole, da non cambiare senza dirlo al PM:
- una voce e un ticket sono collegati se la voce ha fra i tag la chiave del ticket, altrimenti se il titolo del ticket nomina l'id della voce dopo un prefisso; mai per somiglianza dei titoli;
- ogni voce dello sprint sta in una sola delle tre liste, e la somma è controllata;
- nel file di import la priorità resta vuota: la decide il team.

Octo non scrive in nessuno dei due tracker.

Attenzione: `mancanti_<sprint>.csv` è fatto per essere importato nel tracker interno, non per essere aperto in un foglio di calcolo. Titoli e descrizioni vengono dal tracker del cliente così come sono: un testo che comincia con `=`, `+`, `-` o `@` in un foglio di calcolo può essere letto come una formula. Non viene modificato, perché una descrizione che comincia con un trattino è un elenco, e nel tracker deve restare tale.
