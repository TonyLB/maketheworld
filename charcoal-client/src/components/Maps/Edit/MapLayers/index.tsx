import React, { FunctionComponent, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'


import { Box, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import AcceptIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PositionIcon from '@mui/icons-material/ControlCamera'
import EditIcon from '@mui/icons-material/Edit'

import { UnshownRooms } from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from './RenameIcon'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'


import { addOnboardingComplete } from '../../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { requestLLMGeneration } from '../../../../slices/personalAssets'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import TutorialPopover from '../../../Onboarding/TutorialPopover'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardExit } from '@tonylb/mtw-wml/ts/standardize/components/exit'
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { unique } from '@tonylb/mtw-base/ts/utils/lists'
import { excludeUndefined } from '@tonylb/mtw-base/ts/utils/lists'
import { splitType } from '@tonylb/mtw-utilities/ts/types'

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
    const navigate = useNavigate()
    const { standardForm, updateStandard, AssetId, assetKey } = useLibraryAsset()
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
    return <React.Fragment>
        <ListItemButton
            dense
            selected={false}
            onClick={() => {}}
            // selected={itemSelected && itemSelected.type === 'Layer' && itemSelected.key === id}
            // onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'Layer', key: id }})}}
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
            <IconButton ref={editRef} onClick={() => { 
                const uuid = splitType(roomId)[1]
                navigate(`/Library/Edit/Asset/${assetKey}/Room/${uuid}`) 
            }}><EditIcon /></IconButton>
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
    const { standardForm, localStandardForm } = useLibraryAsset()
    
    // Get the map component to access its positions
    const mapComponent = standardForm.byUniversalId[mapId]
    
    // Get the local map component to see what's defined locally
    const localMapComponent = localStandardForm.byUniversalId[mapId]
    
    // Build the room layout from local map data and local room exits
    const roomLayers = useMemo(() => {
        if (!mapComponent || !(mapComponent instanceof StandardMap)) {
            return []
        }
        
        if (!(localMapComponent instanceof StandardMap)) {
            return []
        }
        
        // Collect all rooms that should be shown:
        // 1. Rooms with positions in the local map
        // 2. Rooms in the combined map, with local exits that connect to positioned rooms
        
        // Get rooms with local positions
        const positionedRooms = unique(localMapComponent.positions.items
            .map((facet) => facet.reference.universalKey)
            .filter((roomId): roomId is `ROOM#${string}` => 
                Boolean(roomId && roomId.startsWith('ROOM#'))
            )
        )
        
        // Get rooms that have local exits connecting to positioned rooms
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
        
        // Helper function to get relevant exits from a room
        const getRelevantExits = (room: StandardRoom): StandardExit[] => {
            return room.exits.filter((exit) => {
                const destinationId = exit.plain?.to.universalKey
                const destinationKey = destinationId
                return destinationKey && allPositionedRoomIds.includes(destinationKey as `ROOM#${string}`)
            })
        }
        
        const roomsWithRelevantExits = allPositionedRooms
            .filter((room) => getRelevantExits(room).length > 0)
            .map((room) => room.universalKey)
            .filter((roomId): roomId is ComponentUUID => 
                typeof roomId === 'string' && roomId.startsWith('ROOM#')
            )
        
        // Combine and deduplicate all rooms that should be shown
        const roomsToShow = unique([...positionedRooms, ...roomsWithRelevantExits]) as `ROOM#${string}`[]
        
        // Build the room layers for all rooms that should be shown
        return Array.from(roomsToShow).map((roomId) => {
            const roomComponent = standardForm.byUniversalId[roomId as ComponentUUID]
            if (!(roomComponent && roomComponent instanceof StandardRoom)) {
                return null
            }
            
            const roomKey = roomComponent.key
            const roomName = roomComponent.shortName?._payload?.plain?.toJSON() ?? roomKey ?? 'Room'
            
            // Check if this room has a position in the local map
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
                    {/* Position information if available */}
                    {positionFacet?.payload.plain && (
                        <PositionLayer x={positionFacet.payload.plain.x} y={positionFacet.payload.plain.y} />
                    )}
                    
                    {/* Exits from this room */}
                    {getRelevantExits(roomComponent).map((exit, index) => {
                        const destinationKey = exit.plain?.to.toJSON()
                        if (!destinationKey) {
                            return null
                        }
                        const destinationComponent = standardForm._lookup(destinationKey)
                        const exitName = (destinationComponent && destinationComponent instanceof StandardRoom) 
                            ? destinationComponent.shortName?._payload?.plain?.toJSON() ?? destinationComponent.key ?? ''
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
        }).filter(Boolean) // Remove any null entries
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
