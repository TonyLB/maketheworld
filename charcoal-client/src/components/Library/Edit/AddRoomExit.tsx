import React, { FunctionComponent, useMemo, useCallback } from 'react'

import {
    ListItemButton,
    ListItemIcon,
    ListItemText,
    List
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useLibraryAsset } from './LibraryAsset'
import { isStandardRoom } from '@tonylb/mtw-wml/ts/standardize/baseClasses';
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room';

interface AddRoomExitProps {
    RoomId: string;
    onAdd?: (props: { toTarget: boolean; targetId: string }) => void;
}

export const AddRoomExit: FunctionComponent<AddRoomExitProps> = ({ RoomId }) => {
    const { standardForm, updateStandard } = useLibraryAsset()
    const roomComponent = useMemo(() => (standardForm.byId[RoomId]), [standardForm, RoomId])
    const addExitItem = useCallback(() => {
        if (roomComponent instanceof StandardRoom) {
            updateStandard({
                type: 'update',
                update: (standardForm) => {
                    const base = standardForm.byId[RoomId]
                    if (base instanceof StandardRoom) {
                        base._payload._exits.push({ data: { tag: 'Exit', key: `${RoomId}#`, from: RoomId, to: '' }, children: [] })
                    }
                    return standardForm
                }
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
