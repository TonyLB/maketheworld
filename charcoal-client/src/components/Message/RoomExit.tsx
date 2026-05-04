import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'

import Chip from '@mui/material/Chip'
import { grey } from '@mui/material/colors'
import ExitIcon from '@mui/icons-material/ExitToApp'

import { moveCharacter } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'
import { StandardExitFacet } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'

interface RoomExitProps {
    exit: StandardExitFacet;
    inactive?: boolean;
    children?: ReactChild | ReactChildren;
}

export const RoomExit = ({ exit, inactive = false }: RoomExitProps) => {
    if (!(exit instanceof StandardExitFacet)) {
        return <Chip label="Unknown Exit" icon={<ExitIcon />} />
    }
    const exitName = exit.payload.toJSON() ?? 'Unknown Exit'
    const targetRoomId = exit.reference.universalKey ?? ''

    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()

    if (inactive) {
        //
        // Historical room headers render exits as outlined grey chips with no click
        // handler so they read as archived and avoid time-traveling moves.
        //
        return <Chip
            label={exitName}
            icon={<ExitIcon sx={{ color: `${grey[600]} !important` }} />}
            variant="outlined"
            sx={{
                color: grey[700],
                borderColor: grey[500]
            }}
        />
    }

    //
    // TODO: Create locking mechanism, and embed something akin to "clickable" into
    // the data structure for the Exit
    //
    const clickable = true
    const clickHandler = clickable ? () => {
        if (isEphemeraCharacterId(CharacterId) && isEphemeraRoomId(targetRoomId)) {
            dispatch(addOnboardingComplete(['exitLink']))
            dispatch(moveCharacter(CharacterId)({ RoomId: targetRoomId, ExitName: exitName }))
        }
    } : () => {}

    return <Chip
            label={exitName}
            icon={<ExitIcon />}
            onClick={clickHandler}
        />
}

export default RoomExit
