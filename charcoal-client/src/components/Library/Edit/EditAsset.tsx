import React, { FunctionComponent, useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    CircularProgress,
    Button,
    IconButton,
    List,
    ListSubheader,
    Typography,
    Divider
} from '@mui/material'

import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'

import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import {
    Routes,
    Route,
    useParams,
    useNavigate
} from "react-router-dom"

import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import {
    addItem,
    getStatus
} from '../../../slices/personalAssets'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'
import { getAssetZone } from '../../../slices/player'

import WMLEdit from './WMLEdit'
import WMLComponentHeader from './WMLComponentHeader'
import WMLComponentDetail from './WMLComponentDetail'
import MapEdit from '../../Maps/Edit'
import LibraryBanner from './LibraryBanner'
import LibraryAsset, { useLibraryAsset } from './LibraryAsset'
import ImageHeader from './ImageHeader'
import DraftLockout from './DraftLockout'
import { addOnboardingComplete } from '../../../slices/player/index.api'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { RecentlyVisited } from './RecentlyVisited'
import { LabelledIndentBox } from './LabelledIndentBox'
import { blue } from '@mui/material/colors'
import ImportComponentDialog from './ImportComponentDialog'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import EditCharacter from './EditCharacter'
import StandardLiteralEditor from './StandardLiteralEditor'
import StandardRenderEditor from './StandardRenderEditor'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { useDebouncedOnChange } from '../../../hooks/useDebounce'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { splitType, enforceTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { v4 as uuidv4 } from 'uuid'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

type AssetEditFormProps = {}

const AddWMLComponent: FunctionComponent<{ type: 'Theme' | 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image'; onAdd: () => void }> = ({ type, onAdd }) => (
    <Button
        onClick={onAdd}
        variant='contained'
        startIcon={<AddIcon />}
        sx={{ margin: '0.5em' }}
    >
        {type}
    </Button>
)

const AssetEditForm: FunctionComponent<AssetEditFormProps> = () => {
    const { updateStandard, standardForm, readonly, assetKey, AssetId } = useLibraryAsset()
    const zone = useSelector(getAssetZone(AssetId))
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: zone === 'Draft' })
    const navigate = useNavigate()

    // Asset-level metadata editing (ShortName and Summary) - only for drafts
    // Memoize to avoid creating new objects on every render when values are undefined
    const shortName = useMemo(() => 
        standardForm.shortName ?? new StandardLiteral(''), 
        [standardForm.shortName]
    )
    
    // Use local state for Summary to prevent value from being reset during editing
    // Similar pattern to ExampleEditor
    const [summary, setSummary] = useState(standardForm.summary ?? new StandardRender([]))
    const summaryRef = useRef(summary)
    
    // State for import dialog
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    
    // Update ref whenever summary changes
    useEffect(() => {
        summaryRef.current = summary
    }, [summary])
    
    // Sync local state when standardForm.summary changes (but only if different)
    // This ensures external updates (e.g., from server) are reflected, but doesn't
    // overwrite local edits that haven't been saved yet
    useEffect(() => {
        const newSummary = standardForm.summary ?? new StandardRender([])
        const currentSummary = summaryRef.current
        // Only update if the values are actually different to avoid unnecessary resets
        if (newSummary.toJSON() !== currentSummary.toJSON()) {
            setSummary(newSummary)
        }
    }, [standardForm.summary])
    
    // Extract display name for banner: use ShortName if available, otherwise extract UUID from universalKey
    const displayName = useMemo(() => 
        shortName._payload?.plain?.toJSON() || 
        standardForm.universalKey.replace('ASSET#', '').slice(0, 8) || 
        'Untitled',
        [shortName, standardForm.universalKey]
    )

    // Handle ShortName changes - StandardLiteralEditor handles its own debouncing
    const handleShortNameChange = useCallback((value: StandardLiteral) => {
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                draft._shortName = value._payload?.plain?.toJSON() ? value : undefined
                return draft
            }
        })
    }, [updateStandard])

    // Handle Summary changes - debounce updates to avoid excessive saves
    // StandardRenderEditor also has internal debouncing, but we debounce the updateStandard call here
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

    // Get top-level components from _topLevel ReferenceList (includes imported components without local keys)
    const topLevelComponents = useMemo<StandardComponent[]>(() => {
        if (!standardForm?._topLevel) return []
        return standardForm._topLevel.payload
            .map(ref => standardForm._lookup(ref))
            .filter((component): component is StandardComponent => component !== undefined)
    }, [standardForm])

    const characters = useMemo<StandardCharacter[]>(() => topLevelComponents.filter((component): component is StandardCharacter => component instanceof StandardCharacter), [topLevelComponents])
    const rooms = useMemo<StandardRoom[]>(() => topLevelComponents.filter((component): component is StandardRoom => component instanceof StandardRoom), [topLevelComponents])
    const features = useMemo<StandardFeature[]>(() => topLevelComponents.filter((component): component is StandardFeature => component instanceof StandardFeature), [topLevelComponents])
    const knowledges = useMemo<StandardKnowledge[]>(() => topLevelComponents.filter((component): component is StandardKnowledge => component instanceof StandardKnowledge), [topLevelComponents])
    const maps = useMemo<StandardMap[]>(() => topLevelComponents.filter((component): component is StandardMap => component instanceof StandardMap), [topLevelComponents])
    const images = useMemo<StandardImage[]>(() => topLevelComponents.filter((component): component is StandardImage => component instanceof StandardImage), [topLevelComponents])

    const dispatch = useDispatch()
    const addAsset = useCallback((tag: 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image') => () => {
        switch(tag) {
            case 'Room':
                dispatch(addOnboardingComplete(['addRoom']))
                break
        }
        updateStandard({
            type: 'update',
            update: (draft) => {
                // Generate UUID and construct universalKey using enforceTypedKey
                const tagUpper = tag.toUpperCase() as 'ROOM' | 'FEATURE' | 'KNOWLEDGE' | 'CHARACTER' | 'MAP' | 'IMAGE'
                const enforceKey = enforceTypedKey(tagUpper)
                const uuid = uuidv4()
                const universalKey = enforceKey(uuid) as ComponentUUID
                
                // Create component without local key - only universalKey
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
    return <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
        <LibraryBanner
            primary={displayName}
            secondary={'Asset'}
            commands={
                <React.Fragment>
                    <IconButton onClick={() => { navigate(`WML`) }}>
                        <TextSnippetIcon />
                    </IconButton>
                </React.Fragment>
            }
            breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    label: displayName
            }]}
        />
        { !readonly && (
            <Box sx={{ marginLeft: "20px", marginRight: "20px", marginTop: "1em", marginBottom: "1em" }}>
                <Typography variant="h6" sx={{ marginBottom: "0.5em" }}>Metadata</Typography>
                <Divider sx={{ marginBottom: "1em" }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Short Name</Typography>
                        <StandardLiteralEditor
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
                            <StandardRenderEditor
                                value={summary}
                                onChange={setSummary}
                                validLinkTags={[]}
                                toolbar={false}
                            />
                        </Box>
                    </Box>
                </Box>
                <Divider sx={{ marginTop: "1em" }} />
            </Box>
        )}
        <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
            <Box sx={{ marginLeft: "20px", width: "calc(100% - 20px)" }}>
                <RecentlyVisited />
                <List dense>
                    <ListSubheader>Components</ListSubheader>
                    { characters.length
                        ? characters.map((characterItem) => {
                            const uuid = characterItem.universalKey ? splitType(characterItem.universalKey)[1] : characterItem.key
                            return <WMLComponentHeader
                                key={characterItem.key}
                                ItemId={characterItem.universalKey!}
                                onClick={() => { navigate(`Character/${uuid}`)}}
                                icon={<PersonIcon />}
                            />
                        })
                        : null
                    }
                    { maps.length
                        ? maps.map((mapItem) => {
                            const uuid = mapItem.universalKey ? splitType(mapItem.universalKey)[1] : mapItem.key
                            return <WMLComponentHeader
                                key={mapItem.key}
                                ItemId={mapItem.universalKey!}
                                onClick={() => { navigate(`Map/${uuid}`)}}
                                icon={<MapIcon />}
                            />
                        })
                        : null
                    }
                    { rooms.length
                        ? rooms.map((room) => {
                            const uuid = room.universalKey ? splitType(room.universalKey)[1] : room.key
                            return <WMLComponentHeader
                                key={room.key}
                                ItemId={room.universalKey!}
                                onClick={() => { navigate(`Room/${uuid}`)}}
                            />
                        })
                        : null
                    }
                    { features.length
                        ? features.map((feature) => {
                            const uuid = feature.universalKey ? splitType(feature.universalKey)[1] : feature.key
                            return <WMLComponentHeader
                                key={feature.key}
                                ItemId={feature.universalKey!}
                                onClick={() => { navigate(`Feature/${uuid}`)}}
                                icon={<FeatureIcon />}
                            />
                        })
                        : null
                    }
                    { knowledges.length
                        ? knowledges.map((knowledge) => {
                            const uuid = knowledge.universalKey ? splitType(knowledge.universalKey)[1] : knowledge.key
                            return <WMLComponentHeader
                                key={knowledge.key}
                                ItemId={knowledge.universalKey!}
                                onClick={() => { navigate(`Knowledge/${uuid}`)}}
                                icon={<KnowledgeIcon />}
                            />
                        })
                        : null
                    }
                    { images.length
                        ? images.map((image) => (<ImageHeader
                                key={image.key}
                                ItemId={image.universalKey ?? ''}
                                onClick={() => {}}
                            />))
                        : null
                    }
                </List>
            </Box>
            <DraftLockout />
        </Box>
        { !readonly &&
            <LabelledIndentBox label="Add Component" color={blue}>
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
            </LabelledIndentBox>
        }
        <ImportComponentDialog
            open={importDialogOpen}
            onClose={() => setImportDialogOpen(false)}
            assetId={AssetId}
        />
    </Box>
}

type EditAssetProps = {}

export const EditAsset: FunctionComponent<EditAssetProps> = () => {

    const { AssetId: assetKey = 'draft' } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}` as const
    // Use real AssetUUID for navigation - no special case for 'draft'
    const href = `/Library/Edit/Asset/${assetKey}`
    useAutoPin({
        href,
        label: `${assetKey}`,
        type: 'LibraryEdit',
        iconName: 'Asset',
        assetId: AssetId,
        cascadingClose: true
    })
    const dispatch = useDispatch()
    const currentStatus = useSelector(getStatus(AssetId))
    
    useEffect(() => {
        if (assetKey) {
            dispatch(addItem({ key: `ASSET#${assetKey}` }))
            dispatch(heartbeat)
        }
    }, [dispatch, assetKey])

    return <React.Fragment>
        {
            (['FRESH', 'WMLDIRTY', 'SCHEMADIRTY', 'NEEDERROR', 'DRAFTERROR', 'NEEDPARSE', 'PARSEDRAFT'].includes(currentStatus || ''))
                ? 
                    <LibraryAsset assetKey={assetKey || ''}>
                        <Routes>
                            <Route path={'WML'} element={<WMLEdit />} />
                            <Route path={'Map/:MapId'} element={<MapEdit />} />
                            <Route path={'Character/:ComponentId'} element={<EditCharacter />} />
                            <Route path={'Room/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Feature/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={'Knowledge/:ComponentId'} element={<WMLComponentDetail />} />
                            <Route path={''} element={<AssetEditForm />} />
                        </Routes>
                    </LibraryAsset>
                    
                : <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><div><CircularProgress /></div></div>
        }
    </React.Fragment>

}

export default EditAsset
