import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useActiveCharacter } from '../../ActiveCharacter';

type MapViewProps = {
    MapId: string;
}


export const MapView: FunctionComponent<MapViewProps> = ({ MapId }) => {
    const { maps } = useActiveCharacter()
    return <div>
        { JSON.stringify(maps[MapId] || {}, null, 4) }
    </div>
}

export default MapView
