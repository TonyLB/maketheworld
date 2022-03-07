import React, { FunctionComponent, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material'

import { useActiveCharacter } from '../../ActiveCharacter';
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'

import MapArea from '../Edit/Area'
import cacheToTree from './cacheToTree'

type MapViewProps = {
}

export const MapView: FunctionComponent<MapViewProps> = () => {
    const { maps, CharacterId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${CharacterId}/Map/`,
        label: `Map: ${Name}`,
        iconName: 'Map'
    })
    const [MapId, setMapId] = useState<string>(Object.keys(maps)[0] || '')

    return <Box sx={{ height: "100%", width: "100%" }}>
        <Box sx={{ width: "100%", margin: ".5rem", display: "flex", justifyContent: "center" }}>
            <Box>
                <FormControl fullWidth>
                    <InputLabel id="map-view-select-label">Which Map</InputLabel>
                    <Select
                        sx={{ maxWidth: "400px" }}
                        labelId="map-view-select-label"
                        value={MapId}
                        label="Which Map"
                        onChange={(event) => { setMapId(event.target.value) }}
                    >
                        {
                            Object.entries(maps)
                                .map(([key, { Name }]) => (
                                    <MenuItem key={key} value={key}>{Name || key}</MenuItem>
                                ))
                        }
                    </Select>
                </FormControl>
            </Box>
        </Box>
        { MapId && <MapArea
            tree={cacheToTree(maps[MapId])}
            dispatch={() => {}}
        /> }
    </Box>
}

export default MapView
