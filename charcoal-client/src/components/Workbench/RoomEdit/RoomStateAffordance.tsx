import React, { FunctionComponent, useMemo, useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { useDispatch } from 'react-redux'

import { MakeTheWorldAccordion } from '../../UI'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardMark, { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isEphemeraCacheMarkState } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { sendRoomEphemeraStateChange } from './ephemeraStateChange'

type RoomStateAffordanceProps = {
    RoomId: ComponentUUID
}

type LensMarkControl = {
    mark: string
    label: string
}

const markLabel = ({
    markComponent,
    fallbackMark,
}: {
    markComponent: StandardMark | undefined
    fallbackMark: string
}): string => {
    const shortName = markComponent?.shortName?._payload?.plain?.toJSON()
    if (typeof shortName === 'string' && shortName.trim().length) {
        return shortName
    }
    return fallbackMark
}

export const RoomStateAffordance: FunctionComponent<RoomStateAffordanceProps> = ({ RoomId }) => {
    const dispatch = useDispatch()
    const { standardForm, readonly } = useWorkbenchAsset()

    const room = useMemo(() => {
        const component = standardForm.byUniversalId[RoomId]
        if (component instanceof StandardRoom) {
            return component
        }
        return undefined
    }, [RoomId, standardForm])

    const lens = useMemo(() => {
        const lensRefs = room?.lens.payload ?? []
        if (lensRefs.length !== 1) {
            return undefined
        }
        const lensRef = lensRefs[0]
        if (!lensRef?.universalKey) {
            return undefined
        }
        const component = standardForm.byUniversalId[lensRef.universalKey]
        if (component instanceof StandardLens) {
            return component
        }
        return undefined
    }, [room, standardForm])

    const markControls = useMemo<LensMarkControl[]>(() => {
        if (!lens) {
            return []
        }
        return lens.marks.items
            .map((markFacet) => {
                const markId = markFacet.reference.universalKey
                if (!markId) {
                    return undefined
                }
                const markComponent = standardForm.byUniversalId[markId]
                const fallbackMark = markFacet.reference.key ?? markId
                return {
                    mark: fallbackMark,
                    label: markLabel({
                        markComponent: markComponent instanceof StandardMark ? markComponent : undefined,
                        fallbackMark,
                    }),
                }
            })
            .filter((entry): entry is LensMarkControl => Boolean(entry))
    }, [lens, standardForm])

    const [valuesByMark, setValuesByMark] = useState<Record<string, string>>({})
    const [statusMessage, setStatusMessage] = useState<{ severity: 'success' | 'error'; message: string } | null>(null)
    const [pending, setPending] = useState(false)

    const hasLens = Boolean(lens)
    const hasMarks = markControls.length > 0

    const handleSubmit = async () => {
        const markValue = markControls.map(({ mark }) => ({
            mark,
            value: valuesByMark[mark] ?? '',
        }))
        const markState = { markValue }
        if (!isEphemeraCacheMarkState(markState)) {
            setStatusMessage({
                severity: 'error',
                message: 'Unable to send room-state update: invalid mark payload.',
            })
            return
        }
        setPending(true)
        setStatusMessage(null)
        try {
            const result = await dispatch(sendRoomEphemeraStateChange({
                componentId: RoomId,
                markState,
            }) as any)
            if (result?.ok) {
                setStatusMessage({ severity: 'success', message: result.message })
            }
            else {
                setStatusMessage({ severity: 'error', message: result?.message ?? 'Failed to update runtime room state.' })
            }
        }
        finally {
            setPending(false)
        }
    }

    return (
        <MakeTheWorldAccordion title="Advanced" defaultExpanded={false}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Runtime Room state
                </Typography>
                {!room && (
                    <Alert severity="warning">Room not found for runtime state affordance.</Alert>
                )}
                {room && !hasLens && (
                    <Alert severity="info">
                        This Room has no Lens, so there are no runtime marks to edit.
                    </Alert>
                )}
                {room && hasLens && !hasMarks && (
                    <Alert severity="info">
                        This Lens has no marks, so there are no runtime values to submit.
                    </Alert>
                )}
                {room && hasLens && hasMarks && (
                    <>
                        {markControls.map(({ mark, label }) => (
                            <TextField
                                key={mark}
                                label={label}
                                value={valuesByMark[mark] ?? ''}
                                onChange={({ target }) => {
                                    const value = target.value
                                    setValuesByMark((previous) => ({ ...previous, [mark]: value }))
                                }}
                                size="small"
                                fullWidth
                            />
                        ))}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                onClick={handleSubmit}
                                disabled={readonly || pending}
                            >
                                {pending ? 'Submitting...' : 'Apply runtime state'}
                            </Button>
                        </Box>
                    </>
                )}
                {statusMessage && (
                    <Alert severity={statusMessage.severity}>
                        {statusMessage.message}
                    </Alert>
                )}
            </Box>
        </MakeTheWorldAccordion>
    )
}

export default RoomStateAffordance
