import React, { FunctionComponent, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import ComponentSelectorDialog from '../foundations/ComponentSelector/ComponentSelectorDialog'
import {
    resolveEndpointLabel,
    literalPayloadValue,
    retargetEdgeEndpoint,
    updateEdgePayloadLiteral
} from './areaEditMutations'

export type ExitEdgeRowEditorProps = {
    edge: StandardExitEdge
    onUpdate: (edge: StandardExitEdge) => void
    onDelete: () => void
    disabled?: boolean
    d4Error?: boolean
}

export const ExitEdgeRowEditor: FunctionComponent<ExitEdgeRowEditorProps> = ({
    edge,
    onUpdate,
    onDelete,
    disabled = false,
    d4Error = false
}) => {
    const { standardForm } = useWorkbenchAsset()
    const [selectorOpen, setSelectorOpen] = React.useState(false)
    const [selectorEndpoint, setSelectorEndpoint] = React.useState<'from' | 'to'>('from')

    const fromLabel = useMemo(
        () => resolveEndpointLabel(edge, 'from', standardForm),
        [edge, standardForm]
    )
    const toLabel = useMemo(
        () => resolveEndpointLabel(edge, 'to', standardForm),
        [edge, standardForm]
    )
    const forwardValue = useMemo(() => literalPayloadValue(edge, 'forward'), [edge])
    const backValue = useMemo(() => literalPayloadValue(edge, 'back'), [edge])

    const openSelector = useCallback(
        (endpoint: 'from' | 'to') => {
            if (disabled) {
                return
            }
            setSelectorEndpoint(endpoint)
            setSelectorOpen(true)
        },
        [disabled]
    )

    const handleEndpointSelect = useCallback(
        (universalKey: ComponentUUID) => {
            onUpdate(retargetEdgeEndpoint(edge, selectorEndpoint, universalKey))
            setSelectorOpen(false)
        },
        [edge, onUpdate, selectorEndpoint]
    )

    const handleForwardChange = useCallback(
        (value: string) => {
            onUpdate(updateEdgePayloadLiteral(edge, 'forward', value))
        },
        [edge, onUpdate]
    )

    const handleBackChange = useCallback(
        (value: string) => {
            onUpdate(updateEdgePayloadLiteral(edge, 'back', value))
        },
        [edge, onUpdate]
    )

    return (
        <Box
            sx={{
                border: d4Error ? '1px solid #f44336' : '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '8px',
                backgroundColor: 'white',
                p: 1.5
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    uuid: {edge.uuid}
                </Typography>
                <IconButton
                    edge="end"
                    aria-label="delete exit edge"
                    onClick={onDelete}
                    disabled={disabled}
                    color="error"
                    size="small"
                >
                    <DeleteIcon />
                </IconButton>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => openSelector('from')}
                    disabled={disabled}
                    sx={{ textTransform: 'none', maxWidth: 200 }}
                >
                    From: {fromLabel}
                </Button>
                <Typography variant="body2" color="text.secondary">
                    &rarr;
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => openSelector('to')}
                    disabled={disabled}
                    sx={{ textTransform: 'none', maxWidth: 200 }}
                >
                    To: {toLabel}
                </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <TextField
                    label="Forward"
                    value={forwardValue}
                    onChange={(e) => handleForwardChange(e.target.value)}
                    disabled={disabled}
                    size="small"
                    sx={{ flex: '1 1 140px', minWidth: 120 }}
                />
                <TextField
                    label="Back"
                    value={backValue}
                    onChange={(e) => handleBackChange(e.target.value)}
                    disabled={disabled}
                    size="small"
                    sx={{ flex: '1 1 140px', minWidth: 120 }}
                />
            </Box>
            {d4Error && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    At least one endpoint must be in Participants.
                </Typography>
            )}
            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag="Room"
                onSelect={handleEndpointSelect}
            />
        </Box>
    )
}

export default ExitEdgeRowEditor
