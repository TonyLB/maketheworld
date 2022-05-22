import { FunctionComponent, ReactChild } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItem,
    ListItemText,
    ListItemIcon,
    SxProps
} from '@mui/material'

import { NormalItem } from '../../../wml/normalize'
import { AssetComponent, useLibraryAsset } from './LibraryAsset'
import { InheritedComponent } from '../../../slices/personalAssets/inheritedData'

type AssetDataHeaderRenderFunctionProps = {
    item: NormalItem;
    defaultItem: InheritedComponent;
    normalForm: Record<string, NormalItem>;
    defaultAppearances: Record<string, InheritedComponent>;
    rooms: Record<string, AssetComponent>;
}

export type AssetDataHeaderRenderFunction = {
    (props: AssetDataHeaderRenderFunctionProps): ReactChild;
}

interface AssetDataHeaderProps {
    ItemId: string;
    icon: ReactChild;
    primary?: AssetDataHeaderRenderFunction;
    secondary?: AssetDataHeaderRenderFunction;
    onClick?: () => void;
    sx?: SxProps;
    selected?: boolean;
}

export const AssetDataHeader: FunctionComponent<AssetDataHeaderProps> = ({ icon, primary, secondary, ItemId, onClick, sx, selected }) => {
    const { normalForm, defaultAppearances, rooms } = useLibraryAsset()

    const props = {
        item: normalForm[ItemId],
        defaultItem: defaultAppearances[ItemId],
        normalForm,
        defaultAppearances,
        rooms
    }
    const primaryOutput = primary?.(props) || null
    const secondaryOutput = secondary?.(props) || null
    if (onClick) {
        return <ListItemButton onClick={onClick} sx={sx} selected={selected}>
            <ListItemIcon>
                { icon }
            </ListItemIcon>
            <ListItemText primary={primaryOutput} secondary={secondaryOutput} />
        </ListItemButton>
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
