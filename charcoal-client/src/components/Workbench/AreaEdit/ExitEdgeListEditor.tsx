import React, { FunctionComponent, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import AddIcon from '@mui/icons-material/Add'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardExitEdge } from '@tonylb/mtw-wml/ts/standardize/keys/edges/exitEdge'
import { MakeTheWorldAccordion } from '../../UI'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import ExitEdgeRowEditor from './ExitEdgeRowEditor'
import {
    addEmptyExitEdge,
    edgeSatisfiesParticipantRule,
    removeEdgeFromArea,
    updateEdgeInArea
} from './areaEditMutations'

export type ExitEdgeListEditorProps = {
    AreaId: ComponentUUID
}

export const ExitEdgeListEditor: FunctionComponent<ExitEdgeListEditorProps> = ({ AreaId }) => {
    const { readonly, standardForm, updateStandard } = useWorkbenchAsset()

    const area = useMemo(() => {
        const component = standardForm.byUniversalId[AreaId]
        if (component instanceof StandardArea) {
            return component
        }
        return null
    }, [AreaId, standardForm])

    const edges = useMemo(() => area?.ludicGraph.edges.items ?? [], [area])

    const edgeSummary = useMemo(() => {
        if (!edges.length) {
            return undefined
        }
        return `${edges.length} edge${edges.length === 1 ? '' : 's'}`
    }, [edges])

    const handleAddExitEdge = useCallback(() => {
        if (readonly) {
            return
        }
        updateStandard({
            type: 'update',
            update: (draft) => {
                const base = draft.byUniversalId[AreaId]
                if (base instanceof StandardArea) {
                    addEmptyExitEdge(base)
                }
                return draft
            }
        })
    }, [AreaId, readonly, updateStandard])

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
                            area={area}
                            edge={edge}
                            onUpdate={(updated) => updateEdge(edge.uuid, updated)}
                            onDelete={() => deleteEdge(edge.uuid)}
                            disabled={readonly}
                            participantRuleWarning={!edgeSatisfiesParticipantRule(area, edge)}
                        />
                    </ListItem>
                ))}
                <ListItem disablePadding>
                    <ListItemButton
                        onClick={handleAddExitEdge}
                        disabled={readonly}
                        sx={{ justifyContent: 'center' }}
                    >
                        <ListItemIcon>
                            <AddIcon />
                        </ListItemIcon>
                        <ListItemText primary="Add exit edge" />
                    </ListItemButton>
                </ListItem>
            </List>
        </MakeTheWorldAccordion>
    )
}

export default ExitEdgeListEditor
