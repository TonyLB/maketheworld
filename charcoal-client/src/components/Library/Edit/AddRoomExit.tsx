import { FunctionComponent, useMemo, useCallback } from 'react'

import {
    ListItemButton,
    ListItemIcon,
    ListItemText,
    List
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useLibraryAsset } from './LibraryAsset'
import { isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses';

interface AddRoomExitProps {
    RoomId: string;
    onAdd?: (props: { toTarget: boolean; targetId: string }) => void;
}

export const AddRoomExit: FunctionComponent<AddRoomExitProps> = ({ RoomId }) => {
    const { standardForm, updateStandard } = useLibraryAsset()
    const roomComponent = useMemo(() => (standardForm.byId[RoomId]), [standardForm, RoomId])
    const addExitItem = useCallback(() => {
        if (roomComponent && isStandardRoom(roomComponent)) {
            updateStandard({
                type: 'spliceList',
                componentKey: roomComponent.key,
                itemKey: 'exits',
                at: roomComponent.exits.length,
                items: [{ data: { tag: 'Exit', key: `${RoomId}#`, from: RoomId, to: '' }, children: [] }]
            })
        }
    }, [roomComponent, updateStandard])
    return <List>
        <ListItemButton onClick={addExitItem}>
            <ListItemIcon>
                <AddIcon />
            </ListItemIcon>
            <ListItemText primary="Add Exit" />
        </ListItemButton>
    </List>

}

export default AddRoomExit
