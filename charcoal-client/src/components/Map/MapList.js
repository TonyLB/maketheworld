import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
    GridList,
    GridListTile,
    GridListTileBar
} from '@material-ui/core'

import { getMaps } from '../../selectors/maps'
import { NavigationMap } from './NavigationMap'

export const MapList = () => {
    const maps = useSelector(getMaps)
    return <GridList cellHeight={200}>
        {
            (Object.values(maps) || []).map((map) => (
                <GridListTile key={map.PermanentId}>
                    <NavigationMap width={300} height={200} navigation={false} map={map} />
                    <GridListTileBar
                        title={map.Name}
                    />
                </GridListTile>
            ))
        }
    </GridList>
}

export default MapList