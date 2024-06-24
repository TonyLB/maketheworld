import React, { FunctionComponent, ReactChild } from 'react'

import {
    ListItemButton,
    ListItem,
    ListItemText,
    ListItemIcon,
    SxProps
} from '@mui/material'

import MiniChip from '../../MiniChip'

export type AssetDataHeaderRenderFunction = {
    (key: string): ReactChild;
}

//
// TODO: ISS3887: REfactor AssetDataHeader with primary taking a key (and using useLibraryAsset context
// to derive data, rather than passing full arguments)
//
interface AssetDataHeaderProps {
    ItemId: string;
    icon: ReactChild;
    actions?: ReactChild;
    primary?: AssetDataHeaderRenderFunction;
    secondary?: AssetDataHeaderRenderFunction;
    onClick?: () => void;
    sx?: SxProps;
    selected?: boolean;
}

export const AssetDataHeader: FunctionComponent<AssetDataHeaderProps> = ({ icon, actions = null, primary, secondary, ItemId, onClick, sx, selected }) => {
    const primaryOutput = <React.Fragment>
        { primary?.(ItemId) || null }
    </React.Fragment>
    const secondaryOutput = secondary?.(ItemId) || null
    if (onClick) {
        return <ListItem sx={sx} secondaryAction={actions}>
            <ListItemButton onClick={onClick} selected={selected}>
                <ListItemIcon>
                    { icon }
                </ListItemIcon>
                <ListItemText primary={primaryOutput} secondary={secondaryOutput} />
            </ListItemButton>
        </ListItem>
    }
    else {
        return <ListItem sx={sx}>
            <ListItemIcon>
                { icon }
            </ListItemIcon>
            <ListItemText primary={primaryOutput} secondary={secondaryOutput} />
        </ListItem>
    }
}

export default AssetDataHeader
