import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
    GridList,
    GridListTile,
    GridListTileBar
} from '@material-ui/core'
import AddIcon from '@material-ui/icons/AddCircleOutline'

import { getMaps } from '../../selectors/maps'
import MapDisplay from './MapDisplay'
import { EditMapDialog } from './EditMap'
import { activateEditMapDialog } from '../../actions/UI/mapDialog'
import useStyles from '../styles'

export const MapList = () => {
    const classes = useStyles()
    const maps = useSelector(getMaps)
    const dispatch = useDispatch()
    return <React.Fragment>
        <EditMapDialog />
        <GridList cellHeight={200}>
            {
                (Object.values(maps) || []).map((map) => (
                    <GridListTile
                        key={map.MapId || 'None'}
                        onClick={() => { dispatch(activateEditMapDialog(map))} }
                        style={{ cursor: 'pointer' }}
                    >
                        <MapDisplay classes={classes} width={300} height={200} map={map} />
                        <GridListTileBar
                            title={map.Name}
                        />
                    </GridListTile>
                ))
            }
            <GridListTile
                key='New'
                onClick={() => { dispatch(activateEditMapDialog({ Name: 'New Map', Rooms: [] }))} }
                style={{ cursor: 'pointer' }}
            >
                <div style={{display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%"}}>
                    <AddIcon fontSize="large" />
                </div>
                <GridListTileBar title="New Map" />
            </GridListTile>
        </GridList>
    </React.Fragment>
}

export default MapList