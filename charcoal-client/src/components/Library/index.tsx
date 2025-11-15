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
    CircularProgress,
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
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

interface PersonalAssetCardsProps {
    Assets: AssetWithMetadata[];
    selectedAssetId?: string;
    onAssetClick: (asset: AssetWithMetadata) => void;
    onCreateDraft?: () => void;
    onPurgeAsset?: (asset: AssetWithMetadata) => void;
    isDraftsTab: boolean;
    draftAssetIdBeingAdded?: AssetUUID;
    draftAssetIdsBeingDeleted?: Record<AssetUUID, NodeJS.Timeout>;
}

interface CreateDraftPlaceholderProps {
    onClick: () => void | Promise<void>;
    disabled?: boolean;
}

const CreateDraftPlaceholder: FunctionComponent<CreateDraftPlaceholderProps> = ({ onClick, disabled = false }) => {
    return (
        <Card 
            sx={{ 
                height: '100%',
                border: 2,
                borderStyle: 'dashed',
                borderColor: disabled ? 'action.disabled' : 'divider',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1
            }}
        >
            <CardActionArea 
                onClick={disabled ? undefined : onClick} 
                disabled={disabled}
                sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 150 }}
            >
                <CardContent sx={{ textAlign: 'center' }}>
                    <AddIcon sx={{ fontSize: 48, color: disabled ? 'action.disabled' : 'text.secondary', marginBottom: 1 }} />
                    <Typography variant="h6" color={disabled ? 'action.disabled' : 'text.secondary'}>
                        New Draft
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    )
}

interface DraftInProgressCardProps {
    assetId: AssetUUID;
}

const DraftInProgressCard: FunctionComponent<DraftInProgressCardProps> = ({ assetId }) => {
    return (
        <Card 
            sx={{ 
                height: '100%',
                border: 2,
                borderStyle: 'solid',
                borderColor: 'primary.main',
                backgroundColor: 'action.hover'
            }}
        >
            <CardContent sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 150 }}>
                <CircularProgress size={48} sx={{ marginBottom: 2, color: 'primary.main' }} />
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                    Creating Draft...
                </Typography>
            </CardContent>
        </Card>
    )
}

const PersonalAssetCards: FunctionComponent<PersonalAssetCardsProps> = ({ 
    Assets, 
    selectedAssetId,
    onAssetClick,
    onCreateDraft,
    onPurgeAsset,
    isDraftsTab,
    draftAssetIdBeingAdded,
    draftAssetIdsBeingDeleted
}) => {
    return (
        <Grid container spacing={2}>
            {Assets.map((asset) => {
                const normalizedAssetId = AssetKey(asset.AssetId)
                const isDeleting = normalizedAssetId in (draftAssetIdsBeingDeleted ?? {})
                return (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={asset.AssetId}>
                        <AssetCard
                            asset={asset}
                            onClick={() => onAssetClick(asset)}
                            isSelected={selectedAssetId === asset.AssetId}
                            onPurge={isDraftsTab && onPurgeAsset ? () => onPurgeAsset(asset) : undefined}
                            isDeleting={isDeleting}
                        />
                    </Grid>
                )
            })}
            {/* Show in-progress card if a draft is being added */}
            {isDraftsTab && draftAssetIdBeingAdded && (
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <DraftInProgressCard assetId={draftAssetIdBeingAdded} />
                </Grid>
            )}
            {/* Show placeholder only in Drafts tab, at the end of the list */}
            {isDraftsTab && onCreateDraft && (
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <CreateDraftPlaceholder onClick={onCreateDraft} disabled={!!draftAssetIdBeingAdded} />
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

    // Track draft asset being added for optimistic UI updates
    const [draftAssetIdBeingAdded, setDraftAssetIdBeingAdded] = React.useState<AssetUUID | undefined>(undefined)

    // Track draft assets being deleted for optimistic UI updates
    // Record maps AssetUUID to timeout ID, allowing per-asset timeout management
    const [draftAssetIdsBeingDeleted, setDraftAssetIdsBeingDeleted] = React.useState<Record<AssetUUID, NodeJS.Timeout>>({})

    // Clear draftAssetIdBeingAdded when the asset appears in DraftAssets (successful round-trip)
    useEffect(() => {
        if (draftAssetIdBeingAdded) {
            const assetExists = DraftAssets.some(asset => AssetKey(asset.AssetId) === draftAssetIdBeingAdded)
            if (assetExists) {
                setDraftAssetIdBeingAdded(undefined)
            }
        }
    }, [DraftAssets, draftAssetIdBeingAdded])

    // Clear draftAssetIdBeingAdded after 10 seconds as a fallback
    // Note: This effect only depends on draftAssetIdBeingAdded (not DraftAssets) to ensure
    // the timeout doesn't get reset when DraftAssets changes for unrelated reasons.
    // The timeout will only be cleared if draftAssetIdBeingAdded changes or the component unmounts.
    useEffect(() => {
        if (draftAssetIdBeingAdded) {
            const timeout = setTimeout(() => {
                setDraftAssetIdBeingAdded(undefined)
            }, 10000)
            return () => clearTimeout(timeout)
        }
    }, [draftAssetIdBeingAdded])

    // Clear draftAssetIdsBeingDeleted when drafts disappear from DraftAssets (successful deletion)
    useEffect(() => {
        const deletionKeys = Object.keys(draftAssetIdsBeingDeleted) as AssetUUID[]
        if (deletionKeys.length > 0) {
            // Find which drafts in the deletion record are no longer in DraftAssets
            const currentAssetIds = new Set(DraftAssets.map(asset => AssetKey(asset.AssetId)))
            const stillExist = deletionKeys.filter(id => currentAssetIds.has(id))
            
            // If any drafts were removed, clear their timeouts and remove from record
            if (stillExist.length !== deletionKeys.length) {
                setDraftAssetIdsBeingDeleted(prev => {
                    const next: Record<AssetUUID, NodeJS.Timeout> = {}
                    // Clear timeouts for removed assets
                    deletionKeys.forEach(id => {
                        if (stillExist.includes(id)) {
                            next[id] = prev[id]
                        } else {
                            clearTimeout(prev[id])
                        }
                    })
                    return next
                })
            }
        }
    }, [DraftAssets, draftAssetIdsBeingDeleted])

    // Cleanup all timeouts on unmount
    useEffect(() => {
        return () => {
            Object.values(draftAssetIdsBeingDeleted).forEach(timeout => clearTimeout(timeout))
        }
    }, [draftAssetIdsBeingDeleted])

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
        
        // Optimistically update UI to show in-progress state
        setDraftAssetIdBeingAdded(assetId)
        
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
            // The draftAssetIdBeingAdded state will be cleared automatically when the asset appears
            // in DraftAssets or after 10 seconds as a fallback.
        } catch (error) {
            console.error('Failed to create draft:', error)
            // Clear the optimistic state on error
            setDraftAssetIdBeingAdded(undefined)
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

        // Optimistically mark as being deleted and set up timeout
        const timeout = setTimeout(() => {
            setDraftAssetIdsBeingDeleted(prev => {
                const next = { ...prev }
                delete next[normalizedAssetId]
                return next
            })
        }, 10000)
        setDraftAssetIdsBeingDeleted(prev => ({
            ...prev,
            [normalizedAssetId]: timeout
        }))

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
            // Note: The draftAssetIdsBeingDeleted state will be cleared automatically when the draft
            // disappears from DraftAssets or after 10 seconds as a fallback.
        } catch (error) {
            dispatch(push('Failed to purge draft.'))
            console.error('Failed to purge asset', error)
            // Clear the optimistic state on error (clear timeout and remove from record)
            setDraftAssetIdsBeingDeleted(prev => {
                const next = { ...prev }
                if (next[normalizedAssetId]) {
                    clearTimeout(next[normalizedAssetId])
                    delete next[normalizedAssetId]
                }
                return next
            })
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
                    draftAssetIdBeingAdded={draftAssetIdBeingAdded}
                    draftAssetIdsBeingDeleted={draftAssetIdsBeingDeleted}
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
