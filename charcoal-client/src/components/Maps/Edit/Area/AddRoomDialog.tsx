import React, { FunctionComponent, useCallback, useMemo } from 'react'

import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Button,
    List
} from '@mui/material'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import { isNormalMap } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { objectFilterEntries, objectMap } from '../../../../lib/objects'
import WMLComponentHeader from '../../../Library/Edit/WMLComponentHeader'
import SchemaTagTree from '@tonylb/mtw-wml/dist/tagTree/schema'
import { isSchemaRoom } from '@tonylb/mtw-wml/dist/schema/baseClasses'

interface AddRoomDialog {
    open: boolean;
    onClose?: () => void;
    onChange?: (key: string) => void;
    onSave?: () => void;
    roomId: string;
    mapId: string;
}

export const AddRoomDialog: FunctionComponent<AddRoomDialog> = ({
    onClose = () => {},
    onChange = () => {},
    onSave = () => {},
    roomId,
    mapId,
    open=false
}) => {
    const { rooms, normalForm, select } = useLibraryAsset()
    const currentMapRooms = useMemo(() => {
        return select({ key: mapId, selector: (tree) => {
            const tagTree = new SchemaTagTree(tree)
            return tagTree
                .filter({ match: 'Position' })
                .prune({ not: { match: 'Room' } })
                .tree
                .map(({ data }) => (isSchemaRoom(data) ? [data.key] : [])).flat(1)
        }})
    }, [select, mapId])
    const availableRooms = useMemo(() => (
        objectFilterEntries(
            objectMap(rooms, ({ name }) => (name)),
            ([key]) => (!(currentMapRooms.includes(key)))
        )
    ), [rooms, currentMapRooms, normalForm])
    return <Dialog
            maxWidth="lg"
            open={open}
        >
            <DialogTitle sx={{ bgcolor: 'lightblue'}} >
                <Typography align="center">Choose room to add</Typography>
            </DialogTitle>
            <DialogContent>
                <List component="nav">
                    { 
                        Object.keys(availableRooms).map((key) => (
                            <WMLComponentHeader key={key} ItemId={key} selected={key === roomId} onClick={() => { onChange(key) }} />
                        ))
                    }
                </List>
            </DialogContent>

            <Button onClick={onClose}>Close</Button>
            <Button onClick={onSave}>OK</Button>

        </Dialog>
}

export default AddRoomDialog
