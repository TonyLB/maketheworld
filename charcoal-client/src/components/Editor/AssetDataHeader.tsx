import React, { FunctionComponent, ReactNode } from 'react'

import {
    ListItemButton,
    ListItem,
    ListItemText,
    ListItemIcon,
    SxProps,
    Box
} from '@mui/material'

import MiniChip from '../MiniChip'

export type AssetDataHeaderRenderFunction = {
    (key: string): ReactNode;
}

//
// TODO: ISS3887: REfactor AssetDataHeader with primary taking a key (and using useLibraryAsset context
// to derive data, rather than passing full arguments)
//
interface AssetDataHeaderProps {
    ItemId: string;
    icon: ReactNode;
    iconIndicator?: ReactNode;
    actions?: ReactNode;
    primary?: AssetDataHeaderRenderFunction;
    secondary?: AssetDataHeaderRenderFunction;
    onClick?: () => void;
    sx?: SxProps;
    selected?: boolean;
}

export const AssetDataHeader: FunctionComponent<AssetDataHeaderProps> = ({ icon, iconIndicator, actions = null, primary, secondary, ItemId, onClick, sx, selected }) => {
    const primaryOutput = <React.Fragment>
        { primary?.(ItemId) || null }
    </React.Fragment>
    const secondaryOutput = secondary?.(ItemId) || null
    const iconContent = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            { icon }
            { iconIndicator }
        </Box>
    )
    if (onClick) {
        return <ListItem sx={sx} secondaryAction={actions}>
            <ListItemButton onClick={onClick} selected={selected}>
                <ListItemIcon>
                    { iconContent }
                </ListItemIcon>
                <ListItemText primary={primaryOutput} secondary={secondaryOutput} />
            </ListItemButton>
        </ListItem>
    }
    else {
        return <ListItem sx={sx}>
            <ListItemIcon>
                { iconContent }
            </ListItemIcon>
            <ListItemText primary={primaryOutput} secondary={secondaryOutput} />
        </ListItem>
    }
}

export default AssetDataHeader
