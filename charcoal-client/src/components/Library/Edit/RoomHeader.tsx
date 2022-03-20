import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'

import {
    ListItemButton,
    ListItemText,
    ListItemIcon
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'

import { NormalRoom } from '../../../wml/normalize'
import { getDefaultAppearances } from '../../../slices/personalAssets'

interface RoomHeaderProps {
    room: NormalRoom;
    AssetId: string;
}

export const RoomHeader: FunctionComponent<RoomHeaderProps> = ({ room, AssetId }) => {
    const defaultAppearances = useSelector(getDefaultAppearances(`ASSET#${AssetId}`))
    const aggregateName = room.appearances
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .map(({ name = '' }) => name)
        .join('')
    return <ListItemButton>
        <ListItemIcon>
            <HomeIcon />
        </ListItemIcon>
        <ListItemText primary={`${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'} secondary={room.key} />
    </ListItemButton>
}

export default RoomHeader
