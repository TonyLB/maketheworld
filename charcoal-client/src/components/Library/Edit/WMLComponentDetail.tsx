import React, { FunctionComponent, useCallback, useMemo } from 'react'
import {
    useLocation,
    useNavigate,
    useParams
} from "react-router-dom"

import Box from '@mui/material/Box'
import HomeIcon from '@mui/icons-material/Home'

import LibraryBanner from './LibraryBanner'

import StandardLiteralEditor from './StandardLiteralEditor'
import { useLibraryAsset } from './LibraryAsset'
import DraftLockout from './DraftLockout'
import RoomExitEditor from './RoomExitEditor'
import RoomLensEditor from './RoomLensEditor'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import { useDispatch } from 'react-redux'

import TitledBox from '../../TitledBox'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'

import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { hasName, hasShortName, StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { SchemaOutputTag } from '@tonylb/mtw-base/ts/schema'
import ExampleEditor from './ExampleEditor'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { StandardExplicitKey } from '@tonylb/mtw-wml/ts/standardize/explicit'
import { excludeUndefined } from '../../../lib/lists'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useUniversalKeyFromPath } from '../../../hooks/useUniversalKey'

const WMLComponentAppearance: FunctionComponent<{ universalKey: ComponentUUID }> = ({ universalKey }) => {
    const { standardForm, inheritedStandardForm, updateStandard } = useLibraryAsset()
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
                    <StandardLiteralEditor
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
                .map((universalKey) => (<ExampleEditor componentId={universalKey} />)))
        }
        {
            (component instanceof StandardRoom) && (
                <>
                    <RoomExitEditor RoomId={universalKey} />
                    <RoomLensEditor RoomId={universalKey} />
                </>
            )
        }
    </Box>
    : <Box />
}

interface WMLComponentDetailProps {
}

export const WMLComponentDetail: FunctionComponent<WMLComponentDetailProps> = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const { assetKey, updateStandard, standardForm } = useLibraryAsset()
    const { ComponentId } = useParams<{ ComponentId: string }>()
    const location = useLocation()
    const tag = location.pathname.split('/').slice(-2)[0]
    const universalKey = useUniversalKeyFromPath()
    
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
    
    // Removed useAutoPin - tab navigation removed
    const onKeyChange = useCallback((toKey: string) => {
        if (!universalKey) return
        const component = standardForm.byUniversalId[universalKey]
        if (!component) return
        
        const currentKey = component.key
        if (currentKey === toKey) return  // No change needed
        
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                const componentToUpdate = draft.byUniversalId[universalKey]
                if (componentToUpdate) {
                    // Set _key to simple Plain StandardExplicitKey with new value
                    // diff() will automatically generate Replace operation when comparing
                    // the old Plain key (from base) with this new Plain key
                    componentToUpdate._key = new StandardExplicitKey(toKey)
                }
                return draft
            }
        })
    }, [updateStandard, universalKey, standardForm])
    const nameValidate = useCallback((toKey: string) => {
        if (!universalKey) return false
        const component = standardForm.byUniversalId[universalKey]
        return !(toKey !== component?.key)
    }, [universalKey, standardForm])
    
    if (!universalKey || !(universalKey in standardForm.byUniversalId)) {
        return <Box />
    }
    
    const component = standardForm.byUniversalId[universalKey]
    const displayKey = component?.key || ComponentId || ''
    
    return <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <LibraryBanner
            primary={componentName}
            secondary={displayKey}
            onChangeSecondary={onKeyChange}
            validateSecondary={nameValidate}
            icon={<HomeIcon />}
            breadCrumbProps={[{
                href: '/Library',
                label: 'Library'
            },
            {
                href: `/Library/Edit/Asset/${assetKey}`,
                label: assetKey || ''
            },
            {
                label: componentName
            }]}
        />
        <Box sx={{ flexGrow: 1, position: "relative", width: "100%" }}>
            <Box sx={{ overflowY: 'auto' }}>
                <WMLComponentAppearance universalKey={universalKey} />
            </Box>
            <DraftLockout />
        </Box>
    </Box>
}

export default WMLComponentDetail
