# Demo 45 — Riepilogo del cruscotto: «aperti» sono lavorazione più verifica

Durata: 1 minuto. Mostra che il riepilogo in numeri del tracker (`_octo/cruscotto/riepilogo.md`, il testo che Claude cita nei report e in «Chiedi») conta i bug aperti come la scheda «Bug» del cruscotto: i validati in attesa di rilascio non sono più aperti.

## Prerequisiti
- Node 24, pnpm 12.
- Nessun accesso a tracker o a Claude: il tracker è sintetico (progetto «Aurora»), 66 bug di cui 14 in lavorazione, 3 in verifica e 49 validati. Non si apre nessuna finestra e non viene scritto niente.

## Passi

1. **Lancia la demo.**
   ```bash
   bash demo/45-riepilogo-bug-aperti/run.sh
   ```
   Atteso:
   ```
   - Bug nel perimetro: 66
   - Bug aperti (in lavorazione o in verifica): 17
   - Bug in lavorazione: 14
   - Bug in verifica: 3
   - Bug validati, in attesa di rilascio: 49
   - Bug chiusi: 0
   | Tag | Elementi | Bug aperti | Storie |
   | Aurora | 66 | 17 | 0 |

   Scheda «Bug» del cruscotto, aperti: 17
   OK: riepilogo e cruscotto danno lo stesso numero.
   ```
   Dimostra: prima della correzione il riepilogo diceva 66 (tutti i non chiusi) mentre il cruscotto ne mostrava 17. Ora la regola è una sola (`isOpenPhase`), anche nella tabella tag per tag, e la riga dice in chiaro che cosa conta.

2. **Leggi la riga dei validati.**
   Atteso: i 49 validati restano nel riepilogo con la loro riga: non spariscono, non sono più sommati agli aperti.

## Test
```bash
pnpm vitest run packages/domain/test/tracker-summary.test.ts
```
