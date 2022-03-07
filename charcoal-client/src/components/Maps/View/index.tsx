import React, { FunctionComponent } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useActiveCharacter } from '../../ActiveCharacter';
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'

import MapArea from '../Edit/Area'
import { MapTree } from '../Edit/maps'
import cacheToTree from './cacheToTree'

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

    const tree = cacheToTree(maps[MapId])

    return <MapArea
        tree={tree}
        dispatch={() => {}}
    />
}

export default MapView
