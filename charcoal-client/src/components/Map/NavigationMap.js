import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { moveCharacter } from '../../actions/behaviors/moveCharacter'
import { getCurrentRoom } from '../../selectors/currentRoom'
import MapRoom from './MapRoom'
import MapDisplay from './MapDisplay'
import useStyles from '../styles'

export const NavigationMap = ({ map, width="100%", height="100%", open=true }) => {
    const classes = useStyles()
    const currentRoom = useSelector(getCurrentRoom)
    const dispatch = useDispatch()

    const roomComponent = ({ PermanentId, ...rest }) => {
        const exit = (currentRoom.Exits || []).find(({ RoomId }) => (RoomId === PermanentId))
        return <MapRoom
            { ...rest }
            classes={classes}
            className={classes[(PermanentId === currentRoom.PermanentId) ? "svgBlue" : "svgLightBlue"]}
            contrastClassName={classes[(PermanentId === currentRoom.PermanentId) ? "svgBlueContrast" : "svgLightBlueContrast"]}
            clickable={Boolean(exit)}
            onClick={ exit ? () => { dispatch(moveCharacter({ ExitName: (exit && exit.Name) || null, RoomId: PermanentId }))} : () => {} }
        />
    }

    return <MapDisplay open={open} map={map} width={width} height={height} roomComponent={roomComponent} />
}

export default NavigationMap