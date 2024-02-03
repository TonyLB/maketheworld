import React, { FunctionComponent, useEffect, useState } from 'react'
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
import { addItem, setIntent } from '../../../slices/activeCharacters'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import MapArea from '../Edit/Area'
import cacheToTree from './cacheToTree'
import { EphemeraMapId, isEphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { MapDisplayController } from '../Controller';
import { genericIDFromTree } from '@tonylb/mtw-wml/dist/sequence/tree/genericIDTree';

type MapViewProps = {
}

export const MapView: FunctionComponent<MapViewProps> = () => {
    const dispatch = useDispatch()
    const { maps, CharacterId, scopedId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${scopedId}/Map/`,
        label: `Map: ${Name}`,
        iconName: 'Map',
        type: 'Map',
        characterId: CharacterId
    })
    useEffect(() => {
        dispatch(addItem({ key: CharacterId }))
        dispatch(setIntent({ key: CharacterId, intent: ['MAPSUBSCRIBED'] }))
        dispatch(heartbeat)
    }, [dispatch, CharacterId])
    const [MapId, setMapId] = useState<EphemeraMapId | undefined>(Object.keys(maps || {})[0] as EphemeraMapId | undefined)
    useEffect(() => {
        if (typeof MapId === 'undefined' && Object.keys(maps).length) {
            setMapId(Object.keys(maps || {})[0] as EphemeraMapId)
        }
    }, [MapId, setMapId, maps])

    return <Box sx={{ height: "100%", width: "100%" }}>
        <Box sx={{ width: "100%", margin: ".5rem", display: "flex", justifyContent: "center" }}>
            <Box>
                <FormControl fullWidth>
                    <InputLabel id="map-view-select-label">Which Map</InputLabel>
                    <Select
                        sx={{ maxWidth: "400px" }}
                        labelId="map-view-select-label"
                        value={MapId || 'none'}
                        label="Which Map"
                        onChange={(event) => {
                            const mapId = event.target.value
                            if (isEphemeraMapId(mapId)) {
                                setMapId(mapId)
                            }
                        }}
                    >
                        {
                            Object.entries({ ...maps, ...(MapId ? {} : { none: { Name: 'None selected' }}) })
                                .map(([key, { Name }]) => (
                                    <MenuItem key={key} value={key}>{Name || 'Unnamed map'}</MenuItem>
                                ))
                        }
                    </Select>
                </FormControl>
            </Box>
        </Box>
        { MapId && <MapDisplayController tree={genericIDFromTree(cacheToTree(maps[MapId]))}>
            <MapArea fileURL={maps[MapId].fileURL} />
        </MapDisplayController> }
    </Box>
}

export default MapView
