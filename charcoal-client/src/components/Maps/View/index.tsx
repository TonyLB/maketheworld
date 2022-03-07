import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useActiveCharacter } from '../../ActiveCharacter';
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'

type MapViewProps = {
    MapId: string;
}


export const MapView: FunctionComponent<MapViewProps> = ({ MapId }) => {
    const { maps, CharacterId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${CharacterId}/Map/${MapId}/`,
        label: `Map: ${Name}`,
        iconName: 'Map'
    })
    return <div>
        { JSON.stringify(maps[MapId] || {}, null, 4) }
    </div>
}

export default MapView
