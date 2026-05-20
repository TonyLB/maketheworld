import React, { FunctionComponent, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { Box, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import AcceptIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PositionIcon from '@mui/icons-material/ControlCamera'
import EditIcon from '@mui/icons-material/Edit'

import UnshownRooms from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from '../../Maps/Edit/MapLayers/RenameIcon'
import { navigateToComponent } from '../../../slices/UI/workbench'
import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import { useDispatch } from 'react-redux'

import { addOnboardingComplete } from '../../../slices/player/index.api'
import { requestLLMGeneration } from '../../../slices/personalAssets'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import TutorialPopover from '../../Onboarding/TutorialPopover'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { unique, excludeUndefined } from '@tonylb/mtw-base/ts/utils/lists'
import { useMapContext } from './MapController'
import { componentDisplayLabel } from '../../../lib/componentDisplayLabel'

type MapLayersProps = {
    mapId: `MAP#${string}`;
}

type MapLayersContextType = {
    mapId: string;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ roomId: `ROOM#${string}`; name: string; inherited?: boolean; newestRoom?: boolean, children?: ReactNode }> = ({ roomId, name, inherited, children }) => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, AssetId } = useWorkbenchAsset()
    const [renaming, setRenaming] = useState<boolean>(false)
    const [nameEdit, setNameEdit] = useState<string>('')
    const onRename = useCallback((value: string) => {
        const roomComponent = standardForm.byUniversalId[roomId]
        if (!(roomComponent && roomComponent instanceof StandardRoom)) {
            return
        }
        dispatch(addOnboardingComplete(['renameNewRoom']))
        if (value !== roomComponent.shortName?.toJSON() || roomId) {
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const base = draft.byUniversalId[roomId]
                    if (base instanceof StandardRoom) {
                        base._payload._shortName = new StandardLiteral(value)
                    }
                    return draft
                }
            })
            if (isEphemeraAssetId(AssetId)) {
                dispatch(requestLLMGeneration({ assetId: AssetId, roomId }))
            }
        }
    }, [standardForm, updateStandard, roomId, name, dispatch, AssetId])
    const renameRef = useRef<HTMLDivElement>(null)
    const editRef = useRef<HTMLButtonElement>(null)
    const handleEditClick = useCallback(() => {
        dispatch(navigateToComponent(roomId as ComponentUUID))
    }, [dispatch, roomId])
    return <React.Fragment>
        <ListItemButton
            dense
            selected={false}
            onClick={() => {}}
        >
            <ListItemIcon>
                {
                    inherited
                        ? <CopyAllIcon sx={{ color: 'black' }} />
                        : <HomeIcon sx={{ color: 'black' }} />
                }
            </ListItemIcon>
            <ListItemText
                primary={renaming
                    ? <TextField
                        size="small"
                        margin="none"
                        variant="filled"
                        hiddenLabel
                        sx={{ marginTop: '-0.15em' }}
                        InputProps={{ sx: { fontSize: '12px' } }}
                        value={nameEdit}
                        onChange={(event) => { setNameEdit(event.target.value) }}
                    />
                    : name
                }
            />
            <Box ref={renameRef}>
                {
                    renaming
                        ? <React.Fragment>
                            <IconButton
                                onClick={() => {
                                    onRename(nameEdit)
                                    setRenaming(false)
                                    setNameEdit('')
                                }}
                            >
                                <AcceptIcon />
                            </IconButton>
                            <IconButton
                                onClick={() => {
                                    setRenaming(false)
                                    setNameEdit('')
                                }}
                            >
                                <CancelIcon />
                            </IconButton>
                        </React.Fragment>
                        : <IconButton
                                onClick={() => {
                                    setNameEdit(name)
                                    setRenaming(true)
                                }}
                            >
                                <RenameIcon />
                            </IconButton>
                }
            </Box>
            <TutorialPopover
                anchorEl={renameRef as any}
                placement='top'
                checkPoints={['renameNewRoom']}
                condition={Boolean(name.match(/^Room[\d]+$/))}
            />
            <IconButton ref={editRef} onClick={handleEditClick}><EditIcon /></IconButton>
            <TutorialPopover
                anchorEl={editRef as any}
                placement='top'
                checkPoints={['navigateRoom']}
                condition={false}
            />

        </ListItemButton>

    </React.Fragment>
}

const ExitLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited }) => {
    return <ListItem dense disablePadding sx={{ paddingLeft: '1em'}}>
        <ListItemIcon>
            {
                inherited
                    ? <CopyAllIcon fontSize="small" sx={{ fontSize: '12px', color: 'black' }} />
                    : <ArrowIcon fontSize="small" sx={{ fontSize: '12px', color: 'black' }} />
            }
        </ListItemIcon>
        <ListItemText primary={`to: ${name}`} />
    </ListItem>
}

const PositionLayer: FunctionComponent<{ x: number, y: number, inherited?: boolean }> = ({ x, y, inherited }) => {
    return <ListItem dense disablePadding sx={{ paddingLeft: '1em'}}>
        <ListItemIcon>
            <PositionIcon fontSize="small" sx={{ fontSize: '12px', color: 'black' }} />
        </ListItemIcon>
        <ListItemText primary={`X: ${x}, Y: ${y}`} />
    </ListItem>
}

export const MapLayers: FunctionComponent<MapLayersProps> = ({ mapId }) => {
    const { standardForm, localStandardForm } = useWorkbenchAsset()

    const mapComponent = standardForm.byUniversalId[mapId]

    const localMapComponent = localStandardForm.byUniversalId[mapId]

    const roomLayers = useMemo(() => {
        if (!mapComponent || !(mapComponent instanceof StandardMap)) {
            return []
        }

        if (!(localMapComponent instanceof StandardMap)) {
            return []
        }

        const positionedRooms = unique(localMapComponent.positions.items
            .map((facet) => facet.reference.universalKey)
            .filter((roomId): roomId is `ROOM#${string}` =>
                Boolean(roomId && roomId.startsWith('ROOM#'))
            )
        )

        const allPositionedRooms = mapComponent.positions.items
            .map((facet) => facet.reference.universalKey!)
            .filter(excludeUndefined)
            .map((roomId) => standardForm.byUniversalId[roomId as ComponentUUID])
            .filter(excludeUndefined)
            .filter((component): component is StandardRoom =>
                component instanceof StandardRoom
            )
        const allPositionedRoomIds = unique(allPositionedRooms
            .map((room) => room.universalKey)
            .filter(excludeUndefined)
            .filter((roomId): roomId is `ROOM#${string}` =>
                Boolean(roomId && roomId.startsWith('ROOM#'))
            )
        ) as `ROOM#${string}`[]

        const getRelevantExits = (room: StandardRoom) => {
            return room.exits.items.filter((exitFacet) => {
                const destinationId = exitFacet.reference.universalKey
                return destinationId && allPositionedRoomIds.includes(destinationId as `ROOM#${string}`)
            })
        }

        const roomsWithRelevantExits = allPositionedRooms
            .filter((room) => getRelevantExits(room).length > 0)
            .map((room) => room.universalKey)
            .filter((roomId): roomId is ComponentUUID =>
                typeof roomId === 'string' && roomId.startsWith('ROOM#')
            )

        const roomsToShow = unique([...positionedRooms, ...roomsWithRelevantExits]) as `ROOM#${string}`[]

        return Array.from(roomsToShow).map((roomId) => {
            const roomComponent = standardForm.byUniversalId[roomId as ComponentUUID]
            if (!(roomComponent && roomComponent instanceof StandardRoom)) {
                return null
            }

            const roomName = componentDisplayLabel(roomComponent, { fallbackLabel: 'Room' }) ?? 'Room'

            const positionFacet = localMapComponent.positions.items.find((facet) =>
                facet.reference.universalKey === roomId
            )

            return (
                <RoomLayer
                    key={roomId}
                    roomId={roomId}
                    name={roomName}
                    newestRoom={false}
                >
                    {positionFacet?.payload.plain && (
                        <PositionLayer x={positionFacet.payload.plain.x} y={positionFacet.payload.plain.y} />
                    )}

                    {getRelevantExits(roomComponent).map((exitFacet, index) => {
                        const destinationKey = exitFacet.reference.standardKey.toJSON()
                        if (!destinationKey) {
                            return null
                        }
                        const destinationComponent = standardForm._lookup(destinationKey)
                        const exitName = (destinationComponent && destinationComponent instanceof StandardRoom)
                            ? componentDisplayLabel(destinationComponent, { fallbackLabel: '' }) ?? ''
                            : ''

                        return (
                            <ExitLayer
                                key={`${roomId}-exit-${index}`}
                                name={exitName}
                            />
                        )
                    })}
                </RoomLayer>
            )
        }).filter(Boolean)
    }, [mapComponent, localMapComponent, standardForm, localStandardForm, mapId])

    return <MapLayersContext.Provider value={{ mapId }}>
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em' }}>Unshown Rooms</Box>
        <UnshownRooms />
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em', marginTop: '0.5em' }}>Map Layers</Box>
        <Box sx={{position: "relative", zIndex: 0 }}>
            {roomLayers}
        </Box>
    </MapLayersContext.Provider>
}

export default MapLayers
