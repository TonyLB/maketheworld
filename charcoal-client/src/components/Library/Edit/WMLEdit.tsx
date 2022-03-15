import React, { FunctionComponent, useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { BaseEditor, Descendant, createEditor, Editor, Node, Range } from 'slate'
import { ReactEditor, Slate, Editable, withReact } from 'slate-react'

import {
    Box
} from '@mui/material'

import {
    getWMLQuery
} from '../../../slices/personalAssets'
import { WMLQuery } from '../../../wml/wmlQuery'

interface WMLEditProps {
    AssetId: string;
}

type CustomElement = { type: 'paragraph'; children: CustomText[] }
type CustomText = { text: string }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: CustomText
  }
}

type SlateUnit = 'character' | 'word' | 'line' | 'block'

const withWMLUpdate = (wmlQuery: WMLQuery | undefined, debouncedUpdate: () => void) => (editor: Editor) => {
    if (wmlQuery) {
        const { insertText, insertNode, insertFragment, deleteBackward, deleteForward, deleteFragment } = editor

        editor.insertText = (text: string) => {
            if (editor?.selection) {
                const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
                wmlQuery('').replaceInputRange(startIdx, endIdx, text)
            }
            insertText(text)
            debouncedUpdate()
        }
        editor.insertBreak = () => {
            if (editor?.selection) {
                const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
                wmlQuery('').replaceInputRange(startIdx, endIdx, '\n')
            }
            insertText('\n')
            debouncedUpdate()
        }
        editor.insertNode = (node) => {
            const text = Node.string(node)
            if (editor?.selection) {
                const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
                wmlQuery('').replaceInputRange(startIdx, endIdx, text)
            }
            insertNode(node)
            debouncedUpdate()
        }
        editor.insertFragment = (nodes) => {
            const text = nodes.map((n) => (Node.string(n))).join('')
            if (editor?.selection) {
                const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
                wmlQuery('').replaceInputRange(startIdx, endIdx, text)
            }
            insertFragment(nodes)
            debouncedUpdate()
        }
        editor.deleteBackward = (unit: SlateUnit) => {
            if (editor?.selection) {
                const [{ offset: endIdx }] = Range.edges(editor.selection)
                const { offset: startIdx = endIdx } = Editor.before(editor, editor.selection.anchor, { distance: 1, unit }) || {}
                wmlQuery('').replaceInputRange(startIdx, endIdx, '')
            }
            deleteBackward(unit)
            debouncedUpdate()
        }
        editor.deleteForward = (unit: SlateUnit) => {
            if (editor?.selection) {
                const [{ offset: startIdx }] = Range.edges(editor.selection)
                const { offset: endIdx = startIdx } = Editor.after(editor, editor.selection.anchor, { distance: 1, unit }) || {}
                wmlQuery('').replaceInputRange(startIdx, endIdx, '')
            }
            deleteForward(unit)
            debouncedUpdate()
        }
        editor.deleteFragment = () => {
            if (editor?.selection) {
                const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
                wmlQuery('').replaceInputRange(startIdx, endIdx, '')
            }
            deleteFragment()
            debouncedUpdate()
        }
    }
    return editor
}

export const WMLEdit: FunctionComponent<WMLEditProps> = ({ AssetId }) => {
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const initialValue: CustomElement[] = [{
        type: 'paragraph',
        children: [{ text: wmlQuery?.('').source() || '' }]
    }]
    const [debounceMoment, setDebounce] = useState<number>(Date.now())
    let debounceTimeout: ReturnType<typeof setTimeout>
    const debouncedUpdate = () => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout)
        }
        debounceTimeout = setTimeout(() => { setDebounce(Date.now()) }, 1000)
    }
    const generateStatusMessage = useCallback(() => {
        if (wmlQuery) {
            const match = wmlQuery('').matcher().match()
            if (match.succeeded()) {
                return 'Success!'
            }
            return `Failure at (${(match as any).getRightmostFailurePosition()}): ${match.shortMessage}`
        }
        return 'WMLQuery initiating'
    }, [wmlQuery])
    const [statusMessage, setStatusMessage] = useState<string>('')
    useEffect(() => {
        setStatusMessage(generateStatusMessage())
    }, [debounceMoment, setStatusMessage, generateStatusMessage])
    const [editor] = useState(() => withWMLUpdate(wmlQuery, debouncedUpdate)(withReact(createEditor())))
    const [value, setValue] = useState<Descendant[]>(initialValue)
    return <Box sx={{ height: "100%", width: "100%" }}>
        <Box sx={{ margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em" }}>
            <Slate
                editor={editor}
                value={value}
                onChange={newValue => setValue(newValue)}
            >
                <Editable {...({ spellCheck: "false" } as any)} />
            </Slate>
        </Box>
        {/* { JSON.stringify(wmlQuery?.('').source() || '') } */}
        <Box>
            { statusMessage }
        </Box>
    </Box>
}

export default WMLEdit
