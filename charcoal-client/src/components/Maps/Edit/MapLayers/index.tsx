import React, { FunctionComponent, useCallback, useContext, useMemo, useRef, useState } from 'react'

import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { Box, Button, Collapse, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import AcceptIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PositionIcon from '@mui/icons-material/ControlCamera'
import EditIcon from '@mui/icons-material/Edit'
import { grey } from '@mui/material/colors'
import { useMapContext } from '../../Controller'
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-base/ts/genericTree'
import { UnshownRooms } from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from './RenameIcon'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import IfElseTree from '../../../Library/Edit/IfElseTree'
import { EditSchema, useEditContext } from '../../../Library/Edit/EditContext'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { addOnboardingComplete } from '../../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { requestLLMGeneration } from '../../../../slices/personalAssets'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import TutorialPopover from '../../../Onboarding/TutorialPopover'
import { ignoreWrapped } from '@tonylb/mtw-wml/ts/schema/utils'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { SchemaOutputTag, SchemaTag } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { standardComponentByTag } from '@tonylb/mtw-wml/ts/standardize/nonEditFactory'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import { StandardRender, StandardRenderRemove, StandardRenderReplace } from '@tonylb/mtw-wml/ts/standardize/render'

type MapLayersProps = {
    mapId: string;
}

type MapLayersContextType = {
    mapId: string;
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ roomId: string; name: string; inherited?: boolean; newestRoom?: boolean }> = ({ roomId, name, inherited, children, newestRoom }) => {
    const { UI: { itemSelected }, mapDispatch } = useMapContext()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { inheritedInvisible } = useMapLayersContext()
    const { standardForm, updateStandard, AssetId } = useLibraryAsset()
    const [open, setOpen] = useState<boolean>(false)
    const [renaming, setRenaming] = useState<boolean>(false)
    const [nameEdit, setNameEdit] = useState<string>('')
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const onRename = useCallback((value: string) => {
        const roomComponent = standardForm.byId[roomId]
        if (!(roomComponent && roomComponent instanceof StandardRoom)) {
            return
        }
        dispatch(addOnboardingComplete(['renameNewRoom']))
        if (value !== schemaOutputToString(ignoreWrapped(roomComponent.shortName)?.children ?? []) || roomId) {
            updateStandard({
                type: 'updateComponent',
                componentKey: roomComponent.key,
                update: (incoming: StandardComponent) => {
                    const base = incoming.clone()
                    if (base instanceof StandardRoom) {
                        base._payload._shortName = new StandardRender([value])
                    }
                    return base
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
                        ? <CopyAllIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                        : <HomeIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
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
            <IconButton ref={editRef} onClick={() => { navigate(`/Draft/Room/${roomId}`) }}><EditIcon /></IconButton>
            <TutorialPopover
                anchorEl={editRef as any}
                placement='top'
                checkPoints={['navigateRoom']}
                condition={newestRoom}
            />
            {
                childrenPresent &&
                (open
                    ? <ExpandLess
                        onClick={(event) => {
                            event.stopPropagation()
                            setOpen(false)
                        }}
                    />
                    : <ExpandMore
                        onClick={(event) => {
                            event.stopPropagation()
                            setOpen(true)
                        }}
                    />)
            }
        </ListItemButton>
        { childrenPresent && <Collapse in={open} timeout="auto" unmountOnExit><List component="div" disablePadding sx={{ paddingLeft: '1em' }}>{children}</List></Collapse> }
    </React.Fragment>
}

const ExitLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited }) => {
    const { inheritedInvisible } = useMapLayersContext()
    return <ListItem dense disablePadding sx={{ paddingLeft: '1em'}}>
        <ListItemIcon>
            {
                inherited
                    ? <CopyAllIcon fontSize="small" sx={{ fontSize: '12px', color: inheritedInvisible ? grey[500] : 'black' }} />
                    : <ArrowIcon fontSize="small" sx={{ fontSize: '12px', color: inheritedInvisible ? grey[500] : 'black' }} />
            }
        </ListItemIcon>
        <ListItemText primary={`to: ${name}`} />
    </ListItem>
}

const PositionLayer: FunctionComponent<{ x: number, y: number, inherited?: boolean }> = ({ x, y, inherited }) => {
    const { inheritedInvisible } = useMapLayersContext()
    return <ListItem dense disablePadding sx={{ paddingLeft: '1em'}}>
        <ListItemIcon>
            <PositionIcon fontSize="small" sx={{ fontSize: '12px', color: inheritedInvisible ? grey[500] : 'black' }} />
        </ListItemIcon>
        <ListItemText primary={`X: ${x}, Y: ${y}`} />
    </ListItem>
}

const ConditionLayer: FunctionComponent<{ src: string, conditionId: string }> = ({ src, conditionId, children }) => {
    const [open, setOpen] = useState<boolean>(false)
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])

    return <React.Fragment>
        <ListItem dense>
            <ListItemText primary={`If: ${src}`} />
            {
                childrenPresent && (open ? <ExpandLess onClick={() => { setOpen(false) }} /> : <ExpandMore onClick={() => { setOpen(true) }} />)
            }
        </ListItem>
        { childrenPresent && 
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List component="div" disablePadding sx={{ paddingLeft: '1em' }}>{ children }</List>
            </Collapse>
        }
    </React.Fragment>
}

const AddIfButton: FunctionComponent<{}> = () => {
    const { value, onChange } = useEditContext()
    const onClick = useCallback(() => {
        onChange([
            ...value,
            {
                data: { tag: 'If' },
                children: [{
                    data: { tag: 'Statement', if: '' },
                    children: []
                }]
            }
        ])
    }, [value, onChange])
    return <ListItem>
        <ListItemText sx={{ textAlign: 'center' }}><Button variant="contained" onClick={onClick}>Add If</Button></ListItemText>
    </ListItem>
}

const MapStubRender: FunctionComponent<{}> = () => {
    const { value } = useEditContext()
    return <React.Fragment>
        { value.map((node, index) => (<MapItemLayer item={node} key={`MapStub-${index}`} />)) }
        <AddIfButton />
    </React.Fragment>
}

//
// MapItemLayer component accepts any of GenericTreeNode<MapItem>, and farms out the top-level
// data render to the appropriate component, passing children that are recursive calls of MapItemLayer on the
// children values
//
const MapItemLayer: FunctionComponent<{ item: GenericTreeNode<SchemaTag>, highlightID?: string }> = ({ item, highlightID }) => {
    const render = useCallback(() => (<MapStubRender />), [])
    const { standardForm, updateStandard } = useLibraryAsset()
    const { data } = item
    const { tree, mapDispatch, mapId } = useMapContext()
    const component = useMemo<StandardComponent | undefined>(() => (standardForm.byId[mapId]), [standardForm, mapId])
    const onClick = useCallback((id: string) => {
        mapDispatch({ type: 'SelectItem', item: undefined })
        mapDispatch({ type: 'SelectParent', item: id })
    }, [mapDispatch])
    const isNewestRoom = useMemo(() => {
        const newRoomIndex = (data: SchemaTag): number => {
            if (data.tag === 'Room' && Boolean(data.key.match(/^Room[\d]+$/))) {
                const roomIndex = parseInt(data.key.slice(4))
                return roomIndex
            }
            return -1    
        }
        const thisRoomIndex = newRoomIndex(data)
        if (thisRoomIndex !== -1) {
            return !tree.find(({ data }) => (newRoomIndex(data) > thisRoomIndex))
        }
        return false
    }, [tree, data])
    switch(data.tag) {
        case 'Room':
            const roomComponent = standardForm.byId[data.key]
            return <RoomLayer
                roomId={data.key}
                name={(roomComponent && roomComponent instanceof StandardRoom) ? schemaOutputToString(ignoreWrapped(roomComponent.shortName)?.children ?? []) || data.key : data.key}
                newestRoom={isNewestRoom}
            >
                { item.children.map((child, index) => (<MapItemLayer key={`${data.key}-Child-${index}`} item={child} />)) }
            </RoomLayer>
        case 'Position':
            return <PositionLayer x={data.x} y={data.y} />
        case 'Exit':
            const destinationComponent = standardForm.byId[data.to]
            const exitName = (destinationComponent && destinationComponent instanceof StandardRoom) ? schemaOutputToString(ignoreWrapped(destinationComponent.shortName)?.children ?? []) : ''
            return <ExitLayer name={exitName || data.to} />
        case 'If':
            return <EditSchema
                value={item.children ?? []}
                onChange={(value) => { 
                    if (typeof value !== 'function') {
                        if (component && component instanceof StandardMap) {
                            updateStandard({
                                type: 'updateComponent',
                                componentKey: mapId,
                                update: (incoming: StandardComponent) => {
                                    const base = incoming.clone()
                                    if (base instanceof StandardMap) {
                                        base._payload._name = value.length ?
                                            { data: { tag: 'Name' }, children: value as GenericTree<SchemaOutputTag> }
                                            : undefined
                                    }
                                    return base
                                }
                            })
                        }
                    }
                }}
            >
                <IfElseTree
                    render={render}
                    showSelected={true}
                    onClick={onClick}
                />
            </EditSchema>
        default:
            return null
    }
}

export const MapLayers: FunctionComponent<MapLayersProps> = ({ mapId }) => {
    const { tree } = useMapContext()
    return <MapLayersContext.Provider value={{ mapId }}>
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em' }}>Unshown Rooms</Box>
        <UnshownRooms />
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em', marginTop: '0.5em' }}>Map Layers</Box>
        <Box sx={{position: "relative", zIndex: 0 }}>
            { tree.map((item, index) => (<MapItemLayer key={`MapLayerBase-${index}`} item={item} />))}
            <AddIfButton />
        </Box>
    </MapLayersContext.Provider>

}

export default MapLayers
