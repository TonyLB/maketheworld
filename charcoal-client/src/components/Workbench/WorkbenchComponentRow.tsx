import React, { FunctionComponent, ReactChild, useCallback, useMemo } from 'react'
import {
    Box,
    IconButton,
    Typography,
    SxProps,
    useTheme
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import DeleteIcon from '@mui/icons-material/Delete'
import CallMadeIcon from '@mui/icons-material/CallMade'

import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { hasName, hasShortName } from '@tonylb/mtw-wml/ts/standardize'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

interface WorkbenchComponentRowProps {
    ItemId: ComponentUUID;
    onClick: () => void;
    icon?: ReactChild;
    sx?: SxProps;
    selected?: boolean;
    isEven?: boolean;
}

const ComponentName: FunctionComponent<{ itemId: ComponentUUID }> = ({ itemId }) => {
    const { standardForm } = useWorkbenchAsset()
    const component = standardForm.byUniversalId[itemId]
    if (!component) {
        return <Typography variant="body2" color="text.secondary">Untitled</Typography>
    }
    if (hasShortName(component)) {
        return <Typography variant="body2" noWrap>
            { component.shortName?._payload?.plain?.toJSON() ?? 'Untitled' }
        </Typography>
    }
    else if (hasName(component)) {  
        return <Typography variant="body2" noWrap>
            { component.name ? schemaOutputToString(component.name.children as any) : 'Untitled' }
        </Typography>
    }
    return <Typography variant="body2" color="text.secondary">Untitled</Typography>
}

export const WorkbenchComponentRow: FunctionComponent<WorkbenchComponentRowProps> = ({ 
    ItemId, 
    onClick, 
    icon, 
    sx, 
    selected,
    isEven = false
}) => {
    const { updateStandard, inheritedStandardForm, standardForm } = useWorkbenchAsset()
    const theme = useTheme()

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        updateStandard({ type: 'removeComponent', componentKey: ItemId })
    }, [updateStandard, ItemId])

    // Check if component is imported (either in inheritedStandardForm or has _from property)
    const isImported = useMemo(() => {
        const component = standardForm.byUniversalId[ItemId]
        return Boolean(inheritedStandardForm.byUniversalId[ItemId]) || Boolean(component?._from)
    }, [ItemId, inheritedStandardForm, standardForm])

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                padding: '0.5em 0.75em',
                cursor: 'pointer',
                borderRadius: '4px',
                backgroundColor: selected 
                    ? 'action.selected' 
                    : isEven 
                        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)
                        : 'transparent',
                '&:hover': {
                    backgroundColor: selected 
                        ? 'action.selected' 
                        : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.18)
                },
                ...sx
            }}
        >
            {/* Component type icon with import indicator */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                width: '38px',
                flexShrink: 0,
                color: 'text.secondary'
            }}>
                {icon}
                {isImported && (
                    <CallMadeIcon sx={{ fontSize: '0.875rem', opacity: 0.7 }} />
                )}
            </Box>
            
            {/* Component name */}
            <Box sx={{ 
                flex: 1, 
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                <ComponentName itemId={ItemId} />
            </Box>
            
            {/* Delete affordance */}
            <IconButton
                size="small"
                onClick={handleDelete}
                sx={{ 
                    padding: '0.25em',
                    '&:hover': {
                        backgroundColor: 'error.light',
                        color: 'error.contrastText'
                    }
                }}
            >
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    )
}

export default WorkbenchComponentRow
