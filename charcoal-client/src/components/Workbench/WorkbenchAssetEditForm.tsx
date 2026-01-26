import React, { FunctionComponent, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Typography } from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'
import HomeIcon from '@mui/icons-material/Home'

import { getAssetZone } from '../../slices/player'
import { addOnboardingComplete } from '../../slices/player/index.api'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { setCurrentView, setCurrentComponentId } from '../../slices/UI/workbench'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import WorkbenchImportComponentDialog from './ImportComponentDialog'
import WorkbenchStandardLiteralEditor from './StandardLiteralEditor'
import WorkbenchStandardRenderEditor from './StandardRenderEditor'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { useDebouncedOnChange } from '../../hooks/useDebounce'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { v4 as uuidv4 } from 'uuid'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import WorkbenchComponentRow from './WorkbenchComponentRow'
import WorkbenchAddComponent from './WorkbenchAddComponent'
import WorkbenchAddImport from './WorkbenchAddImport'
import ImageHeader from '../Library/Edit/ImageHeader'
import WorkbenchDraftLockout from './DraftLockout'
import { MakeTheWorldAccordion } from '../UI'

export const WorkbenchAssetEditForm: FunctionComponent = () => {
    const { updateStandard, standardForm, readonly, AssetId } = useWorkbenchAsset()
    const zone = useSelector(getAssetZone(AssetId))
    const dispatch = useDispatch()
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: zone === 'Draft' })

    // Asset-level metadata editing (ShortName and Summary) - only for drafts
    const shortName = useMemo(() => 
        standardForm.shortName ?? new StandardLiteral(''), 
        [standardForm.shortName]
    )
    
    // Determine if Metadata accordion should default to open
    // Open if ShortName is not defined or is empty (to prompt user to enter it)
    const metadataDefaultExpanded = useMemo(() => {
        if (!standardForm.shortName) {
            return true // No ShortName defined, open accordion to prompt entry
        }
        const shortNameValue = shortName._payload?.plain?.toJSON() ?? ''
        return shortNameValue.trim() === '' // Empty ShortName, open accordion to prompt entry
    }, [standardForm.shortName, shortName])
    
    const [summary, setSummary] = useState(standardForm.summary ?? new StandardRender([]))
    const summaryRef = useRef(summary)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    
    useEffect(() => {
        summaryRef.current = summary
    }, [summary])
    
    useEffect(() => {
        const newSummary = standardForm.summary ?? new StandardRender([])
        const currentSummary = summaryRef.current
        if (newSummary.toJSON() !== currentSummary.toJSON()) {
            setSummary(newSummary)
        }
    }, [standardForm.summary])

    const handleShortNameChange = useCallback((value: StandardLiteral) => {
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                draft._shortName = value._payload?.plain?.toJSON() ? value : undefined
                return draft
            }
        })
    }, [updateStandard])

    useDebouncedOnChange({
        value: summary,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    draft._summary = value
                    return draft
                }
            })
        }
    })

    // Get top-level components from _topLevel ReferenceList
    const topLevelComponents = useMemo<StandardComponent[]>(() => {
        if (!standardForm?._topLevel) return []
        return standardForm._topLevel.payload
            .map(ref => standardForm._lookup(ref.standardKey.toJSON()))
            .filter((component): component is StandardComponent => component !== undefined)
    }, [standardForm])

    const characters = useMemo<StandardCharacter[]>(() => topLevelComponents.filter((component): component is StandardCharacter => component instanceof StandardCharacter), [topLevelComponents])
    const rooms = useMemo<StandardRoom[]>(() => topLevelComponents.filter((component): component is StandardRoom => component instanceof StandardRoom), [topLevelComponents])
    const features = useMemo<StandardFeature[]>(() => topLevelComponents.filter((component): component is StandardFeature => component instanceof StandardFeature), [topLevelComponents])
    const knowledges = useMemo<StandardKnowledge[]>(() => topLevelComponents.filter((component): component is StandardKnowledge => component instanceof StandardKnowledge), [topLevelComponents])
    const maps = useMemo<StandardMap[]>(() => topLevelComponents.filter((component): component is StandardMap => component instanceof StandardMap), [topLevelComponents])
    const images = useMemo<StandardImage[]>(() => topLevelComponents.filter((component): component is StandardImage => component instanceof StandardImage), [topLevelComponents])

    // Combine all components for rendering with alternating row shading
    const allComponents = useMemo(() => {
        const result: Array<{ component: StandardComponent; icon: React.ReactChild }> = []
        characters.forEach(c => result.push({ component: c, icon: <PersonIcon sx={{ fontSize: '1.25rem' }} /> }))
        maps.forEach(m => result.push({ component: m, icon: <MapIcon sx={{ fontSize: '1.25rem' }} /> }))
        rooms.forEach(r => result.push({ component: r, icon: <HomeIcon sx={{ fontSize: '1.25rem' }} /> }))
        features.forEach(f => result.push({ component: f, icon: <FeatureIcon sx={{ fontSize: '1.25rem' }} /> }))
        knowledges.forEach(k => result.push({ component: k, icon: <KnowledgeIcon sx={{ fontSize: '1.25rem' }} /> }))
        return result
    }, [characters, maps, rooms, features, knowledges])

    const addAsset = useCallback((tag: 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image') => () => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
        updateStandard({
            type: 'update',
            update: (draft) => {
                const tagUpper = tag.toUpperCase() as 'ROOM' | 'FEATURE' | 'KNOWLEDGE' | 'CHARACTER' | 'MAP' | 'IMAGE'
                const enforceKey = enforceTypedKey(tagUpper)
                const uuid = uuidv4()
                const universalKey = enforceKey(uuid) as ComponentUUID
                
                const component = standardComponentFactory({ tag, universalKey })
                if (component) {
                    // Use byUniversalId to add component (handles _components and cache invalidation)
                    draft.byUniversalId[universalKey] = component
                    
                    // Add component reference to _topLevel if it exists, or create it
                    const componentReference = new StandardReference({ universalKey, tag })
                    if (draft._topLevel) {
                        draft._topLevel = draft._topLevel.assureItem(componentReference)
                    } else {
                        draft._topLevel = new ReferenceList([componentReference])
                    }
                }
                else {
                    throw new Error(`Invalid tag: ${tag}`)
                }
                return draft
            }
        })
    }, [updateStandard, dispatch])

    // Handle component selection - use state-based navigation
    const handleComponentClick = useCallback((componentId: ComponentUUID) => {
        dispatch(setCurrentView('component'))
        dispatch(setCurrentComponentId(componentId))
    }, [dispatch])

    return (
        <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
            <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
                <Box sx={{ marginLeft: 2, marginRight: 2, width: "calc(100% - 32px)" }}>
                    {!readonly && (
                        <MakeTheWorldAccordion title="Metadata" defaultExpanded={metadataDefaultExpanded}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Short Name</Typography>
                                    <WorkbenchStandardLiteralEditor
                                        value={shortName}
                                        onChange={handleShortNameChange}
                                        placeholder="Enter a short name for this draft"
                                        readonly={readonly}
                                    />
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Summary</Typography>
                                    <Box sx={{
                                        backgroundColor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: '4px',
                                        padding: '0.5em'
                                    }}>
                                        <WorkbenchStandardRenderEditor
                                            value={summary}
                                            onChange={setSummary}
                                            validLinkTags={[]}
                                            toolbar={false}
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </MakeTheWorldAccordion>
                    )}
                    
                    <MakeTheWorldAccordion title="Components" defaultExpanded={true}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {allComponents.map(({ component, icon }, index) => (
                                <WorkbenchComponentRow
                                    key={component.universalKey}
                                    ItemId={component.universalKey!}
                                    onClick={() => handleComponentClick(component.universalKey!)}
                                    icon={icon}
                                    isEven={index % 2 === 1}
                                />
                            ))}
                            {images.length
                                ? images.map((image) => (
                                    <ImageHeader
                                        key={image.universalKey ?? image.key}
                                        ItemId={image.universalKey ?? ''}
                                        onClick={() => {}}
                                    />
                                ))
                                : null
                            }
                            {!readonly && (
                                <>
                                    <WorkbenchAddComponent
                                        onAddAsset={(tag) => addAsset(tag)()}
                                        isEven={(allComponents.length + images.length) % 2 === 1}
                                    />
                                    <WorkbenchAddImport
                                        onImportClick={() => setImportDialogOpen(true)}
                                        isEven={(allComponents.length + images.length + 1) % 2 === 1}
                                    />
                                </>
                            )}
                        </Box>
                    </MakeTheWorldAccordion>
                </Box>
                <WorkbenchDraftLockout />
            </Box>
            
            <WorkbenchImportComponentDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                assetId={AssetId}
            />
        </Box>
    )
}

export default WorkbenchAssetEditForm
