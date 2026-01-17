import React, { FunctionComponent, useMemo, useCallback } from 'react'

import {
    ListItemButton,
    ListItemIcon,
    ListItemText,
    List
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import { useLibraryAsset } from './LibraryAsset'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room';
import { StandardExitFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit';

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
                        const newExitFacet = new StandardExitFacet({
                            reference: { tag: 'Room', key: '' },
                            payload: undefined
                        })
                        base._payload._exits.items.push(newExitFacet)
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
