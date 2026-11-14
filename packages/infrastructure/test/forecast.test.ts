import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SheetWrite } from '@octo/application'
import { DEFAULT_FORECAST_SETTINGS, NO_ROW_INPUTS, readForecastModel } from '@octo/domain'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFsForecastSettings, createXlsxModel } from '../src/index.ts'
import { forecastModelXlsx } from './support/forecast-xlsx.ts'

const sheets = createXlsxModel()
const model = forecastModelXlsx([
  { client: 'Cliente & Figli', code: 'P1', description: 'Sviluppo', ordered: 100000 },
  { client: 'Cliente Due', code: 'P2', description: 'Assistenza', ordered: null },
])
const SHEET = 'xl/worksheets/sheet1.xml'
const partsOf = (bytes: Uint8Array) =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, part]) => [name, strFromU8(part)]),
  )

describe('a spreadsheet model', () => {
  it('reads the first sheet with its shared strings', () => {
    const grid = sheets.read(model)
    expect(grid.rows).toHaveLength(3)
    expect(grid.rows[1]?.cells).toEqual([
      { ref: 'A2', text: 'Cliente & Figli' },
      { ref: 'B2', text: 'P1' },
      { ref: 'C2', text: 'Sviluppo' },
      { ref: 'D2', text: '100000' },
    ])
    const reading = readForecastModel(grid)
    expect(reading.ok && reading.model.columns.note).toBe('L')
  })

  it('rewrites the cells named and leaves the rest of the file as it was', () => {
    const writes: SheetWrite[] = [
      { ref: 'E2', cell: { kind: 'formula', formula: '1.5*200', value: 300 } },
      { ref: 'G2', cell: { kind: 'number', value: 600.5 } },
      { ref: 'I2', cell: { kind: 'formula', formula: 'IFERROR((G2-E2-F2)/G2,"")', value: null } },
      { ref: 'J2', cell: { kind: 'empty' } },
      { ref: 'L2', cell: { kind: 'text', value: 'costi < ricavi & note\u0001' } },
      { ref: 'I3', cell: { kind: 'formula', formula: 'G3-E3', value: 0.1 + 0.2 } },
    ]
    const before = partsOf(model)
    const after = partsOf(sheets.fill(model, writes))
    const sheet = after[SHEET] ?? ''
    expect(sheet).toContain('<c r="E2" s="2"><f>1.5*200</f><v>300</v></c>')
    expect(sheet).toContain('<c r="G2" s="2"><v>600.5</v></c>')
    expect(sheet).toContain('<c r="I2" s="3" t="str"><f>IFERROR((G2-E2-F2)/G2,"")</f><v></v></c>')
    expect(sheet).toContain('<c r="J2" s="3"/>')
    expect(sheet).toContain(
      '<c r="K2" s="2"/><c r="L2" t="inlineStr"><is><t xml:space="preserve">costi &lt; ricavi &amp; note</t></is></c></row>',
    )
    expect(sheet).toContain('<c r="I3" s="3"><f>G3-E3</f><v>0.3</v></c>')
    expect(sheet).not.toContain('#DIV/0!</v></c><c r="J2"')
    // The cells nobody named are the model's, the stale error of the other row included.
    expect(sheet).toContain('<c r="F2" s="2"/>')
    expect(sheet).toContain('<row r="1" ht="60" customHeight="1">')
    expect(sheet).toContain('<pageMargins left="0.7"')
    for (const part of ['xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet2.xml']) {
      expect(after[part]).toBe(before[part])
    }
    expect(after['xl/calcChain.xml']).toBeUndefined()
    expect(after['[Content_Types].xml']).not.toContain('calcChain')
    expect(after['xl/_rels/workbook.xml.rels']).not.toContain('calcChain')
    expect(after['xl/workbook.xml']).toContain('</sheets><calcPr fullCalcOnLoad="1"/></workbook>')
    // What was written reads back.
    const filled = sheets.read(sheets.fill(model, writes))
    expect(filled.rows[1]?.cells.find((cell) => cell.ref === 'E2')?.text).toBe('300')
    expect(filled.rows[1]?.cells.at(-1)).toEqual({ ref: 'L2', text: 'costi < ricavi & note' })
  })

  it('adds a missing cell in its place and asks Excel to compute when the workbook did not say', () => {
    const parts = unzipSync(model)
    const bare = strFromU8(parts['xl/workbook.xml'] as Uint8Array).replace(/<calcPr[^>]*\/>/, '')
    const sheet = strFromU8(parts[SHEET] as Uint8Array).replace('<c r="E2" s="2"/>', '')
    const other = zipSync({ ...parts, 'xl/workbook.xml': strToU8(bare), [SHEET]: strToU8(sheet) })
    const after = partsOf(sheets.fill(other, [{ ref: 'E2', cell: { kind: 'number', value: 1 } }]))
    expect(after[SHEET]).toContain('<v>100000</v></c><c r="E2"><v>1</v></c><c r="F2" s="2"/>')
    expect(after['xl/workbook.xml']).toContain('</sheets><calcPr fullCalcOnLoad="1"/>')
  })

  it('shows a share as a percentage with the look the cell had, adding that look once', () => {
    const share = (ref: string): SheetWrite => ({
      ref,
      cell: { kind: 'formula', formula: '(E2+F2)/8000', value: 0.1, percent: true },
    })
    const after = partsOf(sheets.fill(model, [share('H2'), share('H3'), share('G3'), share('L3')]))
    const sheet = after[SHEET] ?? ''
    expect(sheet).toContain('<c r="H2" s="4"><f>(E2+F2)/8000</f><v>0.1</v></c>')
    expect(sheet).toContain('<c r="H3" s="4">')
    expect(sheet).toContain('<c r="G3" s="5">')
    expect(sheet).toContain('<c r="L3" s="4">')
    expect(after['xl/styles.xml']).toContain(
      '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    )
    expect(after['xl/styles.xml']).toContain(
      '<xf fontId="0" fillId="0" borderId="0" xfId="0" numFmtId="10" applyNumberFormat="1"/><xf fontId="0" fillId="0" borderId="0" xfId="0" numFmtId="10" applyNumberFormat="1"/></cellXfs>',
    )
    // A workbook without styles keeps the cell as it is.
    const { 'xl/styles.xml': _styles, ...bare } = unzipSync(model)
    const plain = partsOf(sheets.fill(zipSync(bare), [share('H2')]))
    expect(plain[SHEET]).toContain('<c r="H2" s="0"><f>')
  })

  it('refuses a file that is not a spreadsheet, or a row the sheet lacks', () => {
    expect(() => sheets.read(strToU8('not a zip'))).toThrow('forecast_model_invalid')
    expect(() => sheets.read(zipSync({ 'word/document.xml': strToU8('<w:document/>') }))).toThrow(
      'forecast_model_invalid',
    )
    const write: SheetWrite = { ref: 'E9', cell: { kind: 'number', value: 1 } }
    expect(() => sheets.fill(model, [write])).toThrow('forecast_model_invalid')
  })
})

describe('the settings of the forecast on disk', () => {
  let folder: string
  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'octo-forecast-'))
  })
  afterAll(() => rm(folder, { recursive: true, force: true }))

  it('start empty, come back as saved and refuse a file that is not settings', async () => {
    const store = createFsForecastSettings()
    expect(await store.load(folder)).toEqual(DEFAULT_FORECAST_SETTINGS)
    const settings = {
      ...DEFAULT_FORECAST_SETTINGS,
      modelPath: 'modello.xlsx',
      rates: [{ person: 'Rossi Mario', costPerDay: 200, ratePerDay: null }],
      months: { '2026-06': { P1: { ...NO_ROW_INPUTS, toInvoice: 100 } } },
    }
    await store.save(folder, settings)
    expect(await store.load(folder)).toEqual(settings)
    const file = join(folder, '_octo', '.impostazioni', 'forecast.json')
    expect(JSON.parse(await readFile(file, 'utf8')).modelPath).toBe('modello.xlsx')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, JSON.stringify({ rates: 'none' }))
    await expect(store.load(folder)).rejects.toThrow('forecast_settings_invalid')
  })
})
