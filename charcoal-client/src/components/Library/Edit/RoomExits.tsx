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

interface RoomExitsProps {
    RoomId: string;
}

export const RoomExits: FunctionComponent<RoomExitsProps> = ({ RoomId }) => {
    const { assetKey, normalForm, wmlQuery, updateWML, components, exits } = useLibraryAsset()
    const relevantExits = objectFilter(
        objectFilter(exits, ({ appearances }) => (Boolean((appearances || []).find(noConditionContext)))),
        ({ to, from }) => ((to === RoomId) || (from === RoomId))
    )
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
                    Object.keys(exits)
                        .map((key) => (<RoomExitHeader key={key} ItemId={key} RoomId={RoomId} />))
                }
                <AddRoomExit onAdd={() => {}} />
            </Box>
        </Box>
    </Box>
}

export default RoomExits
