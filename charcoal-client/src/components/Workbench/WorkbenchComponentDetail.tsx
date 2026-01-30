import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import WorkbenchDraftLockout from './DraftLockout'
import WorkbenchRoomExitEditor from './RoomExitEditor'
import WorkbenchRoomLensEditor from './RoomLensEditor'
import WorkbenchRoomFeatureEditor from './WorkbenchRoomFeatureEditor'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, navigateToComponentLayer } from '../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { excludeUndefined } from '../../lib/lists'
import { TopLevelStandardLiteralEditor } from './foundations/StandardLiteral'
import WorkbenchSpacer from './WorkbenchSpacer'
import { WorkbenchReferenceList, referenceListToWorkbenchItems } from './foundations/ReferenceList'

const WMLComponentAppearance: FunctionComponent<{ universalKey: ComponentUUID }> = ({ universalKey }) => {
    const dispatch = useDispatch()
    const { standardForm, inheritedStandardForm, updateStandard, readonly } = useWorkbenchAsset()
    const [component, inherited]: [StandardFeature | StandardKnowledge | StandardRoom | undefined, StandardFeature | StandardKnowledge | StandardRoom | undefined] = useMemo(() => {
        const extractComponent = (standardForm: StandardForm): StandardFeature | StandardKnowledge | StandardRoom | undefined => {
            if (universalKey) {
                const component = standardForm.byUniversalId[universalKey]
                if (component && (component instanceof StandardFeature || component instanceof StandardKnowledge || component instanceof StandardRoom)) {
                    return component
                }
            }
            return undefined
        }
        return [extractComponent(standardForm), extractComponent(inheritedStandardForm)]
    }, [universalKey, standardForm, inheritedStandardForm])
    const { tag } = component ?? {}
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    const handleExamplesAdd = useCallback(() => {
        if (!component || readonly) {
            return
        }
        const ExampleKey = (value: string) => (`EXAMPLE#${value}` as ComponentUUID)
        const uuid = `example-${Date.now()}`
        const exampleUniversalKey = ExampleKey(uuid)

        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[universalKey]
                if (base instanceof StandardRoom || base instanceof StandardFeature || base instanceof StandardKnowledge) {
                    const newExample = new StandardExample({
                        tag: 'Example',
                        universalKey: exampleUniversalKey
                    })
                    draft.byUniversalId[exampleUniversalKey] = newExample

                    const exampleReference = new StandardReference({
                        universalKey: exampleUniversalKey,
                        tag: 'Example'
                    })
                    const currentExamples = base._payload._examples ?? new ReferenceList([])
                    base._payload._examples = currentExamples.assureItem(exampleReference)
                }
                return draft
            }
        })
    }, [component, readonly, updateStandard, universalKey])

    const handleExamplesRemove = useCallback((id: string) => {
        if (!component || readonly) {
            return
        }
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const base = draft.byUniversalId[universalKey]
                if (base instanceof StandardRoom || base instanceof StandardFeature || base instanceof StandardKnowledge) {
                    const currentExamples = base._payload._examples ?? new ReferenceList([])
                    const filtered = currentExamples.payload.filter((ref) => {
                        const universalKey = ref.universalKey
                        const key = ref.standardKey.key
                        const resolvedId = universalKey ?? key
                        return resolvedId !== id
                    })
                    base._payload._examples = new ReferenceList(filtered)
                }
                return draft
            }
        })
    }, [component, readonly, updateStandard, universalKey])

    const handleExamplesItemClick = useCallback((id: string) => {
        if (!component || readonly) {
            return
        }
        dispatch(navigateToComponentLayer(universalKey, id as ComponentUUID))
    }, [component, readonly, dispatch, universalKey])

    const exampleReferences = useMemo(
        () => (component ? (component.examples ?? new ReferenceList([])) : new ReferenceList([])),
        [component]
    )

    const exampleItems = useMemo(
        () =>
            referenceListToWorkbenchItems({
                referenceList: exampleReferences,
                standardForm,
                tag: 'Example'
            }),
        [exampleReferences, standardForm]
    )

    const examplesSummary = useMemo(() => {
        if (!exampleItems.length) {
            return undefined
        }
        const titles = exampleItems.map(({ title }) => title).filter(Boolean)
        return titles.join(', ')
    }, [exampleItems])

    return component ? (
        <Box sx={{
            marginLeft: '0.5em',
            marginTop: '0.5em',
            display: 'flex',
            flexDirection: 'column',
            rowGap: '0.25em',
            width: "calc(100% - 0.5em)",
            position: 'relative'
        }}>
            {hasShortName(component) && (
                <TopLevelStandardLiteralEditor
                    value={component.shortName ?? new StandardLiteral('')}
                    onChange={(newShortName) => {
                        updateStandard({
                            type: 'update',
                            update: (incoming: StandardForm) => {
                                const base = incoming.byUniversalId[universalKey]
                                if (base instanceof StandardRoom || base instanceof StandardCharacter || base instanceof StandardFeature || base instanceof StandardKnowledge) {
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
            )}
            {component instanceof StandardRoom && (
                <>
                    <WorkbenchSpacer />
                    <WorkbenchRoomExitEditor RoomId={universalKey} />
                    <WorkbenchRoomLensEditor RoomId={universalKey} />
                    <WorkbenchRoomFeatureEditor RoomId={universalKey} />
                </>
            )}
            <Box sx={{ marginTop: '0.5em' }}>
                <WorkbenchReferenceList
                    title="Examples"
                    items={exampleItems}
                    summary={examplesSummary}
                    defaultExpanded={!!exampleItems.length}
                    disabled={readonly}
                    onItemClick={handleExamplesItemClick}
                    onItemRemove={handleExamplesRemove}
                    onAddClick={handleExamplesAdd}
                    addLabel="Add Example"
                    emptyStateText="This component does not currently reference any Examples."
                />
            </Box>
        </Box>
    ) : <Box />
}

export const WorkbenchComponentDetail: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)
    
    // Derive universalKey from currentComponentId
    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])
    
    if (!universalKey || !(universalKey in standardForm.byUniversalId)) {
        return <Box />
    }
    
    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ flexGrow: 1, position: "relative", width: "100%", overflowY: 'auto' }}>
                <Box sx={{ padding: 2 }}>
                    <WMLComponentAppearance universalKey={universalKey} />
                </Box>
                <WorkbenchDraftLockout />
            </Box>
        </Box>
    )
}

export default WorkbenchComponentDetail
