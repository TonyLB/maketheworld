import React, { FunctionComponent, useState, useEffect, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Descendant, createEditor, Editor, Range, Point } from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact } from 'slate-react'

import {
    Box
} from '@mui/material'

import wmlToSlate, { indexToSlatePoint, sourceStringFromSlate } from './wmlToSlate'
import { setDraftWML, setIntent, getError, getStatus } from '../../../slices/personalAssets'

import LibraryBanner from './LibraryBanner'
import { useLibraryAsset } from './LibraryAsset'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

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

const decorateWithError = ({ editor, errorRange }: { editor: Editor; errorRange: Range | undefined }) => ([node, path]: [node: Descendant, path: number[]]): Decoration[] => {
    if (errorRange) {
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
    return []
}

export const WMLEdit: FunctionComponent<WMLEditProps> = () => {
    const { AssetId, assetKey, currentWML, draftWML } = useLibraryAsset()
    const dispatch = useDispatch()

    const [debounceMoment, setDebounce] = useState<number>(Date.now())
    const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
    const debouncedUpdate = useCallback(() => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout)
        }
        setDebounceTimeout(setTimeout(() => { setDebounce(Date.now()) }, 1000))
    }, [debounceTimeout, setDebounceTimeout])
    const { error, errorStart } = useSelector(getError(AssetId)) as { error?: string, errorStart?: number; errorEnd?: number }
    const currentStatus = useSelector(getStatus(AssetId))
    const statusMessage = useMemo<string>(() => {
        if (currentStatus === 'DRAFTERROR') {
            return `Failure at (${errorStart}): ${error}`
        }
        else {
            return 'Success!'
        }
    }, [currentStatus, error, errorStart])
    const errorPosition = useMemo<Point | undefined>(() => {
        if (currentStatus !== 'DRAFTERROR' || typeof errorStart === 'undefined') {
            return undefined
        }
        else {
            return indexToSlatePoint(draftWML || currentWML, errorStart)
        }    
    }, [errorStart, draftWML, currentWML, currentStatus])
    const value = useMemo<Descendant[]>(() => (wmlToSlate(draftWML || currentWML)), [draftWML, currentWML])
    const [lastDebounceMoment, setLastDebounceMoment] = useState<number>(0)
    const [editor] = useState(() => withHistory(withReact(createEditor())))
    useEffect(() => {
        dispatch(setIntent({ key: AssetId, intent: ['WMLDIRTY', 'DRAFTERROR', 'FRESH'] }))
        dispatch(heartbeat)
    }, [])
    useEffect(() => {
        if (debounceMoment !== lastDebounceMoment) {
            if (draftWML) {
                dispatch(setIntent({ key: AssetId, intent: ['NEEDPARSE'] }))
                dispatch(heartbeat)
            }
            setLastDebounceMoment(debounceMoment)
        }
    }, [debounceMoment, lastDebounceMoment, dispatch, draftWML])
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
        console.log(`Handle Change`)
        const draftValue = sourceStringFromSlate(newValue)
        if (draftValue !== sourceStringFromSlate(value)) {
            debouncedUpdate()
        }
        dispatch(setDraftWML(AssetId)({ value: draftValue }))
    }, [value, debouncedUpdate, dispatch, AssetId])
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    return <Box sx={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        <LibraryBanner
            primary="Edit World Markup Language"
            secondary={assetKey}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/${ (AssetId.split('#')?.[0] || '') === 'CHARACTER' ? 'Character' : 'Asset' }/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: 'Edit WML'
            }]}
        />
        <Box sx={{ margin: "0.25em", padding: "0.5em",  border: "1px solid", borderRadius: "0.5em", display: "flex", flexGrow: 1, overflow: "auto" }}>
            <Slate
                editor={editor}
                value={value}
                onChange={handleChange}
            >
                <Editable
                    {...({ spellCheck: "false" } as any)}
                    decorate={decorate}
                    renderLeaf={renderLeaf}
                    style={{ overflow: "visible" }}
                />
            </Slate>
        </Box>
        <Box>
            { statusMessage }
        </Box>
    </Box>
}

export default WMLEdit
