import React, { FunctionComponent } from 'react'
import {
    Avatar,
    Box,
    Card,
    CardActionArea,
    CardActions,
    CardContent,
    Button,
    Typography
} from '@mui/material'
import AssetIcon from '@mui/icons-material/Landscape'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
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
    onPurge?: () => void;
}

const AssetCard: FunctionComponent<AssetCardProps> = ({ asset, onClick, isSelected, onPurge }) => {
    const { AssetId, ShortName, Summary } = asset
    
    // ShortName is already a string (serialized from StandardLiteral.toJSON())
    const displayName = ShortName || 'Untitled'

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
                display: 'flex',
                flexDirection: 'column',
                border: isSelected ? 2 : 1,
                borderColor: isSelected ? 'primary.main' : 'divider'
            }}
        >
            <CardActionArea onClick={onClick} sx={{ flexGrow: 1, alignSelf: 'stretch' }}>
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
            {onPurge && (
                <CardActions sx={{ justifyContent: 'flex-end', paddingTop: 0 }}>
                    <Button
                        size="small"
                        color="primary"
                        variant="outlined"
                        startIcon={<DeleteForeverIcon />}
                        onClick={(event) => {
                            event.stopPropagation()
                            onPurge()
                        }}
                    >
                        Discard
                    </Button>
                </CardActions>
            )}
        </Card>
    )
}

export default AssetCard

