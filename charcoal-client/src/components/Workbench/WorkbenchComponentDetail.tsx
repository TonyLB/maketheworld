import React, { FunctionComponent, useMemo } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from './useWorkbenchAsset'
import WorkbenchDraftLockout from './DraftLockout'
import WorkbenchRoomExitEditor from './RoomExitEditor'
import WorkbenchRoomLensEditor from './RoomLensEditor'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector } from 'react-redux'
import { getCurrentComponentId } from '../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { excludeUndefined } from '../../lib/lists'
import TopLevelStandardLiteralEditor from './TopLevelStandardLiteralEditor'
import WorkbenchExampleEditor from './ExampleEditor'
import WorkbenchSpacer from './WorkbenchSpacer'

const WMLComponentAppearance: FunctionComponent<{ universalKey: ComponentUUID }> = ({ universalKey }) => {
    const { standardForm, inheritedStandardForm, updateStandard } = useWorkbenchAsset()
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

    return component ? <Box sx={{
        marginLeft: '0.5em',
        marginTop: '0.5em',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '0.25em',
        width: "calc(100% - 0.5em)",
        position: 'relative'
    }}>
        {
            hasShortName(component) && (
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
            )
        }
        {
            (component.examples
                .payload
                .filter((reference) => (reference instanceof StandardReference))
                .map((reference) => (reference.universalKey))
                .filter(excludeUndefined)
                .map((universalKey) => (<WorkbenchExampleEditor componentId={universalKey} />)))
        }
        {
            (component instanceof StandardRoom) && (
                <>
                    <WorkbenchSpacer />
                    <WorkbenchRoomExitEditor RoomId={universalKey} />
                    <WorkbenchRoomLensEditor RoomId={universalKey} />
                </>
            )
        }
    </Box>
    : <Box />
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
