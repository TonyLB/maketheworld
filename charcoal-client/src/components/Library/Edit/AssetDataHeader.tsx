import React, { FunctionComponent, ReactChild } from 'react'

import {
    ListItemButton,
    ListItem,
    ListItemText,
    ListItemIcon,
    SxProps
} from '@mui/material'

import { NormalFeature, NormalItem, NormalRoom, isNormalFeature, isNormalImport, isNormalRoom } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { AssetComponent, useLibraryAsset } from './LibraryAsset'
import MiniChip from '../../MiniChip'

type AssetDataHeaderRenderFunctionProps = {
    item: NormalItem;
    inheritedItem?: NormalRoom | NormalFeature;
    normalForm: Record<string, NormalItem>;
    rooms: Record<string, AssetComponent>;
}

export type AssetDataHeaderRenderFunction = {
    (props: AssetDataHeaderRenderFunctionProps): ReactChild;
}

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
    const { normalForm, rooms } = useLibraryAsset()

    const props = {
        item: normalForm[ItemId],
        normalForm,
        rooms
    }
    const primaryOutput = <React.Fragment>
        { primary?.(props) || null }
    </React.Fragment>
    const secondaryOutput = secondary?.(props) || null
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
