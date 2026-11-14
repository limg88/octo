# Octo

App desktop per i Project Manager, su Windows e Mac. Un progetto è una cartella del computer: Octo la legge con Claude, sul seat del PM, e risponde alle domande citando i file. Ogni citazione viene poi controllata dal codice, una per una.

Octo nasce dalla revisione delle versioni precedenti (Suite su Claude Code, octobrief, octobrief-next, octobrief-new): le decisioni e la roadmap sono in [docs/roadmap.md](docs/roadmap.md).

> Il repository non contiene dati di clienti. I dati delle demo sono sintetici.

## Avvio rapido
Requisiti: Node 24, pnpm 12, Claude Code installato e con l'accesso fatto (`claude` dal terminale, una volta).

```bash
pnpm install
pnpm dev          # compila e apre l'app
```

## Struttura
```
packages/
  domain/          regole pure: risposta, citazioni e loro controllo, progetto
  application/     casi d'uso e porte: fare una domanda, gestire i progetti
  infrastructure/  adattatori: Claude Code da riga di comando, lettura dei file citati, stato dell'app in JSON
apps/
  desktop/         app Electron: processo principale (composition root), preload, interfaccia React
demo/              una demo per ogni fetta (run.sh + COPIONE.md)
e2e/               controllo della finestra vera con Playwright
```
Le dipendenze puntano solo verso l'interno: `domain` ← `application` ← `infrastructure` ← `apps`. La regola è verificata da `pnpm lint`.

## Come Octo usa Claude
- Avvia Claude Code del PM nella cartella del progetto, con i soli strumenti di lettura.
- Claude è in modalità ristretta: non legge fuori dalla cartella, non usa connettori, non carica impostazioni o plugin del computer.
- La domanda passa sullo standard input; la risposta torna in un formato fisso (testo, citazioni, cose non trovate).
- Octo apre ogni file citato e cerca la frase: ciò che non trova resta nella risposta, marcato «da controllare».

Variabili facoltative: `OCTO_CLAUDE_PATH` (percorso di Claude Code), `OCTO_DATA_DIR` (cartella dello stato dell'app), `OCTO_MAIL_ROOT` (un'altra cartella di Mail, per le demo).

## Come Octo alimenta la memoria
- **Posta** (Mac): legge l'archivio di Mail sul computer e scrive nel progetto le mail che lo riguardano, una per file. Le regole si impostano nella scheda «Fonti» e stanno in `.octo/sources.json` nella cartella del progetto.
- La lettura parte su richiesta e ogni 15 minuti ad app aperta.

## Comandi
| Comando | Cosa fa |
|---|---|
| `pnpm dev` | compila e apre l'app |
| `pnpm typecheck` | TypeScript strict su tutto il monorepo |
| `pnpm lint` | Biome e regole di architettura |
| `pnpm test` | test unitari e di integrazione |
| `pnpm test:coverage` | test con soglia di coverage all'80% |
| `pnpm e2e` | compila e segue la demo 01 nella finestra vera, con il modello finto |
| `pnpm dist` | crea l'installatore per il sistema su cui gira |

## Installatori
`pnpm dist` produce in `apps/desktop/release/` un `.dmg` su Mac e un `.exe` su Windows. Su GitHub il flusso «Installatori» li crea entrambi a ogni tag `v*` o su richiesta. Non sono firmati: al primo avvio il sistema chiede conferma.

## Demo
Vedi [demo/README.md](demo/README.md).
