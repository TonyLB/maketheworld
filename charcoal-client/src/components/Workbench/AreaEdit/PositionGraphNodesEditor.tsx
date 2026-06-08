import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { Alert, Box } from '@mui/material'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { MakeTheWorldAccordion } from '../../UI'
import { pushBreadcrumb } from '../../../slices/UI/workbench'
import { useWorkbenchComponent } from '../foundations/WorkbenchComponent'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { ReferenceListSessionEditor } from '../foundations/ReferenceList'
import type { ComponentTag } from '../foundations/ReferenceList/ReferenceListEditor'
import {
    POSITION_GRAPH_NODE_TAGS,
    PositionGraphNodeTag,
    findEdgesMissingParticipantEndpoint
} from './areaEditMutations'
import { areaPositionGraphNodesTagAccessor } from './areaPositionGraphNodesAccessors'

export type PositionGraphNodesEditorProps = {
    AreaId: ComponentUUID
}

const NODE_TAG_LABELS: Record<PositionGraphNodeTag, string> = {
    Room: 'Rooms',
    Feature: 'Features',
    Character: 'Characters',
    Area: 'Areas'
}

const NODE_TAG_IMPORT: Partial<Record<PositionGraphNodeTag, boolean>> = {
    Room: true,
    Feature: true,
    Character: false,
    Area: true
}

const TagNodesSection: FunctionComponent<{
    nodeTag: PositionGraphNodeTag
    onItemClick: (id: string) => void
    excludeUniversalKey?: ComponentUUID
}> = ({ nodeTag, onItemClick, excludeUniversalKey }) => {
    const listAccessor = useMemo(
        () => areaPositionGraphNodesTagAccessor(nodeTag),
        [nodeTag]
    )

    const isExcludedExtra = useCallback(
        (universalKey: ComponentUUID) =>
            Boolean(excludeUniversalKey && universalKey === excludeUniversalKey),
        [excludeUniversalKey]
    )

    return (
        <ReferenceListSessionEditor<StandardArea>
            title={NODE_TAG_LABELS[nodeTag]}
            tag={nodeTag as ComponentTag}
            listAccessor={listAccessor}
            defaultExpanded={false}
            isExcludedExtra={excludeUniversalKey ? isExcludedExtra : undefined}
            affordance={{
                enableReferenceExisting: true,
                enableImport: NODE_TAG_IMPORT[nodeTag] ?? false
            }}
            onItemClick={onItemClick}
        />
    )
}

export const PositionGraphNodesEditor: FunctionComponent<PositionGraphNodesEditorProps> = ({
    AreaId
}) => {
    const dispatch = useDispatch()
    const { readonly } = useWorkbenchComponent<StandardArea>()
    const { standardForm } = useWorkbenchAsset()

    const handleParticipantClick = useCallback(
        (id: string) => {
            if (readonly) return
            dispatch(
                pushBreadcrumb({
                    id: id as ComponentUUID,
                    kind: 'component',
                    componentId: id as ComponentUUID
                })
            )
        },
        [readonly, dispatch]
    )

    const area = useMemo(() => {
        const component = standardForm.byUniversalId[AreaId]
        if (component instanceof StandardArea) {
            return component
        }
        return null
    }, [AreaId, standardForm])

    const d4Violations = useMemo(
        () => (area ? findEdgesMissingParticipantEndpoint(area) : []),
        [area]
    )

    const participantSummary = useMemo(() => {
        if (!area) {
            return undefined
        }
        const count = area.positionGraph.nodes.payload.length
        return count ? `${count} participant${count === 1 ? '' : 's'}` : undefined
    }, [area])

    if (!area) {
        return (
            <MakeTheWorldAccordion title="Participants" defaultExpanded>
                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    Area not found
                </Box>
            </MakeTheWorldAccordion>
        )
    }

    return (
        <MakeTheWorldAccordion title="Participants" defaultExpanded summary={participantSummary}>
            {d4Violations.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {d4Violations.length} exit{d4Violations.length === 1 ? '' : 's'} no longer ha
                    {d4Violations.length === 1 ? 's' : 've'} an endpoint in participants:{' '}
                    {d4Violations.map((edge) => edge.uuid).join(', ')}
                </Alert>
            )}
            {POSITION_GRAPH_NODE_TAGS.map((nodeTag) => (
                <TagNodesSection
                    key={nodeTag}
                    nodeTag={nodeTag}
                    onItemClick={handleParticipantClick}
                    excludeUniversalKey={nodeTag === 'Area' ? AreaId : undefined}
                />
            ))}
        </MakeTheWorldAccordion>
    )
}

export default PositionGraphNodesEditor
