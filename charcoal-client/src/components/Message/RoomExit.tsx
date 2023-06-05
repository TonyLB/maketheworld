import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'

import Chip from '@mui/material/Chip'
import ExitIcon from '@mui/icons-material/ExitToApp'

import { moveCharacter } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'
import { RoomExit as RoomExitType } from '@tonylb/mtw-interfaces/dist/messages'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'

interface RoomExitProps {
    exit: RoomExitType;
    children?: ReactChild | ReactChildren;
}

export const RoomExit = ({ exit: { Name, Visibility, RoomId } }: RoomExitProps) => {

    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    //
    // TODO: Create locking mechanism, and embed something akin to "clickable" into
    // the data structure for the Exit
    //
    const clickable = true
    const clickHandler = clickable ? () => {
        if (isEphemeraCharacterId(CharacterId) && isEphemeraRoomId(RoomId)) {
            dispatch(addOnboardingComplete(['exitLink']))
            dispatch(moveCharacter(CharacterId)({ RoomId, ExitName: Name }))
        }
    } : () => {}

    return <Chip
            label={Name}
            icon={<ExitIcon />}
            onClick={clickHandler}
        />
}

export default RoomExit