import React, { FunctionComponent, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material'

import { useActiveCharacter } from '../../ActiveCharacter';
import { addItem, setIntent } from '../../../slices/activeCharacters'
import { heartbeat } from '../../../slices/stateSeekingMachine/ssmHeartbeat'

import MapArea from '../Edit/Area'
import { EphemeraMapId, isEphemeraMapId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize';
import { MapDisplayController } from '../Controller';
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding';

type MapViewProps = {
}

export const MapView: FunctionComponent<MapViewProps> = () => {
    const dispatch = useDispatch()
    const { maps, CharacterId } = useActiveCharacter()
    useOnboardingCheckpoint('openMap', { requireSequence: true })
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
                            Object.entries({ ...maps, ...(MapId ? {} : { none: { name: 'None selected', MapId: 'MAP#none' as EphemeraMapId, description: '', rooms: [], assets: {} }}) })
                                .map(([key, map]) => (
                                    <MenuItem key={key} value={key}>{map.name || 'Unnamed map'}</MenuItem>
                                ))
                        }
                    </Select>
                </FormControl>
            </Box>
        </Box>
        { MapId && maps[MapId]?.description && (() => {
            try {
                const standardForm = new StandardForm(maps[MapId].description)
                return <MapDisplayController standardForm={standardForm} mapId={MapId}>
                    <MapArea fileURL={maps[MapId].fileURL} editMode={false} />
                </MapDisplayController>
            } catch (error) {
                console.warn('Failed to parse map WML:', error)
                return null
            }
        })() }
    </Box>
}

export default MapView
