import React, { FunctionComponent, useCallback, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import { MakeTheWorldAccordion } from '../../UI'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import ComponentSelectorDialog from '../foundations/ComponentSelector/ComponentSelectorDialog'
import ExitEdgeRowEditor from './ExitEdgeRowEditor'
import {
    addEdgeToArea,
    edgeSatisfiesD4,
    removeEdgeFromArea,
    updateEdgeInArea
} from './areaEditMutations'

export type ExitEdgeListEditorProps = {
    AreaId: ComponentUUID
}

type AddEdgeStep = 'from' | 'to' | null

export const ExitEdgeListEditor: FunctionComponent<ExitEdgeListEditorProps> = ({ AreaId }) => {
    const { readonly, standardForm, updateStandard } = useWorkbenchAsset()
    const [addStep, setAddStep] = useState<AddEdgeStep>(null)
    const [pendingFrom, setPendingFrom] = useState<ComponentUUID | null>(null)

    const area = useMemo(() => {
        const component = standardForm.byUniversalId[AreaId]
        if (component instanceof StandardArea) {
            return component
        }
        return null
    }, [AreaId, standardForm])

    const edges = useMemo(() => area?.positionGraph.edges.items ?? [], [area])

    const hasNodes = useMemo(
        () => Boolean(area && area.positionGraph.nodes.payload.length > 0),
        [area]
    )

    const edgeSummary = useMemo(() => {
        if (!edges.length) {
            return undefined
        }
        return `${edges.length} edge${edges.length === 1 ? '' : 's'}`
    }, [edges])

    const openAddFlow = useCallback(() => {
        if (readonly || !hasNodes) {
            return
        }
        setPendingFrom(null)
        setAddStep('from')
    }, [readonly, hasNodes])

    const closeAddFlow = useCallback(() => {
        setAddStep(null)
        setPendingFrom(null)
    }, [])

    const handleAddFromSelect = useCallback((universalKey: ComponentUUID) => {
        setPendingFrom(universalKey)
        setAddStep('to')
    }, [])

    const handleAddToSelect = useCallback(
        (toUniversalKey: ComponentUUID) => {
            if (!pendingFrom) {
                return
            }
            updateStandard({
                type: 'update',
                update: (draft) => {
                    const base = draft.byUniversalId[AreaId]
                    if (base instanceof StandardArea) {
                        addEdgeToArea(base, pendingFrom, toUniversalKey)
                    }
                    return draft
                }
            })
            closeAddFlow()
        },
        [AreaId, pendingFrom, updateStandard, closeAddFlow]
    )

    const updateEdge = useCallback(
        (edgeUuid: string, updatedEdge: StandardExitEdge) => {
            updateStandard({
                type: 'update',
                update: (draft) => {
                    const base = draft.byUniversalId[AreaId]
                    if (base instanceof StandardArea) {
                        updateEdgeInArea(base, edgeUuid, () => updatedEdge)
                    }
                    return draft
                }
            })
        },
        [AreaId, updateStandard]
    )

    const deleteEdge = useCallback(
        (edgeUuid: string) => {
            updateStandard({
                type: 'update',
                update: (draft) => {
                    const base = draft.byUniversalId[AreaId]
                    if (base instanceof StandardArea) {
                        removeEdgeFromArea(base, edgeUuid)
                    }
                    return draft
                }
            })
        },
        [AreaId, updateStandard]
    )

    if (!area) {
        return (
            <MakeTheWorldAccordion title="Exit edges" defaultExpanded={false}>
                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Area not found
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    return (
        <MakeTheWorldAccordion title="Exit edges" defaultExpanded={false} summary={edgeSummary}>
            <List disablePadding>
                {edges.map((edge) => (
                    <ListItem key={edge.uuid} disablePadding sx={{ display: 'block' }}>
                        <ExitEdgeRowEditor
                            edge={edge}
                            onUpdate={(updated) => updateEdge(edge.uuid, updated)}
                            onDelete={() => deleteEdge(edge.uuid)}
                            disabled={readonly}
                            d4Error={!edgeSatisfiesD4(area, edge)}
                        />
                    </ListItem>
                ))}
                <ListItem disablePadding>
                    <ListItemButton
                        onClick={openAddFlow}
                        disabled={readonly || !hasNodes}
                        sx={{ justifyContent: 'center' }}
                    >
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Add exit edge"
                            secondary={!hasNodes ? 'Add participants before creating edges' : undefined}
                        />
                    </ListItemButton>
                </ListItem>
            </List>
            {!hasNodes && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1 }}>
                    Add at least one participant room before authoring topology edges.
                </Typography>
            )}
            <ComponentSelectorDialog
                open={addStep === 'from'}
                onClose={closeAddFlow}
                tag="Room"
                onSelect={handleAddFromSelect}
            />
            <ComponentSelectorDialog
                open={addStep === 'to'}
                onClose={closeAddFlow}
                tag="Room"
                onSelect={handleAddToSelect}
            />
        </MakeTheWorldAccordion>
    )
}

export default ExitEdgeListEditor
