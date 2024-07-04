import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

interface MapHeaderProps {
    itemId: string;
    onClick: () => void;
}

export const MapHeader: FunctionComponent<MapHeaderProps> = ({ itemId, onClick }) => {
    return <ListItemButton onClick={onClick}>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={itemId} />
    </ListItemButton>
}

export default MapHeader
