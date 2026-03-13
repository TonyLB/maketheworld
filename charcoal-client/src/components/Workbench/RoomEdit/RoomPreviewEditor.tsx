import React, { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Button,
    TextField,
    Typography,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { getPerspective } from '../../../slices/personalAssets'
import { socketDispatchPromise } from '../../../slices/lifeLine'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { situationIdToLabel, situationMarksToMarkState } from '../../../lib/situationLabel'
import { renderTreeToPlainText } from '../foundations/renderTreeToPlainText'
import { buildGenerationContextSubset } from '../../../lib/buildGenerationContextSubset'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

type RoomPreviewEditorProps = {
    roomId: ComponentUUID
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
    const [selectedSituationId, setSelectedSituationId] = useState<ComponentUUID | ''>('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<PreviewResult>(null)

    const situationOptions = useMemo(() => {
        if (!room || room.situations.length === 0) return []
        return room.situations.items
            .map((facet) => {
                const id = facet.reference?.universalKey as ComponentUUID | undefined
                if (!id) return null
                return { id, label: situationIdToLabel(id, standardForm) }
            })
            .filter((x): x is { id: ComponentUUID; label: string } => x !== null)
    }, [room, standardForm])

    const canUseManualMarks = Boolean(singleLens && marks.length > 0)
    const canUseSituations = situationOptions.length > 0
    const canGenerate =
        (canUseSituations && (selectedSituationId || situationOptions[0]?.id)) ||
        (canUseManualMarks && !selectedSituationId)

    const perspective = useSelector((state) => getPerspective(state, AssetId, roomId))
    const assetStack = useMemo(() => {
        const inherited = (inheritedByAssetId || []).map(({ assetId }) => assetId)
        return perspective?.assetStack ?? [...inherited, AssetId]
    }, [perspective?.assetStack, inheritedByAssetId, AssetId])

    const handleMarkChange = useCallback((markId: string, value: string) => {
        setMarkValues((prev) => ({ ...prev, [markId]: value }))
    }, [])

    const handleGenerate = useCallback(() => {
        if (!roomId || !room) return
        let markState: { markValue: { mark: string; value: string }[] }
        const situationIdToUse = selectedSituationId || (canUseSituations && !canUseManualMarks ? situationOptions[0]?.id : null)
        if (situationIdToUse && canUseSituations) {
            const situation = standardForm.byUniversalId[situationIdToUse]
            if (situation && situation instanceof StandardSituation) {
                markState = situationMarksToMarkState(situation)
            } else {
                return
            }
        } else if (canUseManualMarks) {
            markState = {
                markValue: marks.map((m) => ({
                    mark: m.universalKey!,
                    value: markValues[m.universalKey!] ?? ''
                }))
            }
        } else {
            return
        }
        setLoading(true)
        setResult(null)
        // Expedient client-supplied context for generation (Ephemera caching plan item 1).
        const subsetForm = buildGenerationContextSubset(standardForm, room.standardKey)
        const generationContextWml = schemaToWML([subsetForm.schema])
        const promise = dispatch(
            socketDispatchPromise(
                {
                    message: 'generateRoomPreview',
                    RoomId: roomId as EphemeraRoomId,
                    markState,
                    assetStack,
                    ...(generationContextWml && { generationContextWml })
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
    }, [dispatch, roomId, room, marks, markValues, assetStack, selectedSituationId, canUseSituations, canUseManualMarks, standardForm, situationOptions])

    if (!room) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">Room not found.</Typography>
            </Box>
        )
    }

    if (!canUseSituations && !canUseManualMarks) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">
                    Add Situations to this Room or a Lens with Marks to use Preview.
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Preview</Typography>
            <Typography variant="body2" color="text.secondary">
                {canUseSituations && canUseManualMarks
                    ? 'Choose a Situation or enter Mark values manually, then click Generate.'
                    : canUseSituations
                        ? 'Choose a Situation and click Generate to see cached rendered content.'
                        : 'Enter a value for each Mark and click Generate to see cached rendered content for that state.'}
            </Typography>

            {canUseSituations && (
                <FormControl size="small" fullWidth>
                    <InputLabel id="preview-situation-label">Preview by situation</InputLabel>
                    <Select
                        labelId="preview-situation-label"
                        value={selectedSituationId || (canUseManualMarks ? 'manual' : situationOptions[0]?.id ?? '')}
                        label="Preview by situation"
                        onChange={(e) => setSelectedSituationId(e.target.value === 'manual' ? '' : (e.target.value as ComponentUUID))}
                    >
                        {canUseManualMarks && (
                            <MenuItem value="manual">Manual (Lens marks)</MenuItem>
                        )}
                        {situationOptions.map(({ id, label }) => (
                            <MenuItem key={id} value={id}>
                                {label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {canUseManualMarks && !selectedSituationId && (
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
            )}

            <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={loading || !canGenerate}
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
