import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { Box, Button, Card, CardHeader, CardContent } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import WorkbenchStandardLiteralEditor from './StandardLiteralEditor'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { setCurrentView, setCurrentComponentId } from '../../slices/UI/workbench'
import WorkbenchDraftLockout from './DraftLockout'
import WorkbenchRoomExitEditor from './RoomExitEditor'
import WorkbenchRoomLensEditor from './RoomLensEditor'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import TitledBox from '../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'

import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { hasName, hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { SchemaOutputTag } from '@tonylb/mtw-base/ts/schema'
import WorkbenchExampleEditor from './ExampleEditor'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { StandardExplicitKey } from '@tonylb/mtw-wml/ts/standardize/explicit'
import { excludeUndefined } from '../../lib/lists'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector } from 'react-redux'
import { getCurrentComponentId } from '../../slices/UI/workbench'

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
                <TitledBox title="Short Name">
                    <WorkbenchStandardLiteralEditor
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
                        placeholder="Enter short name..."
                        size="small"
                    />
                </TitledBox>
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
                    <WorkbenchRoomExitEditor RoomId={universalKey} />
                    <WorkbenchRoomLensEditor RoomId={universalKey} />
                </>
            )
        }
    </Box>
    : <Box />
}

export const WorkbenchComponentDetail: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { updateStandard, standardForm } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)
    
    // Derive universalKey from currentComponentId
    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])
    
    const componentName = useMemo(() => {
        if (!universalKey) {
            return ''
        }
        const component = standardForm.byUniversalId[universalKey]
        if (component) {
            if (hasShortName(component)) {
                return component.shortName?._payload?.plain?.toJSON() ?? 'Untitled'
            }
            else if (hasName(component)) {
                return schemaOutputToString((unwrapSubject(component.name)?.children ?? []) as GenericTree<SchemaOutputTag>)
            }
        }
        return ''
    }, [standardForm, universalKey])
    
    const onKeyChange = useCallback((toKey: string) => {
        if (!universalKey) return
        const component = standardForm.byUniversalId[universalKey]
        if (!component) return
        
        const currentKey = component.key
        if (currentKey === toKey) return
        
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const componentToUpdate = draft.byUniversalId[universalKey]
                if (componentToUpdate) {
                    componentToUpdate._key = new StandardExplicitKey(toKey)
                }
                return draft
            }
        })
    }, [updateStandard, universalKey, standardForm])
    
    const handleBackToAsset = useCallback(() => {
        dispatch(setCurrentView('asset'))
        dispatch(setCurrentComponentId(null))
    }, [dispatch])
    
    if (!universalKey || !(universalKey in standardForm.byUniversalId)) {
        return <Box />
    }
    
    const component = standardForm.byUniversalId[universalKey]
    const displayKey = component?.key || currentComponentId || ''
    
    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ padding: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToAsset}
                    variant="outlined"
                    size="small"
                >
                    Back to Asset
                </Button>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ fontWeight: 'bold', fontSize: '1.125rem' }}>
                        {componentName || 'Untitled'}
                    </Box>
                    {displayKey && (
                        <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                            {displayKey}
                        </Box>
                    )}
                </Box>
            </Box>
            
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
