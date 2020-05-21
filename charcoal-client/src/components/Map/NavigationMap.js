import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { getCurrentRoom } from '../../selectors/currentRoom'
import MapRoom from './MapRoom'
import MapDisplay from './MapDisplay'

export const NavigationMap = ({ map, width=600, height=400 }) => {
    const currentRoom = useSelector(getCurrentRoom)
    const dispatch = useDispatch()

    const roomComponent = ({ PermanentId, ...rest }) => {
        const exit = (currentRoom.Exits || []).find(({ RoomId }) => (RoomId === PermanentId))
        return <MapRoom
            { ...rest }
            className={(PermanentId === currentRoom.PermanentId) ? "svgBlue" : "svgLightBlue"}
            clickable={Boolean(exit)}
            onClick={ exit ? () => { dispatch(moveCharacter({ ExitName: (exit && exit.Name) || null, RoomId: PermanentId }))} : () => {} }
        />
    }

    return <MapDisplay map={map} width={width} height={height} roomComponent={roomComponent} />
}

export default NavigationMap