// A synthetic model of the monthly forecast, shaped like one Excel saved: shared strings, styles,
// a stale error where a margin goes, a calculation chain and a second sheet nobody fills.
import { strToU8, zipSync } from 'fflate'

export type ModelLine = {
  client: string
  code: string
  description: string
  ordered: number | null
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
const RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const COLUMNS = 'ABCDEFGHIJKL'
const STYLE = { text: 0, heading: 1, money: 2, share: 3 }

export const modelHeadings = (month: string): string[] => [
  'Cliente',
  'Cod. prog. Netsuite',
  'Descrizione',
  'Ordinato',
  `Previsione costi interni ${month}`,
  `Previsione costi esterni ${month}`,
  `Previsione ricavi ${month}`,
  'N. gg/€ se T&M o % se PROGCORPO',
  `Previsionale marginalità ${month}`,
  'Previsionale marginalità a fine progetto',
  `Importo da fatturare ${month}`,
  'Note su ricavi e fatturazione',
]

const xmlText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export function forecastModelXlsx(lines: readonly ModelLine[], month = 'giugno 2026'): Uint8Array {
  const strings: string[] = []
  const shared = (text: string): number => {
    const known = strings.indexOf(text)
    return known >= 0 ? known : strings.push(text) - 1
  }
  const written = (ref: string, text: string, style: number) =>
    `<c r="${ref}" s="${style}" t="s"><v>${shared(text)}</v></c>`
  const header = modelHeadings(month)
    .map((text, index) => written(`${COLUMNS[index]}1`, text, STYLE.heading))
    .join('')
  const rows = lines.map((line, index) => {
    const n = index + 2
    return [
      `<row r="${n}">`,
      written(`A${n}`, line.client, STYLE.text),
      written(`B${n}`, line.code, STYLE.text),
      written(`C${n}`, line.description, STYLE.text),
      line.ordered === null
        ? `<c r="D${n}" s="${STYLE.money}"/>`
        : `<c r="D${n}" s="${STYLE.money}"><v>${line.ordered}</v></c>`,
      `<c r="E${n}" s="${STYLE.money}"/><c r="F${n}" s="${STYLE.money}"/>`,
      `<c r="G${n}" s="${STYLE.money}"/><c r="H${n}" s="${STYLE.text}"/>`,
      // What the administration's file carries: an error left by a formula long gone.
      `<c r="I${n}" s="${STYLE.share}" t="e"><v>#DIV/0!</v></c>`,
      `<c r="J${n}" s="${STYLE.share}"/><c r="K${n}" s="${STYLE.money}"/>`,
      // No cell for the note: the row ends before it.
      '</row>',
    ].join('')
  })
  const sheet = `${HEAD}<worksheet ${MAIN}><sheetData><row r="1" ht="60" customHeight="1">${header}</row>${rows.join('')}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
  const other = `${HEAD}<worksheet ${MAIN}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Istruzioni</t></is></c></row></sheetData></worksheet>`
  const files: Record<string, string> = {
    '[Content_Types].xml': `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>`,
    '_rels/.rels': `${HEAD}<Relationships ${RELS}><Relationship Id="rId1" Type="${OFFICE}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${HEAD}<workbook ${MAIN} xmlns:r="${OFFICE}"><sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/><sheet name="Istruzioni" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `${HEAD}<Relationships ${RELS}><Relationship Id="rId1" Type="${OFFICE}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${OFFICE}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${OFFICE}/styles" Target="styles.xml"/><Relationship Id="rId4" Type="${OFFICE}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId5" Type="${OFFICE}/calcChain" Target="calcChain.xml"/></Relationships>`,
    'xl/styles.xml': `${HEAD}<styleSheet ${MAIN}><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    'xl/calcChain.xml': `${HEAD}<calcChain ${MAIN}><c r="I2" i="1"/></calcChain>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/worksheets/sheet2.xml': other,
  }
  files['xl/sharedStrings.xml'] =
    `${HEAD}<sst ${MAIN} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((text) => `<si><t>${xmlText(text)}</t></si>`).join('')}</sst>`
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])),
  )
}
