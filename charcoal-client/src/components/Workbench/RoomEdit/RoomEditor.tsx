import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { useAddReferenceImport } from '../foundations/ReferenceList/AddReferenceImportControl'
import DefaultRenderEditor from '../foundations/DefaultRenderEditor'
import ExitEditor from './ExitEditor'
import LensHeader from '../LensEdit/LensHeader'
import FeatureListEditor from './FeatureListEditor'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, pushBreadcrumb } from '../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import {
    SituationRoomFacetList,
    StandardSituationRoomFacet
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { v4 as uuidv4 } from 'uuid'
import { TopLevelStandardLiteralEditor } from '../foundations/StandardLiteral'
import Spacer from '../WorkbenchSpacer'
import { ReferenceListEditor } from '../foundations/ReferenceList'
import { ReferenceListEditorGeneric } from '../foundations/ReferenceList/ReferenceListEditorGeneric'
import { situationIdToLabel } from '../../../lib/situationLabel'
import { DEFAULT_SITUATION_ID } from '../../../slices/personalAssets'
import RoomStateAffordance from './RoomStateAffordance'

export const RoomEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const room = useMemo<StandardRoom | undefined>(() => {
        if (!universalKey) return undefined
        const c = standardForm.byUniversalId[universalKey]
        if (c && c instanceof StandardRoom) return c
        return undefined
    }, [universalKey, standardForm])

    const singleLens = useMemo(() => {
        if (!room) return null
        const lensRefs = room.lens.payload || []
        if (lensRefs.length !== 1) return null
        const ref = lensRefs[0]
        if (!ref?.universalKey) return null
        const c = standardForm.byUniversalId[ref.universalKey]
        if (c && c instanceof StandardLens) return c
        return null
    }, [room, standardForm])

    const hasLens = !!singleLens

    useOnboardingCheckpoint('navigateRoom', { requireSequence: true })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    const guidanceListContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[universalKey!]
            if (!base || !(base instanceof StandardRoom)) return null
            const guidance = base._payload._guidance ?? new ReferenceList([])
            return {
                referenceList: guidance,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._guidance = list
                }
            }
        },
        [universalKey]
    )

    const handleGuidanceItemClick = useCallback(
        (id: string) => {
            if (!room || readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [room, readonly, dispatch, universalKey]
    )

    const situationItems = useMemo(() => {
        if (!room) return []
        return room.situations.items
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
    }, [room, standardForm])

    const handleSituationItemClick = useCallback(
        (id: string) => {
            if (!room || readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [room, readonly, dispatch]
    )

    const handleSituationRemove = useCallback(
        (situationId: string) => {
            if (!universalKey || !room || readonly) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const base = draft.byUniversalId[universalKey]
                    if (!base || !(base instanceof StandardRoom)) return draft
                    const newItems = base.situations.items.filter(
                        (f) => f.reference?.universalKey !== situationId
                    )
                    base._payload._situations = new SituationRoomFacetList(newItems)
                    return draft
                }
            })
        },
        [universalKey, room, updateStandard, readonly]
    )

    const isSituationExcluded = useCallback(
        (id: ComponentUUID) =>
            id === DEFAULT_SITUATION_ID ||
            (room?.situations.items.some((f) => f.reference?.universalKey === id) ?? false),
        [room]
    )

    const situationAssociation = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const base = draft.byUniversalId[universalKey!]
            if (!base || !(base instanceof StandardRoom)) return
            const universalKeyFromRef = ref.universalKey as ComponentUUID
            const already = base.situations.items.some((f) => f.reference?.universalKey === universalKeyFromRef)
            if (already) return
            const newFacet = new StandardSituationRoomFacet({
                reference: ref,
                payload: {}
            })
            base._payload._situations = new SituationRoomFacetList([
                ...base.situations.items,
                newFacet
            ])
        },
        [universalKey]
    )

    const situationRequestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (!universalKey || !room || readonly) return
            const situationKey = enforceTypedKey('SITUATION')
            const newSituationId = situationKey(uuidv4()) as ComponentUUID
            const ref = new StandardReference({ universalKey: newSituationId, tag: 'Situation' })
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const { component } = standardComponentFactory({ tag: 'Situation', universalKey: newSituationId })
                    if (component) {
                        draft.byUniversalId[newSituationId] = component
                        if (draft._topLevel) {
                            draft._topLevel = draft._topLevel.assureItem(ref)
                        } else {
                            draft._topLevel = new ReferenceList([ref])
                        }
                    }
                    return draft
                }
            })
            onCreated(ref)
            dispatch(pushBreadcrumb({ id: newSituationId, kind: 'component', componentId: newSituationId }))
        },
        [universalKey, room, updateStandard, readonly, dispatch]
    )

    const { actionRows: situationActionRows, selectorDialog: situationSelectorDialog } = useAddReferenceImport({
        tag: 'Situation',
        isExcluded: isSituationExcluded,
        association: situationAssociation,
        requestCreate: situationRequestCreate,
        labels: {
            add: 'Create new Situation',
            referenceExisting: 'Reference existing Situation'
        },
        enableReferenceExisting: true,
        enableImport: false,
        disabled: readonly
    })

    if (!universalKey || !(universalKey in standardForm.byUniversalId) || !room) {
        return <Box />
    }

    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ flexGrow: 1, position: "relative", width: "100%", overflowY: 'auto' }}>
                <Box sx={{ padding: 2 }}>
                    <Box sx={{
                        marginLeft: '0.5em',
                        marginTop: '0.5em',
                        display: 'flex',
                        flexDirection: 'column',
                        rowGap: '0.25em',
                        width: "calc(100% - 0.5em)",
                        position: 'relative'
                    }}>
                        <TopLevelStandardLiteralEditor
                            value={room.shortName ?? new StandardLiteral('')}
                            onChange={(newShortName) => {
                                updateStandard({
                                    type: 'update',
                                    update: (incoming: StandardForm) => {
                                        const base = incoming.byUniversalId[universalKey]
                                        if (base instanceof StandardRoom) {
                                            base._payload._shortName = newShortName
                                        }
                                        return incoming
                                    }
                                })
                            }}
                            label="Short Name"
                            placeholder="Enter short name..."
                            size="small"
                        />
                        <Spacer />
                        <DefaultRenderEditor parentId={universalKey} />
                        <ExitEditor RoomId={universalKey} />
                        <FeatureListEditor RoomId={universalKey} />
                        <LensHeader
                            RoomId={universalKey}
                            onEditLens={(lensId) =>
                                dispatch(pushBreadcrumb({ id: lensId, kind: 'component', componentId: lensId }))
                            }
                        />
                        {hasLens && (
                            <>
                                <RoomStateAffordance RoomId={universalKey} />
                                {/* Room Examples are not shown in the UI; supplanted by Situation facets. */}
                                <Box sx={{ marginTop: '0.5em' }}>
                                    <ReferenceListEditor
                                        title="Guidance"
                                        listContext={guidanceListContext}
                                        tag="Guidance"
                                        disabled={readonly}
                                        onItemClick={handleGuidanceItemClick}
                                    />
                                </Box>
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
                            </>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default RoomEditor
