// A synthetic deck, shaped like one a PM reuses period after period: a cover, slides of content
// with a title and a table, speaker notes, sections, and a closing slide without a title.
import { strToU8, zipSync } from 'fflate'

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const NS = `${A} ${R} ${P}`
const RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const TYPE = 'application/vnd.openxmlformats-officedocument.presentationml'
export const DECK_TABLE_STYLE = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}'
export const DECK_TABLE_PLACE = '<a:off x="400000" y="1500000"/><a:ext cx="11000000" cy="3000000"/>'

const TREE_START =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const holder = (id: number, type: string, text: string, place = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Segnaposto ${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${type}"/></p:nvPr></p:nvSpPr><p:spPr>${place}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="it-IT" dirty="0"><a:latin typeface="Georgia"/></a:rPr><a:t>${text}</a:t></a:r><a:endParaRPr lang="it-IT"/></a:p></p:txBody></p:sp>`
const box = (id: number, text: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Testo ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="3000000" y="2600000"/><a:ext cx="6000000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="it-IT" sz="4000" b="1"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Tabella 3"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${DECK_TABLE_PLACE}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${DECK_TABLE_STYLE}</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="11000000"/></a:tblGrid><a:tr h="370840"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="it-IT"/><a:t>Dato del periodo scorso</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
const filled = (colour: string) =>
  `<a:tcPr><a:solidFill><a:srgbClr val="${colour}"/></a:solidFill></a:tcPr>`
const cellOf = (text: string, look: string, size = 1100) =>
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/>${text === '' ? '' : `<a:r><a:rPr lang="it-IT" sz="${size}"/><a:t>${text}</a:t></a:r>`}<a:endParaRPr lang="it-IT" sz="${size}"/></a:p></a:txBody>${look}</a:tc>`
const rowOf = (cells: string[], look: string) =>
  `<a:tr h="300000">${cells.map((text) => cellOf(text, look)).join('')}</a:tr>`
export const DECK_GREEN = 'D4EDDA'
export const DECK_BLUE = 'DDEBF7'
/** A table as a status deck has it: headings, rows coloured by their status, a total at the end. */
const richTable = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Tabella 3"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${DECK_TABLE_PLACE}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${DECK_TABLE_STYLE}</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="6000000"/><a:gridCol w="3000000"/><a:gridCol w="2000000"/></a:tblGrid>${rowOf(['Voce', 'Stato', 'Cons. 23/10'], '<a:tcPr/>')}${rowOf(['Modulo ordini', '✅ Done', '12'], filled(DECK_GREEN))}${rowOf(['Magazzino', '🔄 In corso', ''], filled(DECK_BLUE))}${rowOf(['Totale', '', '12'], filled('EEEEEE'))}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
const numberOfSlide =
  '<p:sp><p:nvSpPr><p:cNvPr id="9" name="Numero"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="it-IT"/><a:t>2</a:t></a:fld></a:p></p:txBody></p:sp>'
const slide = (shapes: string) =>
  `${HEAD}<p:sld ${NS}><p:cSld><p:spTree>${TREE_START}${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
const rels = (...entries: string[]) =>
  `${HEAD}<Relationships ${RELS}>${entries.join('')}</Relationships>`
const rel = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="${OFFICE}/${type}" Target="${target}"/>`
const TITLE_PLACE =
  '<a:xfrm><a:off x="400000" y="300000"/><a:ext cx="11000000" cy="900000"/></a:xfrm>'
const FONT = '<a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/>'
const FILL = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
const LINE = `<a:ln w="9525">${FILL}</a:ln>`
const EFFECT = '<a:effectStyle><a:effectLst/></a:effectStyle>'
const colour = (name: string, value: string) => `<a:${name}><a:srgbClr val="${value}"/></a:${name}>`
const THEME = `${HEAD}<a:theme ${A} name="Aurora"><a:themeElements><a:clrScheme name="Aurora">${colour('dk1', '000000')}${colour('lt1', 'FFFFFF')}${colour('dk2', '1F3864')}${colour('lt2', 'E7E6E6')}${colour('accent1', '1F3864')}${colour('accent2', 'ED7D31')}${colour('accent3', 'A5A5A5')}${colour('accent4', 'FFC000')}${colour('accent5', '5B9BD5')}${colour('accent6', '70AD47')}${colour('hlink', '0563C1')}${colour('folHlink', '954F72')}</a:clrScheme><a:fontScheme name="Aurora"><a:majorFont>${FONT}</a:majorFont><a:minorFont>${FONT}</a:minorFont></a:fontScheme><a:fmtScheme name="Aurora"><a:fillStyleLst>${FILL.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${LINE.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${EFFECT.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${FILL.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`
const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F4F6FA"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${TREE_START}${holder(2, 'title', 'Titolo', TITLE_PLACE)}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200" b="1"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`
const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="titleOnly"><p:cSld name="Solo titolo"><p:spTree>${TREE_START}${holder(2, 'title', 'Titolo')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`

export type DeckOptions = {
  /** A cover with a title to fill, instead of plain text boxes. */
  coverTitle?: boolean
  /** No table in the slides of content. */
  plain?: boolean
  /** No closing slide: the deck ends with a slide of content. */
  open?: boolean
  /**
   * The first slide of content as a status deck has it: a table with headings, coloured rows and
   * a total, a line that dates the data, a tile written on two lines, and the number of the slide.
   */
  rich?: boolean
}

/** Slides: 1 cover, 2 and 3 content of another period (2 has speaker notes), 4 closing. */
export function deckPptx(options: DeckOptions = {}): Uint8Array {
  const cover = options.coverTitle
    ? holder(2, 'ctrTitle', 'Titolo del periodo scorso', TITLE_PLACE)
    : box(2, 'Progetto Aurora')
  const content = (title: string) =>
    slide(
      `${holder(2, 'title', title)}${options.plain ? box(3, 'Testo del periodo scorso') : table}`,
    )
  const numbers = options.open ? [1, 2, 3] : [1, 2, 3, 4]
  const layout = rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')
  const files: Record<string, string> = {
    '[Content_Types].xml': `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="${TYPE}.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${TYPE}.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${TYPE}.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="${TYPE}.notesSlide+xml"/>${numbers.map((n) => `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${TYPE}.slide+xml"/>`).join('')}</Types>`,
    '_rels/.rels': rels(rel('rId1', 'officeDocument', 'ppt/presentation.xml')),
    'ppt/presentation.xml': `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${numbers.map((n) => `<p:sldId id="${255 + n}" r:id="rId${n + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/><p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p14:section name="Periodo" id="{11111111-2222-3333-4444-555555555555}"><p14:sldIdLst>${numbers.map((n) => `<p14:sldId id="${255 + n}"/>`).join('')}</p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels(
      rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'),
      ...numbers.map((n) => rel(`rId${n + 1}`, 'slide', `slides/slide${n}.xml`)),
      rel('rId9', 'theme', 'theme/theme1.xml'),
    ),
    'ppt/theme/theme1.xml': THEME,
    'ppt/slideMasters/slideMaster1.xml': MASTER,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels(
      rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'),
      rel('rId2', 'theme', '../theme/theme1.xml'),
    ),
    'ppt/slideLayouts/slideLayout1.xml': LAYOUT,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': rels(
      rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'),
    ),
    'ppt/slides/slide1.xml': slide(cover),
    'ppt/slides/_rels/slide1.xml.rels': rels(layout),
    'ppt/slides/slide2.xml': options.rich
      ? slide(
          `${holder(2, 'title', 'Aurora - Avanzamento — PI6')}${richTable}${box(5, 'Dati al 23/10/2026')}${box(6, 'Consegne</a:t></a:r><a:br/><a:r><a:rPr lang="it-IT" sz="4000" b="1"/><a:t>3 &amp; mezzo')}${numberOfSlide}`,
        )
      : content('Avanzamento del periodo scorso'),
    'ppt/slides/_rels/slide2.xml.rels': rels(
      layout,
      rel('rId2', 'notesSlide', '../notesSlides/notesSlide1.xml'),
    ),
    'ppt/notesSlides/notesSlide1.xml': `${HEAD}<p:notes ${NS}><p:cSld><p:spTree>${TREE_START}</p:spTree></p:cSld></p:notes>`,
    'ppt/notesSlides/_rels/notesSlide1.xml.rels': rels(
      rel('rId1', 'slide', '../slides/slide2.xml'),
    ),
    'ppt/slides/slide3.xml': content('Rischi del periodo scorso'),
    'ppt/slides/_rels/slide3.xml.rels': rels(layout),
  }
  if (!options.open) {
    files['ppt/slides/slide4.xml'] = slide(box(2, 'GRAZIE'))
    files['ppt/slides/_rels/slide4.xml.rels'] = rels(layout)
  }
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)])),
  )
}
