import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import RoomLensEditor from './RoomLensEditor'
import RoomFeatureEditor from './WorkbenchRoomFeatureEditor'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, navigateToComponentLayer } from '../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { TopLevelStandardLiteralEditor } from './foundations/StandardLiteral'
import Spacer from './WorkbenchSpacer'
import { ReferenceListEditor } from './foundations/ReferenceList'

const WMLComponentAppearance: FunctionComponent<{ universalKey: ComponentUUID }> = ({ universalKey }) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const [component]: [StandardFeature | StandardKnowledge | StandardRoom | undefined] = useMemo(() => {
        const extractComponent = (form: StandardForm): StandardFeature | StandardKnowledge | StandardRoom | undefined => {
            if (universalKey) {
                const c = form.byUniversalId[universalKey]
                if (c && (c instanceof StandardFeature || c instanceof StandardKnowledge || c instanceof StandardRoom)) {
                    return c
                }
            }
            return undefined
        }
        return [extractComponent(standardForm)]
    }, [universalKey, standardForm])
    const { tag } = component ?? {}
    useOnboardingCheckpoint('navigateRoom', { requireSequence: true, condition: tag === 'Room' })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    const examplesListContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[universalKey]
            if (
                !base ||
                !(base instanceof StandardRoom || base instanceof StandardFeature || base instanceof StandardKnowledge)
            ) {
                return null
            }
            const examples = base._payload._examples ?? new ReferenceList([])
            return {
                referenceList: examples,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._examples = list
                }
            }
        },
        [universalKey]
    )

    const handleExamplesItemClick = useCallback(
        (id: string) => {
            if (!component || readonly) return
            dispatch(navigateToComponentLayer(universalKey, id as ComponentUUID))
        },
        [component, readonly, dispatch, universalKey]
    )

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
                    <Spacer />
                    <RoomExitEditor RoomId={universalKey} />
                    <RoomLensEditor RoomId={universalKey} />
                    <RoomFeatureEditor RoomId={universalKey} />
                </>
            )}
            <Box sx={{ marginTop: '0.5em' }}>
                <ReferenceListEditor
                    title="Examples"
                    listContext={examplesListContext}
                    tag="Example"
                    addAffordance="create"
                    addLabel="Add Example"
                    emptyStateText="This component does not currently reference any Examples."
                    disabled={readonly}
                    onItemClick={handleExamplesItemClick}
                />
            </Box>
        </Box>
    ) : <Box />
}

export const ComponentDetail: FunctionComponent = () => {
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
                <DraftLockout />
            </Box>
        </Box>
    )
}

export default ComponentDetail
