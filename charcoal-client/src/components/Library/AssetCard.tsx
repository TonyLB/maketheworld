import React, { FunctionComponent } from 'react'
import {
    Avatar,
    Box,
    Card,
    CardActionArea,
    CardContent,
    Typography
} from '@mui/material'
import AssetIcon from '@mui/icons-material/Landscape'
import { AssetClientPlayerAsset } from '@tonylb/mtw-interfaces/ts/asset'
import { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

// Extended type to include fields added in Phase 1
// ShortName/Summary are stored in DynamoDB as serialized data:
// - ShortName: string (from StandardLiteral.toJSON())
// - Summary: RenderTree (from StandardRender.toJSON())
export type AssetWithMetadata = AssetClientPlayerAsset & {
    zone?: Zone;
    ShortName?: string;  // Serialized format from StandardLiteral.toJSON()
    Summary?: RenderTree;  // Serialized format from StandardRender.toJSON()
}

export interface AssetCardProps {
    asset: AssetWithMetadata;
    onClick: () => void;
    isSelected?: boolean;
}

const AssetCard: FunctionComponent<AssetCardProps> = ({ asset, onClick, isSelected }) => {
    const { AssetId, ShortName, Summary } = asset
    
    // Extract UUID from AssetId (remove ASSET# prefix)
    const assetUuid = AssetId.replace('ASSET#', '')
    
    // ShortName is already a string (serialized from StandardLiteral.toJSON())
    const displayName = ShortName || `Untitled ${assetUuid.slice(0, 8)}...`

    // Summary is a RenderTree array - extract text content for display
    // RenderTree is RenderTreeNode[] where RenderTreeNode can be string or {data, children}
    const summaryString = Summary && Array.isArray(Summary)
        ? Summary.map((node: any) => {
            if (typeof node === 'string') {
                return node
            }
            // For object nodes, extract text from data or children recursively
            if (node?.data?.tag === 'String' && typeof node.data.value === 'string') {
                return node.data.value
            }
            // Recursively extract from children if present
            if (node?.children && Array.isArray(node.children)) {
                return node.children.map((child: any) => 
                    typeof child === 'string' ? child : child?.data?.value || ''
                ).join('')
            }
            return ''
        }).join('')
        : undefined

    return (
        <Card 
            sx={{ 
                height: '100%',
                border: isSelected ? 2 : 1,
                borderColor: isSelected ? 'primary.main' : 'divider'
            }}
        >
            <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
                        <Avatar variant="rounded" sx={{ marginRight: 1 }}>
                            <AssetIcon />
                        </Avatar>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            {displayName}
                        </Typography>
                    </Box>
                    {summaryString && (
                        <Typography variant="body2" color="text.secondary" sx={{ marginTop: 1 }}>
                            {summaryString}
                        </Typography>
                    )}
                </CardContent>
            </CardActionArea>
        </Card>
    )
}

export default AssetCard

