import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'

import Chip from '@mui/material/Chip'
import ExitIcon from '@mui/icons-material/ExitToApp'

import { moveCharacter } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'
import { RoomExit as RoomExitType } from '@tonylb/mtw-interfaces/ts/messages'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'

interface RoomExitProps {
    exit: StandardExit;  // Only accept Standard format
    children?: ReactChild | ReactChildren;
}

export const RoomExit = ({ exit }: RoomExitProps) => {
    const exitData = exit._payload.plain.toJSON()
    const exitName = typeof exitData.description === 'string' ? exitData.description : 'Unknown Exit'
    const targetRoomId = typeof exitData.to === 'string' ? exitData.to : exitData.to.universalKey || ''

    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
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