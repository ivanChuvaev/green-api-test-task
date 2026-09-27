import { baseKeymap, splitBlock } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState, Selection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { useEffect, useImperativeHandle, useRef, type MouseEvent, type Ref } from 'react'
import {
  createEmptyDoc,
  createPlainTextSlice,
  plainTextSchema,
  readPlainText,
} from './plainTextSchema'
import styles from './MessageEditor.module.scss'

export interface MessageEditorHandle {
  clear: () => void
  restore: (text: string) => void
  focus: () => void
}

interface MessageEditorProps {
  placeholder: string
  onChange: (text: string) => void
  onSubmit: () => void
  ref?: Ref<MessageEditorHandle>
}

export const MessageEditor = ({ placeholder, onChange, onSubmit, ref }: MessageEditorProps) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)

  useEffect(() => {
    onChangeRef.current = onChange
    onSubmitRef.current = onSubmit
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let view: EditorView
    const state = EditorState.create({
      schema: plainTextSchema,
      doc: createEmptyDoc(),
      plugins: [
        keymap({
          Enter: () => {
            onSubmitRef.current()
            return true
          },
          'Shift-Enter': splitBlock,
          'Mod-z': undo,
          'Shift-Mod-z': redo,
          'Mod-y': redo,
        }),
        keymap(baseKeymap),
        history(),
      ],
    })

    view = new EditorView(host, {
      state,
      attributes: { class: styles.editor, role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (target, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (!text) return false
        event.preventDefault()
        target.dispatch(target.state.tr.replaceSelection(createPlainTextSlice(text)))
        return true
      },
      dispatchTransaction: (transaction) => {
        const next = view.state.apply(transaction)
        view.updateState(next)
        if (transaction.docChanged) onChangeRef.current(readPlainText(next.doc))
      },
    })

    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    clear: () => {
      const view = viewRef.current
      if (!view) return
      view.dispatch(view.state.tr.delete(0, view.state.doc.content.size))
      view.focus()
    },
    restore: (text) => {
      const view = viewRef.current
      if (!view || readPlainText(view.state.doc) !== '') return
      const tr = view.state.tr.replace(0, view.state.doc.content.size, createPlainTextSlice(text))
      view.dispatch(tr.setSelection(Selection.atEnd(tr.doc)))
    },
    focus: () => viewRef.current?.focus(),
  }))

  useEffect(() => {
    viewRef.current?.dom.setAttribute('aria-label', placeholder)
  }, [placeholder])

  const focusFromWrapper = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    viewRef.current?.focus()
  }

  return <div ref={hostRef} className={styles.editorHost} onMouseDown={focusFromWrapper} />
}
