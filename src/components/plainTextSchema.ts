import { Fragment, Schema, Slice, type Node as ProseMirrorNode } from 'prosemirror-model'

export const plainTextSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'text*',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: {},
  },
})

export const createEmptyDoc = () => {
  const doc = plainTextSchema.topNodeType.createAndFill()
  if (!doc) throw new Error('The plain text schema cannot create an empty document')
  return doc
}

export const readPlainText = (doc: ProseMirrorNode) => {
  const lines: string[] = []
  doc.forEach((paragraph) => lines.push(paragraph.textContent))
  return lines.join('\n')
}

export const createPlainTextSlice = (text: string) => {
  const { paragraph } = plainTextSchema.nodes
  const nodes = text
    .split('\n')
    .map((line) => paragraph.create(null, line ? plainTextSchema.text(line) : null))
  return new Slice(Fragment.fromArray(nodes), 0, 0)
}
