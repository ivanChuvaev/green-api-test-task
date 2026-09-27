import { Fragment } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import {
  createEmptyDoc,
  createPlainTextSlice,
  plainTextSchema,
  readPlainText,
} from './plainTextSchema'

const documentOf = (lines: string[]) => {
  const { paragraph } = plainTextSchema.nodes
  return plainTextSchema.topNodeType.create(
    null,
    Fragment.fromArray(
      lines.map((line) => paragraph.create(null, line ? plainTextSchema.text(line) : null)),
    ),
  )
}

describe('plainTextSchema', () => {
  it('creates an empty document with a single empty line', () => {
    const doc = createEmptyDoc()

    expect(doc.childCount).toBe(1)
    expect(readPlainText(doc)).toBe('')
  })

  it('reads the paragraphs as lines joined with a newline', () => {
    expect(readPlainText(documentOf(['строка 1', 'строка 2']))).toBe('строка 1\nстрока 2')
  })

  it('keeps a blank line in the middle of the text', () => {
    expect(readPlainText(documentOf(['a', '', 'b']))).toBe('a\n\nb')
  })

  it('has no marks, so a pasted fragment cannot keep markup', () => {
    const slice = createPlainTextSlice('**жирный**')

    expect(plainTextSchema.marks).toEqual({})
    expect(slice.content.child(0).marks).toEqual([])
  })

  it('turns a string into paragraphs, so a pasted newline becomes a new line', () => {
    const slice = createPlainTextSlice('a\n\nb')

    expect(slice.content.childCount).toBe(3)
    expect(slice.content.child(0).textContent).toBe('a')
    expect(slice.content.child(1).textContent).toBe('')
    expect(slice.content.child(2).textContent).toBe('b')
  })
})
