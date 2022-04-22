import React, { FunctionComponent, useState, useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Descendant, createEditor, Editor, Node, Range, Text, Point } from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import {
    Box
} from '@mui/material'

import { WMLQuery, WMLQueryUpdate } from '../../../wml/wmlQuery'
import wmlQueryToSlate, { indexToSlatePoint, sourceStringFromSlate } from './wmlQueryToSlate'
import { setDraftWML } from '../../../slices/personalAssets'
import { CustomText } from './baseClasses'

import LibraryBanner from './LibraryBanner'
import { useLibraryAsset } from './LibraryAsset'

interface WMLEditProps {}

type SlateUnit = 'character' | 'word' | 'line' | 'block'
type Decoration = Range & { error: boolean }

const Leaf = ({ attributes, children, leaf }: { attributes: any, children: any, leaf: any }) => {
    return (
        <span
            {...attributes}
            style={{ backgroundColor: leaf.error && '#ffeeba' }}
        >
            {children}
        </span>
    )
}

// const withWMLUpdate = (wmlQueryRef: { current: WMLQuery | undefined }, debouncedUpdate: () => void) => (editor: Editor) => {
//     if (wmlQueryRef.current) {
//         const { insertText, insertNode, insertFragment, deleteBackward, deleteForward, deleteFragment } = editor

//         editor.insertText = (text: string) => {
//             console.log(`InsertText: ${text}`)
//             if (editor?.selection) {
//                 console.log(`Operations: ${JSON.stringify(editor.operations, null, 4)}`)
//                 console.log(`Editor Selection: ${JSON.stringify(editor.selection, null, 4)}`)
//                 console.log(`IsCollapsed: ${Range.isCollapsed(editor.selection)}`)
//                 const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, text)
//             }
//             insertText(text)
//             debouncedUpdate()
//         }
//         editor.insertBreak = () => {
//             console.log(`InsertBreak`)
//             if (editor?.selection) {
//                 const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, '\n')
//             }
//             insertText('\n')
//             debouncedUpdate()
//         }
//         editor.insertNode = (node) => {
//             console.log(`InsertNode: ${JSON.stringify(Node, null, 4)}`)
//             const text = Node.string(node)
//             if (editor?.selection) {
//                 const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, text)
//             }
//             insertNode(node)
//             debouncedUpdate()
//         }
//         editor.insertFragment = (nodes) => {
//             console.log(`InsertFragment: ${JSON.stringify(nodes, null, 4)}`)
//             const text = nodes.map((n) => (Node.string(n))).join('')
//             if (editor?.selection) {
//                 const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, text)
//             }
//             insertFragment(nodes)
//             debouncedUpdate()
//         }
//         editor.deleteBackward = (unit: SlateUnit) => {
//             console.log(`DeleteBackward: ${JSON.stringify(unit)}`)
//             if (editor?.selection) {
//                 const [{ offset: endIdx }] = Range.edges(editor.selection)
//                 const { offset: startIdx = endIdx } = Editor.before(editor, editor.selection.anchor, { distance: 1, unit }) || {}
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, '')
//             }
//             deleteBackward(unit)
//             debouncedUpdate()
//         }
//         editor.deleteForward = (unit: SlateUnit) => {
//             console.log(`DeleteForward: ${JSON.stringify(unit)}`)
//             if (editor?.selection) {
//                 const [{ offset: startIdx }] = Range.edges(editor.selection)
//                 const { offset: endIdx = startIdx } = Editor.after(editor, editor.selection.anchor, { distance: 1, unit }) || {}
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, '')
//             }
//             deleteForward(unit)
//             debouncedUpdate()
//         }
//         editor.deleteFragment = () => {
//             console.log(`DeleteFragment`)
//             if (editor?.selection) {
//                 const [{ offset: startIdx }, { offset: endIdx }] = Range.edges(editor.selection)
//                 wmlQueryRef.current?.('')?.replaceInputRange?.(startIdx, endIdx, '')
//             }
//             deleteFragment()
//             debouncedUpdate()
//         }
//     }
//     return editor
// }

const decorateWithError = ({ editor, errorRange }: { editor: Editor; errorRange: Range | undefined }) => ([node, path]: [node: Descendant, path: number[]]): Decoration[] => {
    if (errorRange === undefined) {
        return []
    }
    if (Text.isText(node)) {
        const intersection = Range.intersection(errorRange, Editor.range(editor, path))

        if (intersection == null) {
            return []
        }

        const range = {
            error: true,
            ...intersection
        }
        return [range]
    }
    else {
        return (node.children as CustomText[])
            .reduce((previous: Decoration[], child: CustomText, index: number) => ([
                ...previous,
                ...decorateWithError({
                    editor,
                    errorRange
                })([child, [...path, index]])
            ]), [] as Decoration[])
    }
}

const generateErrorPosition = (wmlQuery: WMLQuery, value: Descendant[]): Point | undefined => {
    wmlQuery.setInput(sourceStringFromSlate(value))
    const match = wmlQuery.matcher.match()
    if (match.succeeded()) {
        return undefined
    }
    const failurePosition: number = (match as any).getRightmostFailurePosition()
    return indexToSlatePoint(wmlQuery, failurePosition)
}

export const WMLEdit: FunctionComponent<WMLEditProps> = () => {
    const { AssetId, assetKey, currentWML, updateWML } = useLibraryAsset()
    const dispatch = useDispatch()
    const onChange = (change: WMLQueryUpdate) => {
        const match = change.wmlQuery.matcher.match()
        if (match.succeeded()) {
            updateWML(change.wmlQuery.source)
        }
        else {
            dispatch(setDraftWML(AssetId)({ value: change.wmlQuery.source }))
        }
    }
    const [wmlQuery] = useState(() => (new WMLQuery(currentWML, { onChange })))

    useEffect(() => {
        if (wmlQuery.source !== currentWML) {
            wmlQuery.setInput(currentWML)
        }
    }, [currentWML])
    const initialValue = wmlQueryToSlate(wmlQuery)
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
            const match = wmlQuery.matcher.match()
            if (match.succeeded()) {
                return 'Success!'
            }
            return `Failure at (${(match as any).getRightmostFailurePosition()}): ${match.shortMessage}`
        }
        return 'WMLQuery initiating'
    }, [wmlQuery])
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [errorPosition, setErrorPosition] = useState<Point | undefined>()
    const [value, setValue] = useState<Descendant[]>(initialValue)
    const [lastDebounceMoment, setLastDebounceMoment] = useState<number>(0)
    useEffect(() => {
        if (debounceMoment !== lastDebounceMoment) {
            setErrorPosition(generateErrorPosition(wmlQuery, value))
            setStatusMessage(generateStatusMessage())
            setLastDebounceMoment(debounceMoment)
        }
    }, [debounceMoment, lastDebounceMoment, wmlQuery, value, setStatusMessage, generateStatusMessage, setErrorPosition])
    const [editor] = useState(() => withHistory(withReact(createEditor() as ReactEditor)))
    const decorate = useCallback(
        ([node, path]) => {
            const endPosition = Editor.end(editor, [])
            const returnValue = decorateWithError({
                editor,
                errorRange: errorPosition
                    ? {
                        anchor: errorPosition,
                        focus: endPosition
                    }
                    : undefined
            })([node, path])
            return returnValue
        },
        [editor, errorPosition]
    )
    const handleChange = useCallback(newValue => {
        if (sourceStringFromSlate(newValue) !== sourceStringFromSlate(value)) {
            debouncedUpdate()
        }
        setValue(newValue)
    }, [value])
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    return <Box sx={{ height: "100%", width: "100%" }}>
        <LibraryBanner
            primary="Edit World Markup Language"
            secondary={assetKey}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/Asset/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: 'Edit WML'
            }]}
        />
        <Box sx={{ margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em" }}>
            <Slate
                editor={editor}
                value={value}
                onChange={handleChange}
            >
                <Editable
                    {...({ spellCheck: "false" } as any)}
                    decorate={decorate}
                    renderLeaf={renderLeaf}
                />
            </Slate>
        </Box>
        {/* { currentWML }
        <br/>
        { JSON.stringify(wmlQuery?.source || '') } */}
        <Box>
            { statusMessage }
        </Box>
    </Box>
}

export default WMLEdit
