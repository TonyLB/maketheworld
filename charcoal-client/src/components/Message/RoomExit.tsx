import React, { ReactChild, ReactChildren } from 'react'
import { useDispatch } from 'react-redux'

import Chip from '@material-ui/core/Chip'
import ExitIcon from '@material-ui/icons/ExitToApp'
import HiddenIcon from '@material-ui/icons/VisibilityOff'

import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { useActiveCharacter } from '../ActiveCharacter'
import { RoomExit as RoomExitType } from '../../slices/messages/baseClasses'

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
        dispatch(moveCharacter(CharacterId)({ RoomId, ExitName: Name }))
    } : () => {}

    return <Chip
            label={Name}
            icon={Visibility === 'Public' ? <ExitIcon /> : <HiddenIcon /> }
            onClick={clickHandler}
        />
}

export default RoomExit