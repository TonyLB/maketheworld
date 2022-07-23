import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

import { NormalMap } from '@tonylb/mtw-wml/dist/normalize'
import { getDefaultAppearances } from '../../../slices/personalAssets'

interface MapHeaderProps {
    mapItem: NormalMap;
    onClick: () => void;
}

export const MapHeader: FunctionComponent<MapHeaderProps> = ({ mapItem, onClick }) => {
    return <ListItemButton onClick={onClick}>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={mapItem.key} />
    </ListItemButton>
}

export default MapHeader
