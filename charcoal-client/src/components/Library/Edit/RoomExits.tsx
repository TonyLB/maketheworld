import { FunctionComponent, useCallback, useState } from 'react'

import {
    Box,
    Typography,
    TextField
} from '@mui/material'
import { blue } from '@mui/material/colors'

import { useLibraryAsset } from './LibraryAsset'
import AddRoomExit from './AddRoomExit'
import RoomExitHeader from './RoomExitHeader'
import { objectFilter } from '../../../lib/objects'
import { noConditionContext } from './utilities'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

interface RoomExitsProps {
    RoomId: string;
}

const guessExitName = (roomName: ComponentRenderItem[] = []) => {
    const roomNameText = roomName.map((item) => (item.tag === 'String' ? item.value : '')).join('')
    return roomNameText.split(' ')
        .map((token) => (token.toLowerCase()))
        .filter((token) => (!['a', 'an', 'the'].includes(token)))[0] || 'unknown'
}

export const RoomExits: FunctionComponent<RoomExitsProps> = ({ RoomId }) => {
    const { wmlQuery, rooms, exits, updateWML } = useLibraryAsset()
    const relevantExits = objectFilter(
        objectFilter(exits, ({ appearances }) => (Boolean((appearances || []).find(noConditionContext)))),
        ({ to, from }) => ((to === RoomId) || (from === RoomId))
    )
    const onAddExit = useCallback(({ toTarget, targetId }: { toTarget: boolean, targetId: string }) => {
        if (!rooms[targetId]) {
            return
        }
        const guessName = toTarget
            ? guessExitName(rooms[targetId]?.name)
            : guessExitName(rooms[RoomId]?.name)
        const newElement = `<Exit ${toTarget ? 'to' : 'from'}=(${targetId})>${guessName}</Exit>`
        const updateQuery = wmlQuery
            .search(`Room[key="${RoomId}"]`)
            .not('If Room')
            .not('Map Room')
            .add(':first')
        updateQuery
            .addElement(newElement, { position: 'after' })
        updateWML(updateQuery.source)
    }, [wmlQuery, rooms, RoomId, updateWML])
    return <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        width: "100%",
        marginTop: '0.5em',
        marginLeft: '0.5em'
    }}>
        <Box sx={{
            display: 'flex',
            width: '2em',
            minHeight: '5em',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: blue[50],
            borderTopColor: blue[500],
            borderTopStyle: 'solid',
            borderBottomColor: blue[500],
            borderBottomStyle: 'solid'
        }}>
            <Typography
                sx={{ transform: 'rotate(-90deg)' }}
                variant="h5"
            >
                Exits
            </Typography>
        </Box>
        <Box sx={{
            display: 'flex',
            flexGrow: 1,
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                width: "100%"
            }}>
                {
                    Object.keys(relevantExits)
                        .map((key) => (<RoomExitHeader key={key} ItemId={key} RoomId={RoomId} />))
                }
                <AddRoomExit RoomId={RoomId} onAdd={onAddExit} />
            </Box>
        </Box>
    </Box>
}

export default RoomExits
