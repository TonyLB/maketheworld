import React, { FunctionComponent, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Typography, Box, Stack } from '@mui/material'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { getMyDraftAssets, getMyPersonalAssets } from '../../slices/player'
import AssetCard, { AssetWithMetadata } from '../Library/AssetCard'

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
 */
export const AssetSelector: FunctionComponent<AssetSelectorProps> = ({ onAssetSelect }) => {
    const draftAssets = useSelector(getMyDraftAssets)
    const personalAssets = useSelector(getMyPersonalAssets)

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
                <Typography variant="body2" color="text.secondary">
                    Create a draft asset to get started
                </Typography>
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
        </Stack>
    )
}

export default AssetSelector
