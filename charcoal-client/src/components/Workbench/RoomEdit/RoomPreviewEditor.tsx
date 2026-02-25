import React, { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import {
    Box,
    Button,
    TextField,
    Typography,
    CircularProgress,
    Alert
} from '@mui/material'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { socketDispatchPromise } from '../../../slices/lifeLine'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { isSchemaString } from '@tonylb/mtw-base/ts/schema/renderTree'

type RoomPreviewEditorProps = {
    roomId: ComponentUUID
}

/** Flatten RenderTree-like (or API JSON) to plain text for display. */
function renderTreeToPlainText(tree: unknown): string {
    if (!tree || !Array.isArray(tree) || tree.length === 0) return ''
    return tree
        .map((item: unknown) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object' && 'data' in item) {
                const data = (item as { data?: unknown }).data
                if (data && typeof data === 'object' && isSchemaString(data)) {
                    return (data as { value: string }).value
                }
                const children = (item as { children?: unknown[] }).children
                if (Array.isArray(children) && children.length > 0) {
                    return children.filter((c): c is string => typeof c === 'string').join('')
                }
            }
            return ''
        })
        .filter(Boolean)
        .join(' ')
        .trim()
}

type PreviewResult =
    | { success: true; renderedContent: { displayName?: unknown; summary?: unknown; description: unknown } }
    | { success: false; errorCode: string; errorMessage: string }
    | null

/**
 * Preview view for a Room: propose Mark state, generate, and see cached rendered content or error.
 * Navigated into from the Room editor via synthetic breadcrumb id `preview:${roomId}`.
 */
export const RoomPreviewEditor: FunctionComponent<RoomPreviewEditorProps> = ({ roomId }) => {
    const dispatch = useDispatch()
    const { standardForm, inheritedByAssetId, AssetId } = useWorkbenchAsset()

    const room = useMemo(() => {
        const c = standardForm.byUniversalId[roomId]
        if (c && c instanceof StandardRoom) return c
        return null
    }, [roomId, standardForm])

    const singleLens = useMemo(() => {
        if (!room) return null
        const lensRefs = room.lenses.payload || []
        if (lensRefs.length !== 1) return null
        const ref = lensRefs[0]
        if (!ref?.universalKey) return null
        const c = standardForm.byUniversalId[ref.universalKey]
        if (c && c instanceof StandardLens) return c
        return null
    }, [room, standardForm])

    const marks = useMemo(() => {
        if (!singleLens) return []
        return singleLens.marks.payload
            .map((ref) => {
                if (!ref.universalKey) return null
                const component = standardForm.byUniversalId[ref.universalKey]
                if (component && component instanceof StandardMark) return component
                return null
            })
            .filter((mark): mark is StandardMark => mark !== null)
    }, [singleLens, standardForm])

    const [markValues, setMarkValues] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<PreviewResult>(null)

    const assetStack = useMemo(() => {
        const inherited = (inheritedByAssetId || []).map(({ assetId }) => assetId)
        return [...inherited, AssetId]
    }, [inheritedByAssetId, AssetId])

    const handleMarkChange = useCallback((markId: string, value: string) => {
        setMarkValues((prev) => ({ ...prev, [markId]: value }))
    }, [])

    const handleGenerate = useCallback(() => {
        if (!roomId || marks.length === 0) return
        setLoading(true)
        setResult(null)
        const markState = {
            markValue: marks.map((m) => ({
                mark: m.universalKey!,
                value: markValues[m.universalKey!] ?? ''
            }))
        }
        const promise = dispatch(
            socketDispatchPromise(
                {
                    message: 'generateRoomPreview',
                    RoomId: roomId as EphemeraRoomId,
                    markState,
                    assetStack
                },
                { service: 'ephemera' }
            )
        ) as unknown as Promise<{ generateRoomPreview?: PreviewResult }>
        promise
            .then((payload) => {
                const r = payload?.generateRoomPreview ?? null
                if (r && typeof r === 'object' && 'success' in r) {
                    setResult(r as PreviewResult)
                } else {
                    setResult({ success: false, errorCode: 'UNKNOWN', errorMessage: 'Invalid response' })
                }
            })
            .catch(() => {
                setResult({ success: false, errorCode: 'REQUEST_FAILED', errorMessage: 'Request failed' })
            })
            .finally(() => setLoading(false))
    }, [dispatch, roomId, marks, markValues, assetStack])

    if (!room) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Room not found.</Typography>
            </Box>
        )
    }

    if (!singleLens || marks.length === 0) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Add a Lens with Marks to use Preview.</Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Preview</Typography>
            <Typography variant="body2" color="text.secondary">
                Enter a value for each Mark and click Generate to see cached rendered content for that state.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {marks.map((mark) => {
                    const label = mark.shortName?._payload?.plain?.toJSON()
                    const shortName = typeof label === 'string' && label.trim() ? label : 'Untitled'
                    const markId = mark.universalKey!
                    return (
                        <TextField
                            key={markId}
                            label={shortName}
                            size="small"
                            value={markValues[markId] ?? ''}
                            onChange={(e) => handleMarkChange(markId, e.target.value)}
                            placeholder="Match value"
                            fullWidth
                            variant="outlined"
                        />
                    )
                })}
            </Box>

            <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
                {loading ? 'Generating...' : 'Generate'}
            </Button>

            {result && (
                <Box sx={{ mt: 1 }}>
                    {result.success ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {result.renderedContent.displayName !== undefined && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Display name</Typography>
                                    <Typography variant="body2">{renderTreeToPlainText(result.renderedContent.displayName)}</Typography>
                                </Box>
                            )}
                            {result.renderedContent.summary !== undefined && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Summary</Typography>
                                    <Typography variant="body2">{renderTreeToPlainText(result.renderedContent.summary)}</Typography>
                                </Box>
                            )}
                            <Box>
                                <Typography variant="caption" color="text.secondary">Description</Typography>
                                <Typography variant="body2">{renderTreeToPlainText(result.renderedContent.description)}</Typography>
                            </Box>
                        </Box>
                    ) : (
                        <Alert severity="error">
                            {result.errorMessage}
                            {result.errorCode && result.errorCode !== 'NO_EXACT_MATCH' && ` (${result.errorCode})`}
                        </Alert>
                    )}
                </Box>
            )}
        </Box>
    )
}

export default RoomPreviewEditor
