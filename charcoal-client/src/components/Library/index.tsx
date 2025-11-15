import React, { FunctionComponent, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

import {
    Avatar,
    Box,
    Card,
    CardActionArea,
    CardContent,
    Divider,
    Grid,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Tabs,
    Tab,
    Typography
} from '@mui/material'

import AssetIcon from '@mui/icons-material/Landscape'
import AddIcon from '@mui/icons-material/Add'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { getMyCharacters, getMyDraftAssets, getMyPersonalAssets } from '../../slices/player'
import { subscribeToLibrary, unsubscribeFromLibrary, getIsLibrarySubscribed, getLibraryAssetIds } from '../../slices/libraryDataSource'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { addItem } from '../../slices/personalAssets'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { ApplyEditAPIMessage, PurgeAssetAPIMessage } from '@tonylb/mtw-interfaces/ts/wml'

import { CharacterAvatarDirect } from '../CharacterAvatar'
import PreviewPane, { PreviewPaneContents } from './PreviewPane'
import { AssetClientPlayerAsset, AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/ts/asset'
import AssetCard, { AssetWithMetadata } from './AssetCard'
import useOnboarding, { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { push } from '../../slices/UI/feedback'
import AddAsset from './Edit/AddAsset'

interface PersonalAssetCardsProps {
    Assets: AssetWithMetadata[];
    selectedAssetId?: string;
    onAssetClick: (asset: AssetWithMetadata) => void;
    onCreateDraft?: () => void;
    onPurgeAsset?: (asset: AssetWithMetadata) => void;
    isDraftsTab: boolean;
}

interface CreateDraftPlaceholderProps {
    onClick: () => void | Promise<void>;
}

const CreateDraftPlaceholder: FunctionComponent<CreateDraftPlaceholderProps> = ({ onClick }) => {
    return (
        <Card 
            sx={{ 
                height: '100%',
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
                cursor: 'pointer'
            }}
        >
            <CardActionArea onClick={onClick} sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 150 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                    <AddIcon sx={{ fontSize: 48, color: 'text.secondary', marginBottom: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                        New Draft
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    )
}

const PersonalAssetCards: FunctionComponent<PersonalAssetCardsProps> = ({ 
    Assets, 
    selectedAssetId,
    onAssetClick,
    onCreateDraft,
    onPurgeAsset,
    isDraftsTab 
}) => {
    return (
        <Grid container spacing={2}>
            {Assets.map((asset) => {
                const assetUuid = asset.AssetId.replace('ASSET#', '')
                return (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={asset.AssetId}>
                        <AssetCard
                            asset={asset}
                            onClick={() => onAssetClick(asset)}
                            isSelected={selectedAssetId === asset.AssetId}
                            onPurge={isDraftsTab && onPurgeAsset ? () => onPurgeAsset(asset) : undefined}
                        />
                    </Grid>
                )
            })}
            {/* Show placeholder only in Drafts tab, at the end of the list */}
            {isDraftsTab && onCreateDraft && (
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <CreateDraftPlaceholder onClick={onCreateDraft} />
                </Grid>
            )}
        </Grid>
    )
}

interface TableOfContentsProps {
    Characters: AssetClientPlayerCharacter[];
    Assets: AssetClientPlayerAsset[];
    selectItem: (index: number) => void;
    selectedIndex?: number;
    setPreviewItem: (item: undefined | PreviewPaneContents) => void;
    showAddButtons: boolean;
}

const TableOfContents: FunctionComponent<TableOfContentsProps> = ({ Characters = [], Assets = [], selectItem = () => {}, selectedIndex, setPreviewItem = () => {}, showAddButtons }) => {
    const handleListItemClick = (event: any, index: number) => {
        selectItem(index)
        if (index >= Assets.length) {
            if ((index - Assets.length) < Characters.length) {
                setPreviewItem({
                    type: 'Character',
                    ...Characters[index-Assets.length]
                })
            }
        }
        else {
            setPreviewItem({
                type: 'Asset',
                ...Assets[index]
            })
        }
    }
    return <List component="nav" aria-label="main library assets">
        { (Assets.length > 0) && <ListSubheader>Assets</ListSubheader> }
        { Assets.map(({ AssetId }, index) => (
            <ListItemButton
                key={AssetId}
                selected={selectedIndex === index}
                onClick={(event) => handleListItemClick(event, index)}
            >
                <ListItemIcon>
                    <Avatar variant="rounded">
                        <AssetIcon />
                    </Avatar>
                </ListItemIcon>
                <ListItemText primary={ AssetId } />
            </ListItemButton>
        ))}
        { showAddButtons && <AddAsset type="Asset" onAdd={() => {}} /> }
        { (Characters.length > 0) && <ListSubheader>Characters</ListSubheader> }
        { Characters.map(({ CharacterId, Name, fileURL }, index) => (
            <ListItemButton
                key={CharacterId}
                selected={selectedIndex === (index + Assets.length)}
                onClick={(event) => handleListItemClick(event, (index + Assets.length))}
            >
                <ListItemIcon>
                    <CharacterAvatarDirect CharacterId={CharacterId} Name={Name} fileURL={fileURL} />
                </ListItemIcon>
                <ListItemText primary={ Name || CharacterId } />
            </ListItemButton>
        ))}
        { showAddButtons && <AddAsset type="Character" onAdd={() => {}} /> }
    </List>
}

interface LibraryProps {

}

export const Library: FunctionComponent<LibraryProps> = () => {
    useOnboardingCheckpoint('navigateLibrary')
    useOnboardingCheckpoint('navigateLibraryAfterAsset', { requireSequence: true })
    const dispatch = useDispatch()
    const isLibrarySubscribed = useSelector(getIsLibrarySubscribed)
    
    // Subscribe to library DataSource - only when component is mounted and not already subscribed
    useEffect(() => {
        if (!isLibrarySubscribed) {
            dispatch(subscribeToLibrary())
        }
        // Optionally unsubscribe on unmount to save resources
        // Note: Keeping subscription active for now to avoid re-subscription on navigation
        // return () => {
        //     dispatch(unsubscribeFromLibrary())
        // }
    }, [dispatch, isLibrarySubscribed])
    const [selectedPersonalIndex, setSelectedPersonalIndex] = React.useState<undefined | number>()
    const [personalPreviewItem, setPersonalPreviewItem] = React.useState<undefined | PreviewPaneContents>()
    const clearPersonalPreview = () => {
        setSelectedPersonalIndex(undefined)
        setPersonalPreviewItem(undefined)
    }
    const [selectedLibraryIndex, setSelectedLibraryIndex] = React.useState<undefined | number>()
    const [libraryPreviewItem, setLibraryPreviewItem] = React.useState<undefined | PreviewPaneContents>()
    const clearLibraryPreview = () => {
        setSelectedLibraryIndex(undefined)
        setLibraryPreviewItem(undefined)
    }
    useAutoPin({ href: `/Library/`, label: `Library`, iconName: 'Library', type: 'Library' })
    const navigate = useNavigate()
    const DraftAssets = useSelector(getMyDraftAssets)
    const PersonalAssets = useSelector(getMyPersonalAssets)
    // Get asset IDs from new libraryDataSource slice
    const libraryAssetIds = useSelector(getLibraryAssetIds)
    const libraryAssets = libraryAssetIds.map(id => ({ AssetId: id }))
    
    const [personalTabValue, setPersonalTabValue] = React.useState(0)
    const handlePersonalTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setPersonalTabValue(newValue)
        // Clear selection when switching tabs
        setSelectedPersonalIndex(undefined)
        setPersonalPreviewItem(undefined)
    }

    // Determine which assets to show based on selected tab
    const currentPersonalAssets = personalTabValue === 0 ? DraftAssets : PersonalAssets
    const isDraftsTab = personalTabValue === 0

    // Handle asset card click - navigate based on zone
    const handleAssetClick = (asset: AssetWithMetadata) => {
        const assetUuid = asset.AssetId.replace('ASSET#', '')
        const zone = asset.zone || (isDraftsTab ? 'Draft' : 'Personal')
        
        // Set preview for preview pane
        setPersonalPreviewItem({
            type: 'Asset',
            ...asset
        })
        
        // Navigate based on zone: Drafts → Edit mode, Personal → View mode (via preview pane for now)
        if (zone === 'Draft') {
            navigate(`/Library/Edit/Asset/${assetUuid}/`)
        }
        // For Personal assets, we show the preview pane (view mode)
        // Navigation to full edit could be added via preview pane button if needed
    }

    // Handle creating a new draft
    const handleCreateDraft = async () => {
        // Generate new UUID for the draft
        const draftUuid = uuidv4()
        const assetId = `ASSET#${draftUuid}` as const
        
        // Create minimal empty Asset WML structure
        const schema = new Schema()
        schema._schema = [{
            data: {
                tag: 'Asset',
                uuid: assetId,
                Story: undefined
            },
            children: []
        }]
        const seedWML = schemaToWML(schema.schema)
        
        // Generate request ID for the applyEdit call
        const requestId = uuidv4()
        
        try {
            // Create the draft via applyEdit with createIfNeeded and zone
            const applyEditMessage: ApplyEditAPIMessage & { RequestId: string } = {
                message: 'applyEdit',
                RequestId: requestId,
                AssetId: assetId,
                schema: seedWML,
                createIfNeeded: true,
                zone: 'Draft'
            }
            await dispatch(socketDispatchPromise(applyEditMessage, { service: 'wml' }))
            
            // Subscribe to the new asset in personalAssets slice
            dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
            
            // Note: We don't navigate automatically here. The draft will appear in the list
            // once the mtw.assets.players data source completes its round-trip and populates
            // the assets space. The user can then click on the draft card to navigate to edit mode.
        } catch (error) {
            console.error('Failed to create draft:', error)
            // TODO: Show error feedback to user
        }
    }

    const handlePurgeAsset = async (asset: AssetWithMetadata) => {
        const { AssetId, zone } = asset
        const normalizedAssetId = AssetKey(AssetId) as EphemeraAssetId
        const inferredZone = zone ?? (isDraftsTab ? 'Draft' : undefined)
        if (!inferredZone || (inferredZone !== 'Draft' && inferredZone !== 'Archive')) {
            dispatch(push('Asset cannot be purged from this zone.'))
            return
        }

        const confirm = window.confirm('Permanently delete this draft? This cannot be undone.')
        if (!confirm) {
            return
        }

        const purgeMessage: PurgeAssetAPIMessage = {
            message: 'purgeAsset',
            AssetId: normalizedAssetId,
            expectedZone: inferredZone,
            requireExists: true
        }

        try {
            await dispatch(socketDispatchPromise(purgeMessage, { service: 'wml' }))
            dispatch(push('Draft purge started.'))
            if (selectedPersonalIndex !== undefined && currentPersonalAssets[selectedPersonalIndex]?.AssetId === AssetId) {
                clearPersonalPreview()
            }
        } catch (error) {
            dispatch(push('Failed to purge draft.'))
            console.error('Failed to purge asset', error)
        }
    }

    const selectedPersonalAssetId = personalPreviewItem?.type === 'Asset' ? personalPreviewItem.AssetId : undefined

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Personal</h2>
            <Divider />
        </div>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: 2 }}>
            <Tabs value={personalTabValue} onChange={handlePersonalTabChange} aria-label="personal assets tabs">
                <Tab label="Drafts" />
                <Tab label="Assets" />
            </Tabs>
        </Box>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="center"
            alignItems="flex-start"
            spacing={3}
        >
            <Grid size={{ xs: 6 }}>
                <PersonalAssetCards
                    Assets={currentPersonalAssets as AssetWithMetadata[]}
                    selectedAssetId={selectedPersonalAssetId}
                    onAssetClick={handleAssetClick}
                    onCreateDraft={handleCreateDraft}
                    onPurgeAsset={isDraftsTab ? handlePurgeAsset : undefined}
                    isDraftsTab={isDraftsTab}
                />
            </Grid>
            <Grid size={{ xs: 6 }}>
                { personalPreviewItem &&
                    <PreviewPane
                        clearPreview={clearPersonalPreview}
                        personal={true}
                        {...personalPreviewItem}
                    />
                }
            </Grid>
        </Grid>
        <div style={{ textAlign: "center" }}>
            <Divider />
            <h2>Public</h2>
            <Divider />
        </div>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="space-evenly"
            alignItems="center"
            spacing={3}
        >
            <Grid size={{ xs: 6 }}>
                <TableOfContents
                    Characters={[]}
                    Assets={libraryAssets}
                    selectItem={setSelectedLibraryIndex}
                    selectedIndex={selectedLibraryIndex}
                    setPreviewItem={setLibraryPreviewItem}
                    showAddButtons={false}
                />
            </Grid>
            <Grid size={{ xs: 6 }}>
            { libraryPreviewItem &&
                    <PreviewPane
                        clearPreview={clearLibraryPreview}
                        personal={false}
                        {...libraryPreviewItem}
                    />
                }
            </Grid>
        </Grid>
    </Box>
}

export default Library
