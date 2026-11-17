# Demo 54 — Le sezioni seguono il tipo di progetto

Durata: 3 minuti. Mostra che un progetto a corpo con un solo tracker non si trova più davanti sezioni pensate per un altro tipo di progetto: «Allineamento» non compare quando non ci sono due tracker da allineare, e «Avanzamento» non chiede il modulo Excel del cliente e le posizioni dell'ordine ma mostra che cosa dice NetSuite di ordinato e fatturato.

## Prerequisiti
- Node 24, pnpm 12.
- Docker acceso: il NetSuite finto è un database del Postgres di prova (lo script lancia `pnpm db:setup`).
- Nessun accesso a Claude o a NetSuite veri. Progetto sintetico «Aurora», una sola commessa a corpo (`PRJ000101`, 7.500), NetSuite collegato, nessun tracker del cliente. Acconto del 30% già fatturato, 70% dei ricavi riconosciuto.

## Passi

1. **Avvia la demo.**
   ```bash
   bash demo/54-navigazione-per-tipo/run.sh
   ```

2. **Guarda la barra a sinistra.**
   Atteso: «Oggi» · «Chiedi», «Deliverable», «Cruscotto» · «Ore», «Previsionale», «Avanzamento» · «Impostazioni». Il gruppo «Ogni sprint» con «Allineamento» non c'è.
   Dimostra: l'allineamento confronta le voci del tracker del cliente con i ticket del proprio Jira. Con un solo tracker, o nessuno, non c'è niente da allineare e la sezione non viene offerta.

3. **Apri «Avanzamento».**
   Atteso: la frase «Questo progetto è venduto a corpo: non ha un modulo del cliente da compilare né posizioni d'ordine da ripartire. …» e la tabella:
   | Commessa | Ordinato | Fatturato | Da fatturare | Ricavi riconosciuti |
   |---|---|---|---|---|
   | PRJ000101 Assessment Aurora | 7.500,00 | 2.250,00 (30%) | 5.250,00 (70%) | 5.250,00 (70%) |

   Dimostra: prima questa pagina chiedeva il modulo Excel del cliente, la mappa delle celle e le posizioni dell'ordine, cioè la richiesta di SAL di un progetto a giornate; l'acconto già fatturato non aveva un posto dove comparire.

4. **Premi «Apri «Previsionale»».**
   Atteso: la scheda «Commessa» con costi e margini della stessa commessa (demo 48).

5. **Torna ad «Avanzamento» e premi «Ho un modulo del cliente da compilare».**
   Atteso: compare l'impostazione del modulo, come per un progetto a giornate.
   Dimostra: niente è tolto: un corpo che ha davvero un modulo del cliente lo imposta con un clic, e da quel momento la pagina è quella delle richieste.

## Che cosa dimostra
- «Allineamento» compare quando Jira sta accanto a un tracker del cliente (Azure DevOps collegato, o un'esportazione tenuta a mano), e resta per chi lo usa già (uno sprint scelto).
- «Avanzamento» a corpo vale quando tutte le commesse del progetto sono a corpo e il modulo del cliente non è impostato. Per DEEM, a giornate, non cambia nulla.

## Che cosa non fa
- Non elenca le singole fatture: mostra i totali che NetSuite dà per ordine (fatturato) e per backlog (riconosciuto).

## Test
```bash
pnpm vitest run packages/domain/test/project-shape.test.ts packages/application/test/project-shape.test.ts apps/desktop/test/app.test.tsx apps/desktop/test/progress.test.tsx
```
