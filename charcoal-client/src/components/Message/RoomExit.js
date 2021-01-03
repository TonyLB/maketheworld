import React from 'react'
import { useDispatch } from 'react-redux'

import Chip from '@material-ui/core/Chip'
import ExitIcon from '@material-ui/icons/ExitToApp'
import HiddenIcon from '@material-ui/icons/VisibilityOff'

import { moveCharacter } from '../../actions/behaviors/moveCharacter'

export const RoomExit = ({ Name, Visibility, RoomId, clickable }) => {

    const dispatch = useDispatch()
    const clickHandler = clickable ? () => { dispatch(moveCharacter({ RoomId, ExitName: Name })) } : () => () => {}

    return <Chip
            label={Name}
            icon={Visibility === 'Public' ? <ExitIcon /> : <HiddenIcon /> }
            onClick={clickHandler}
        />
}

export default RoomExit