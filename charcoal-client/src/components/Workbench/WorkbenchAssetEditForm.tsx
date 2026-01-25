import React, { FunctionComponent, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Button,
    List,
    ListSubheader,
    Typography,
    Divider,
    Card,
    CardHeader,
    CardContent
} from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'
import ImportExportIcon from '@mui/icons-material/ImportExport'

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
import WorkbenchRecentlyVisited from './RecentlyVisited'
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
import WorkbenchWMLComponentHeader from './WMLComponentHeader'
import ImageHeader from '../Library/Edit/ImageHeader'
import WorkbenchDraftLockout from './DraftLockout'

const AddWMLComponent: FunctionComponent<{ type: 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image'; onAdd: () => void }> = ({ type, onAdd }) => (
    <Button
        onClick={onAdd}
        variant='contained'
        startIcon={<AddIcon />}
        sx={{ margin: '0.5em' }}
    >
        {type}
    </Button>
)

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
                    draft._components = [...draft._components, component]
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
            {!readonly && (
                <Card sx={{ margin: 2 }}>
                    <CardHeader title="Metadata" />
                    <CardContent>
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
                    </CardContent>
                </Card>
            )}
            
            <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
                <Box sx={{ marginLeft: 2, width: "calc(100% - 16px)" }}>
                    <WorkbenchRecentlyVisited />
                    <Card sx={{ margin: 2 }}>
                        <CardHeader title="Components" />
                        <CardContent>
                            <List dense>
                                {characters.length
                                    ? characters.map((characterItem) => (
                                        <WorkbenchWMLComponentHeader
                                            key={characterItem.universalKey}
                                            ItemId={characterItem.universalKey!}
                                            onClick={() => handleComponentClick(characterItem.universalKey!)}
                                            icon={<PersonIcon />}
                                        />
                                    ))
                                    : null
                                }
                                {maps.length
                                    ? maps.map((mapItem) => (
                                        <WorkbenchWMLComponentHeader
                                            key={mapItem.universalKey}
                                            ItemId={mapItem.universalKey!}
                                            onClick={() => handleComponentClick(mapItem.universalKey!)}
                                            icon={<MapIcon />}
                                        />
                                    ))
                                    : null
                                }
                                {rooms.length
                                    ? rooms.map((room) => (
                                        <WorkbenchWMLComponentHeader
                                            key={room.universalKey}
                                            ItemId={room.universalKey!}
                                            onClick={() => handleComponentClick(room.universalKey!)}
                                        />
                                    ))
                                    : null
                                }
                                {features.length
                                    ? features.map((feature) => (
                                        <WorkbenchWMLComponentHeader
                                            key={feature.universalKey}
                                            ItemId={feature.universalKey!}
                                            onClick={() => handleComponentClick(feature.universalKey!)}
                                            icon={<FeatureIcon />}
                                        />
                                    ))
                                    : null
                                }
                                {knowledges.length
                                    ? knowledges.map((knowledge) => (
                                        <WorkbenchWMLComponentHeader
                                            key={knowledge.universalKey}
                                            ItemId={knowledge.universalKey!}
                                            onClick={() => handleComponentClick(knowledge.universalKey!)}
                                            icon={<KnowledgeIcon />}
                                        />
                                    ))
                                    : null
                                }
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
                            </List>
                        </CardContent>
                    </Card>
                </Box>
                <WorkbenchDraftLockout />
            </Box>
            
            {!readonly && (
                <Card sx={{ margin: 2 }}>
                    <CardHeader title="Add Component" />
                    <CardContent>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <AddWMLComponent type="Character" onAdd={addAsset('Character')} />
                            <AddWMLComponent type="Map" onAdd={addAsset('Map')} />
                            <AddWMLComponent type="Room" onAdd={addAsset('Room')} />
                            <AddWMLComponent type="Feature" onAdd={addAsset('Feature')} />
                            <AddWMLComponent type="Knowledge" onAdd={addAsset('Knowledge')} />
                            <AddWMLComponent type="Image" onAdd={addAsset('Image')} />
                            <Button
                                onClick={() => setImportDialogOpen(true)}
                                variant='contained'
                                startIcon={<ImportExportIcon />}
                                sx={{ margin: '0.5em' }}
                            >
                                Import Component
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            )}
            
            <WorkbenchImportComponentDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                assetId={AssetId}
            />
        </Box>
    )
}

export default WorkbenchAssetEditForm
