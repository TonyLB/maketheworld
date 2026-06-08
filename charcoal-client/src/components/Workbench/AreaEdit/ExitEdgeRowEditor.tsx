import React, { FunctionComponent, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import ComponentSelectorDialog from '../foundations/ComponentSelector/ComponentSelectorDialog'
import {
    exitEndpointSelectorIsExcluded,
    resolveEndpointLabel,
    literalPayloadValue,
    retargetEdgeEndpoint,
    updateEdgePayloadLiteral
} from './areaEditMutations'

export type ExitEdgeRowEditorProps = {
    area: StandardArea
    edge: StandardExitEdge
    onUpdate: (edge: StandardExitEdge) => void
    onDelete: () => void
    disabled?: boolean
    participantRuleWarning?: boolean
}

export const ExitEdgeRowEditor: FunctionComponent<ExitEdgeRowEditorProps> = ({
    area,
    edge,
    onUpdate,
    onDelete,
    disabled = false,
    participantRuleWarning = false
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

    const selectorIsExcluded = useMemo(
        () => exitEndpointSelectorIsExcluded(area, edge, selectorEndpoint),
        [area, edge, selectorEndpoint]
    )

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
                border: participantRuleWarning ? '1px solid #f44336' : '1px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '8px',
                backgroundColor: 'white',
                p: 1.5
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr auto',
                    gap: 1,
                    alignItems: 'center'
                }}
            >
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => openSelector('from')}
                    disabled={disabled}
                    sx={{ textTransform: 'none', minWidth: 0 }}
                >
                    From: {fromLabel}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                    &harr;
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => openSelector('to')}
                    disabled={disabled}
                    sx={{ textTransform: 'none', minWidth: 0 }}
                >
                    To: {toLabel}
                </Button>
                <IconButton
                    aria-label="delete exit edge"
                    onClick={onDelete}
                    disabled={disabled}
                    color="error"
                    size="small"
                >
                    <DeleteIcon />
                </IconButton>
                <TextField
                    label="Back"
                    value={backValue}
                    onChange={(e) => handleBackChange(e.target.value)}
                    disabled={disabled}
                    size="small"
                    sx={{ minWidth: 0 }}
                />
                <Box />
                <TextField
                    label="Forward"
                    value={forwardValue}
                    onChange={(e) => handleForwardChange(e.target.value)}
                    disabled={disabled}
                    size="small"
                    sx={{ minWidth: 0 }}
                />
                <Box />
            </Box>
            {participantRuleWarning && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    At least one endpoint must be in Participants.
                </Typography>
            )}
            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag="Room"
                onSelect={handleEndpointSelect}
                isExcluded={selectorIsExcluded}
            />
        </Box>
    )
}

export default ExitEdgeRowEditor
