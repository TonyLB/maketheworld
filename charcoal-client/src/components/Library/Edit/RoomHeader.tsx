import { FunctionComponent } from 'react'
import { NormalRoom } from '../../../wml/normalize'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

interface RoomHeaderProps {
    room: NormalRoom;
}

export const RoomHeader: FunctionComponent<RoomHeaderProps> = ({ room }) => {
    return <ListItemButton>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={'Untitled'} secondary={room.key} />
    </ListItemButton>
}

export default RoomHeader
