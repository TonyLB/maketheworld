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
import { StandardEditableData } from '@tonylb/mtw-base/ts/editable'

export type AssetWithMetadata = AssetClientPlayerAsset & {
    zone?: Zone;
    ShortName?: string;  // Serialized format from StandardLiteral.toJSON()
    Summary?: StandardEditableData<RenderTree>;  // Serialized format from StandardRender.toJSON()
}

export interface AssetCardProps {
    asset: AssetWithMetadata;
    onClick: () => void;
    isSelected?: boolean;
    onPurge?: () => void;
    isDeleting?: boolean;
}

const AssetCard: FunctionComponent<AssetCardProps> = ({ asset, onClick, isSelected, onPurge, isDeleting = false }) => {
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
                borderColor: isSelected ? 'primary.main' : 'divider',
                opacity: isDeleting ? 0.5 : 1,
                position: 'relative'
            }}
        >
            <CardActionArea 
                onClick={isDeleting ? undefined : onClick} 
                disabled={isDeleting}
                sx={{ flexGrow: 1, alignSelf: 'stretch' }}
            >
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Avatar variant="rounded" sx={{ marginRight: 1, opacity: isDeleting ? 0.5 : 1 }}>
                            <AssetIcon />
                        </Avatar>
                        <Typography 
                            variant="h6" 
                            component="div" 
                            sx={{ 
                                flexGrow: 1,
                                textDecoration: isDeleting ? 'line-through' : 'none',
                                color: isDeleting ? 'text.disabled' : 'inherit',
                                minWidth: 0
                            }}
                        >
                            {displayName}
                        </Typography>
                        {isDeleting && (
                            <Typography variant="caption" color="error.main" sx={{ marginLeft: 1 }}>
                                Deleting...
                            </Typography>
                        )}
                        {onPurge && (
                            <Button
                                size="small"
                                color="primary"
                                variant="outlined"
                                startIcon={<DeleteForeverIcon />}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onPurge()
                                }}
                                sx={{ flexShrink: 0 }}
                            >
                                Discard
                            </Button>
                        )}
                    </Box>
                    {summaryString && (
                        <Typography 
                            variant="body2" 
                            color={isDeleting ? 'text.disabled' : 'text.secondary'} 
                            sx={{ marginTop: 1 }}
                        >
                            {summaryString}
                        </Typography>
                    )}
                </CardContent>
            </CardActionArea>
        </Card>
    )
}

export default AssetCard

