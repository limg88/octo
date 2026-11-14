// A synthetic progress form, shaped like the one a client sends: labels, merged cells, a table
// of six positions shown as percentages and a block reserved to the client.
import { strToU8, zipSync } from 'fflate'

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const STYLE = { value: 0, label: 1, share: 2 }
export const PROGRESS_FORM_TABLE = { firstRow: 8, rows: 6 }
export const RESERVED_LABEL = 'CONVALIDA (spazio riservato al cliente)'

const label = (ref: string, text: string) =>
  `<c r="${ref}" s="${STYLE.label}" t="inlineStr"><is><t>${text}</t></is></c>`
const blank = (ref: string, style = STYLE.value) => `<c r="${ref}" s="${style}"/>`
const row = (n: number, cells: string[]) => `<row r="${n}">${cells.join('')}</row>`

export function progressFormXlsx(): Uint8Array {
  const table = Array.from({ length: PROGRESS_FORM_TABLE.rows }, (_unused, index) => {
    const n = PROGRESS_FORM_TABLE.firstRow + index
    return row(n, [
      blank(`A${n}`),
      blank(`B${n}`, STYLE.share),
      blank(`C${n}`, STYLE.share),
      blank(`D${n}`, STYLE.share),
    ])
  })
  const rows = [
    row(1, [label('A1', 'STATO D&apos;AVANZAMENTO LAVORI'), label('D1', 'N° PROPOSTA')]),
    row(2, [blank('D2')]),
    row(3, [label('A3', 'FORNITORE'), label('C3', 'NUMERO/POSIZIONE D&apos;ORDINE')]),
    row(4, [blank('A4'), blank('B4'), blank('C4'), blank('D4')]),
    row(6, [
      label('A6', 'POSIZIONE'),
      label('B6', 'PRECEDENTE'),
      label('C6', 'ATTUALE'),
      label('D6', 'DI PERIODO'),
    ]),
    row(7, [blank('A7'), blank('B7'), blank('C7'), label('D7', '(ATTUALE - PRECEDENTE)')]),
    ...table,
    row(15, [label('A15', 'DATA'), label('C15', 'FORNITORE')]),
    row(16, [blank('A16'), blank('C16')]),
    row(18, [label('A18', 'ANNOTAZIONI')]),
    row(19, [blank('A19'), blank('B19'), blank('C19'), blank('D19')]),
    row(21, [label('A21', RESERVED_LABEL)]),
    row(22, [blank('A22'), blank('B22'), blank('C22'), blank('D22')]),
  ]
  const sheet = `${HEAD}<worksheet ${MAIN}><cols><col min="1" max="4" width="28" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="4"><mergeCell ref="A1:C1"/><mergeCell ref="A4:B4"/><mergeCell ref="C4:D4"/><mergeCell ref="A19:D19"/></mergeCells></worksheet>`
  const files: Record<string, string> = {
    '[Content_Types].xml': `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `${HEAD}<Relationships ${RELS}><Relationship Id="rId1" Type="${OFFICE}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${HEAD}<workbook ${MAIN} xmlns:r="${OFFICE}"><sheets><sheet name="Richiesta" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${HEAD}<Relationships ${RELS}><Relationship Id="rId1" Type="${OFFICE}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${OFFICE}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `${HEAD}<styleSheet ${MAIN}><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': sheet,
  }
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])),
  )
}
