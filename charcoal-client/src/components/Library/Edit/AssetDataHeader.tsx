import { FunctionComponent, ReactChild } from 'react'

import {
    ListItemButton,
    ListItem,
    ListItemText,
    ListItemIcon,
    SxProps
} from '@mui/material'

import { NormalItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { AssetComponent, useLibraryAsset } from './LibraryAsset'
import { AssetClientImportDefaults, AssetClientImportDefaultsFeature, AssetClientImportDefaultsRoom } from '@tonylb/mtw-interfaces/dist/asset'

type AssetDataHeaderRenderFunctionProps = {
    item: NormalItem;
    defaultItem: AssetClientImportDefaultsFeature | AssetClientImportDefaultsRoom;
    normalForm: Record<string, NormalItem>;
    importDefaults: AssetClientImportDefaults["defaultsByKey"],
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
    const { normalForm, importDefaults, rooms } = useLibraryAsset()

    const props = {
        item: normalForm[ItemId],
        defaultItem: importDefaults[ItemId],
        normalForm,
        importDefaults,
        rooms
    }
    const primaryOutput = primary?.(props) || null
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
