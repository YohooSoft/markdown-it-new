import { strToU8, zipSync } from 'fflate'

export const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
export const slideNs = 'http://schemas.openxmlformats.org/presentationml/2006/main'
export const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships'

function pack (parts) {
  return zipSync({ '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'), ...Object.fromEntries(Object.entries(parts).map(([path, value]) => [path, typeof value === 'string' ? strToU8(value) : value])) })
}

export function workbookFixture (extra = {}) {
  return pack({
    'xl/workbook.xml': `<workbook xmlns="${sheetNs}" xmlns:r="${rel}"><sheets><sheet name="预算" sheetId="1" r:id="r1"/><sheet name="Other" sheetId="2" r:id="r2"/></sheets><extLst/></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${packageRel}"><Relationship Id="r1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="${rel}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="strings" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<sst xmlns="${sheetNs}"><si><t>Shared</t></si></sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${sheetNs}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row><row r="2"><c r="A2" s="1"><v>12.5</v></c><c r="B2" t="inlineStr"><is><t>Text</t></is></c><c r="C2" t="b"><v>1</v></c><c r="D2"><f>SUM(A2,A3)</f><v>22.5</v></c></row><row r="3"><c r="A3"><v>10</v></c><c r="E3"><f t="array" ref="E3:F4">TRANSPOSE(A2:A3)</f><v>12.5</v></c><c r="F3"><v>10</v></c></row></sheetData></worksheet>`,
    'xl/worksheets/sheet2.xml': `<worksheet xmlns="${sheetNs}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Second sheet</t></is></c></row></sheetData></worksheet>`,
    'xl/styles.xml': '<styles>original styles</styles>',
    'xl/media/image.png': new Uint8Array([1, 2, 3]),
    ...extra
  })
}

export function slidesFixture (extra = {}) {
  const slide = text => `<p:sld xmlns:p="${slideNs}" xmlns:a="${drawingNs}"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  return pack({
    'ppt/presentation.xml': `<p:presentation xmlns:p="${slideNs}" xmlns:r="${rel}"><p:sldIdLst><p:sldId id="256" r:id="r2"/><p:sldId id="257" r:id="r1"/></p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships xmlns="${packageRel}"><Relationship Id="r1" Type="${rel}/slide" Target="slides/slide1.xml"/><Relationship Id="r2" Type="${rel}/slide" Target="slides/slide2.xml"/></Relationships>`,
    'ppt/slides/slide1.xml': slide('Second displayed slide'),
    'ppt/slides/slide2.xml': slide('First displayed slide'),
    'ppt/media/image.png': new Uint8Array([4, 5, 6]),
    ...extra
  })
}
