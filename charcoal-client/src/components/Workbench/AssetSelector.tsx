import React, { FunctionComponent, useMemo, useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Typography, Box, Stack, Card, CardActionArea, CardContent, CircularProgress } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { v4 as uuidv4 } from 'uuid'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { getMyDraftAssets, getMyPersonalAssets } from '../../slices/player'
import AssetCard, { AssetWithMetadata } from '../Library/AssetCard'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { addItem } from '../../slices/personalAssets'
import { Schema, schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { ApplyEditAPIMessage } from '@tonylb/mtw-interfaces/ts/wml'
import { push } from '../../slices/UI/feedback'

interface AssetSelectorProps {
    onAssetSelect: (assetId: AssetUUID) => void;
}

/**
 * Asset selector component for workbench.
 * 
 * Displays available draft and personal assets in a vertical list layout
 * (full-width cards), allowing users to select an asset to work on in the workbench.
 * 
 * Uses full-width cards to leave room for editing affordances and provide
 * better vertical space utilization in the workbench context.
 * 
 * When no assets are available, shows an empty state message.
 * 
 * Includes "Add asset" button to create new draft assets directly from the workbench.
 */
export const AssetSelector: FunctionComponent<AssetSelectorProps> = ({ onAssetSelect }) => {
    const dispatch = useDispatch()
    const draftAssets = useSelector(getMyDraftAssets)
    const personalAssets = useSelector(getMyPersonalAssets)

    // Track draft asset being added for optimistic UI updates and auto-selection
    const [draftAssetIdBeingAdded, setDraftAssetIdBeingAdded] = useState<AssetUUID | undefined>(undefined)

    // Combine assets: drafts first, then personal assets
    const allAssets = useMemo(() => {
        return [
            ...draftAssets.map(asset => ({ ...asset, zone: 'Draft' as const })),
            ...personalAssets.map(asset => ({ ...asset, zone: 'Personal' as const }))
        ] as AssetWithMetadata[]
    }, [draftAssets, personalAssets])

    const handleAssetClick = (asset: AssetWithMetadata) => {
        // Extract AssetUUID from AssetId
        // AssetId can be 'ASSET#uuid' or just 'uuid'
        // Use AssetKey to normalize to 'ASSET#uuid' format
        const assetKey = AssetKey(asset.AssetId)
        // AssetUUID in workbench context is the full 'ASSET#uuid' format
        // (matching what getStandardForm and getAssetZone expect)
        const assetUuid = assetKey as AssetUUID
        onAssetSelect(assetUuid)
    }

    // Handle creating a new draft asset
    const handleCreateAsset = useCallback(async () => {
        // Prevent duplicate creation requests
        if (draftAssetIdBeingAdded) {
            return
        }

        // Generate new UUID for the draft
        const draftUuid = uuidv4()
        const assetId = `ASSET#${draftUuid}` as AssetUUID
        
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
            await dispatch(socketDispatchPromise(applyEditMessage, { service: 'wml' }) as any)
            
            // Subscribe to the new asset in personalAssets slice
            dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
            
            // Note: Auto-selection will happen via useEffect when the asset appears in DraftAssets
        } catch (error) {
            console.error('Failed to create draft:', error)
            // Clear the optimistic state on error
            setDraftAssetIdBeingAdded(undefined)
            // Show error feedback to user
            dispatch(push('Failed to create asset. Please try again.'))
        }
    }, [dispatch, draftAssetIdBeingAdded])

    // Auto-select new asset when it appears in DraftAssets
    useEffect(() => {
        if (draftAssetIdBeingAdded) {
            const assetExists = draftAssets.some(asset => AssetKey(asset.AssetId) === draftAssetIdBeingAdded)
            if (assetExists) {
                // Asset has appeared, auto-select it
                onAssetSelect(draftAssetIdBeingAdded)
                // Clear the optimistic state
                setDraftAssetIdBeingAdded(undefined)
            }
        }
    }, [draftAssets, draftAssetIdBeingAdded, onAssetSelect])

    // Clear draftAssetIdBeingAdded after 10 seconds as a fallback
    // Note: This effect only depends on draftAssetIdBeingAdded (not DraftAssets) to ensure
    // the timeout doesn't get reset when DraftAssets changes for unrelated reasons.
    useEffect(() => {
        if (draftAssetIdBeingAdded) {
            const timeout = setTimeout(() => {
                setDraftAssetIdBeingAdded(undefined)
            }, 10000)
            return () => clearTimeout(timeout)
        }
    }, [draftAssetIdBeingAdded])

    // CreateDraftPlaceholder component for "Add asset" button
    const CreateDraftPlaceholder: FunctionComponent<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled = false }) => {
        return (
            <Card 
                sx={{ 
                    width: '100%',
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
                    sx={{ 
                        minHeight: 150,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: 2
                    }}
                >
                    <CardContent sx={{ textAlign: 'center', width: '100%' }}>
                        {disabled ? (
                            <CircularProgress size={24} sx={{ marginBottom: 1 }} />
                        ) : (
                            <AddIcon sx={{ fontSize: 48, color: 'text.secondary', marginBottom: 1 }} />
                        )}
                        <Typography variant="h6" color={disabled ? 'action.disabled' : 'text.secondary'}>
                            Add asset
                        </Typography>
                    </CardContent>
                </CardActionArea>
            </Card>
        )
    }

    if (allAssets.length === 0) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 200,
                    textAlign: 'center',
                    padding: 4
                }}
            >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    No assets available
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Create a draft asset to get started
                </Typography>
                <Box sx={{ width: '100%', maxWidth: 400 }}>
                    <CreateDraftPlaceholder 
                        onClick={handleCreateAsset} 
                        disabled={!!draftAssetIdBeingAdded} 
                    />
                </Box>
            </Box>
        )
    }

    return (
        <Stack spacing={2}>
            {allAssets.map((asset) => {
                return (
                    <Box key={asset.AssetId} sx={{ width: '100%' }}>
                        <AssetCard
                            asset={asset}
                            onClick={() => handleAssetClick(asset)}
                            isSelected={false}
                        />
                    </Box>
                )
            })}
            {/* "Add asset" button at the bottom of the list */}
            <CreateDraftPlaceholder 
                onClick={handleCreateAsset} 
                disabled={!!draftAssetIdBeingAdded} 
            />
        </Stack>
    )
}

export default AssetSelector
