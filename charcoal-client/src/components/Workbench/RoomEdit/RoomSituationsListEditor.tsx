import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { Box } from '@mui/material'
import { useDispatch } from 'react-redux'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { v4 as uuidv4 } from 'uuid'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import {
    SituationProseFacetList,
    StandardSituationProseFacet
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

type SituationProseFacetListInstance = InstanceType<typeof SituationProseFacetList>

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { useWorkbenchComponent } from '../foundations/WorkbenchComponent'
import { useAddReferenceImport } from '../foundations/ReferenceList/AddReferenceImportControl'
import { ReferenceListEditorGeneric } from '../foundations/ReferenceList/ReferenceListEditorGeneric'
import { confirmOrphanClosureBeforeComponentDisassociate } from '../foundations/consistency/confirmOrphanClosureBeforeLocalEdit'
import { situationIdToLabel } from '../../../lib/situationLabel'
import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'
import { pushBreadcrumb } from '../../../slices/UI/workbench'
import { roomSituationsFacetAccessor } from './roomReferenceListAccessors'

function appendSituationFacetIfNew(
    list: SituationProseFacetListInstance,
    ref: StandardReference
): SituationProseFacetListInstance | null {
    const universalKeyFromRef = ref.universalKey as ComponentUUID
    if (universalKeyFromRef === DEFAULT_SITUATION_ID) {
        return null
    }
    const already = list.items.some(
        (f: StandardSituationProseFacet) => f.reference?.universalKey === universalKeyFromRef
    )
    if (already) {
        return null
    }
    const newFacet = new StandardSituationProseFacet({
        reference: ref,
        payload: {}
    })
    return new SituationProseFacetList([...list.items, newFacet])
}

function removeSituationFacetById(
    list: SituationProseFacetListInstance,
    situationId: string
): SituationProseFacetListInstance {
    const newItems = list.items.filter(
        (f: StandardSituationProseFacet) => f.reference?.universalKey !== situationId
    )
    return new SituationProseFacetList(newItems)
}

export type RoomSituationsListEditorProps = {
    RoomId: ComponentUUID
}

export const RoomSituationsListEditor: FunctionComponent<RoomSituationsListEditorProps> = ({
    RoomId
}) => {
    const dispatch = useDispatch()
    const {
        standardForm,
        localStandardForm,
        materializeComponentInAsset,
        readonly: assetReadonly
    } = useWorkbenchAsset()
    const {
        working,
        updateComponent,
        readonly: sessionReadonly,
        missing
    } = useWorkbenchComponent<StandardRoom>()
    const readonly = assetReadonly || sessionReadonly

    const situations = useMemo(
        () => (working ? roomSituationsFacetAccessor.getFacetList(working) : new SituationProseFacetList([])),
        [working]
    )

    const situationItems = useMemo(() => {
        return situations.items
            .filter((f) => f.reference?.universalKey !== DEFAULT_SITUATION_ID)
            .map((facet) => {
                const situationId = facet.reference?.universalKey as ComponentUUID | undefined
                if (!situationId) return null
                return {
                    id: situationId,
                    title: situationIdToLabel(situationId, standardForm)
                }
            })
            .filter((x): x is { id: ComponentUUID; title: string } => x !== null)
    }, [situations, standardForm])

    const handleSituationItemClick = useCallback(
        (id: string) => {
            if (readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [readonly, dispatch]
    )

    const handleSituationRemove = useCallback(
        (situationId: string) => {
            if (!working || readonly || missing) return
            void (async () => {
                const proceed = await confirmOrphanClosureBeforeComponentDisassociate({
                    dispatch,
                    localStandardForm,
                    componentId: RoomId,
                    working,
                    applyDisassociateOnWorking: (sim) => {
                        roomSituationsFacetAccessor.setFacetList(
                            sim,
                            removeSituationFacetById(roomSituationsFacetAccessor.getFacetList(sim), situationId)
                        )
                    }
                })
                if (!proceed) {
                    return
                }
                updateComponent((draft) => {
                    roomSituationsFacetAccessor.setFacetList(
                        draft,
                        removeSituationFacetById(roomSituationsFacetAccessor.getFacetList(draft), situationId)
                    )
                })
            })()
        },
        [
            working,
            readonly,
            missing,
            dispatch,
            localStandardForm,
            RoomId,
            updateComponent
        ]
    )

    const isSituationExcluded = useCallback(
        (id: ComponentUUID) =>
            id === DEFAULT_SITUATION_ID ||
            situations.items.some((f) => f.reference?.universalKey === id),
        [situations.items]
    )

    const onAssociateReference = useCallback(
        (ref: StandardReference) => {
            if (readonly || missing || !working) return
            const next = appendSituationFacetIfNew(roomSituationsFacetAccessor.getFacetList(working), ref)
            if (!next) return
            updateComponent((draft) => {
                roomSituationsFacetAccessor.setFacetList(draft, next)
            })
        },
        [readonly, missing, working, updateComponent]
    )

    const situationAssociation = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const base = draft.byUniversalId[RoomId]
            if (!base || !(base instanceof StandardRoom)) return
            const next = appendSituationFacetIfNew(roomSituationsFacetAccessor.getFacetList(base), ref)
            if (next) {
                roomSituationsFacetAccessor.setFacetList(base, next)
            }
        },
        [RoomId]
    )

    const situationRequestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (readonly || missing || !working) return
            const situationKey = enforceTypedKey('SITUATION')
            const newSituationId = situationKey(uuidv4()) as ComponentUUID

            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey: newSituationId })
                onCreated(ref)
                dispatch(
                    pushBreadcrumb({
                        id: newSituationId,
                        kind: 'component',
                        componentId: newSituationId
                    })
                )
            })()
        },
        [readonly, missing, working, materializeComponentInAsset, dispatch]
    )

    const { actionRows: situationActionRows, selectorDialog: situationSelectorDialog } =
        useAddReferenceImport({
            tag: 'Situation',
            isExcluded: isSituationExcluded,
            association: situationAssociation,
            requestCreate: situationRequestCreate,
            onAssociateReference,
            labels: {
                add: 'Create new Situation',
                referenceExisting: 'Reference existing Situation'
            },
            enableReferenceExisting: true,
            enableImport: false,
            disabled: readonly
        })

    if (missing || !working) {
        return null
    }

    return (
        <Box sx={{ marginTop: '0.5em' }}>
            <ReferenceListEditorGeneric
                title="Situations"
                items={situationItems}
                defaultExpanded={!!situationItems.length}
                disabled={readonly}
                variant="table"
                onItemClick={handleSituationItemClick}
                onItemRemove={handleSituationRemove}
                actionAffordances={situationActionRows}
            />
            {situationSelectorDialog}
        </Box>
    )
}

export default RoomSituationsListEditor
