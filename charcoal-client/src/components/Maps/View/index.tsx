import React, { FunctionComponent, useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Avatar,
    useMediaQuery
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'

import { useActiveCharacter } from '../../ActiveCharacter';
import useAutoPin from '../../../slices/UI/navigationTabs/useAutoPin'
import { addItem, setIntent } from '../../../slices/activeCharacters'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import MapArea from '../Edit/Area'
import cacheToTree from './cacheToTree'
import { EphemeraMapId, isEphemeraMapId } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { MapDisplayController } from '../Controller';
import { genericIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree';
import { useNavigate } from 'react-router-dom';

type MapViewProps = {
}

export const MapView: FunctionComponent<MapViewProps> = () => {
    const dispatch = useDispatch()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 50 : medium ? 40 : 30
    const { maps, CharacterId, scopedId, info: { Name = '???' } = {} } = useActiveCharacter()
    useAutoPin({
        href: `/Character/${scopedId}/Map/`,
        label: `Map: ${Name}`,
        iconName: 'Map',
        type: 'Map',
        characterId: CharacterId
    })
    const navigate = useNavigate()
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

    return <Box sx={{ height: "100%", width: "100%", position: "relative" }}>
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
            <MapArea fileURL={maps[MapId].fileURL} editMode={false} />
        </MapDisplayController> }
        <Box sx={{ right: "2em", top: "0.25em", position: "absolute" }}>
            <Avatar
                sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                alt={'Edit Map'}
                onClick={() => {
                    // dispatch(addImport({ assetId: `ASSET#draft`, fromAsset: asset.split('#')[1], type: 'Map', key }))
                    // navigate(`/Draft/Room/${key}`)            
                }}
            >
                <EditIcon sx={{ fontSize: iconSize * 0.6 }} />
            </Avatar>
        </Box>
    </Box>
}

export default MapView
