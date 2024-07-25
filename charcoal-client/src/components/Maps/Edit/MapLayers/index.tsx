import React, { FunctionComponent, useCallback, useContext, useMemo, useRef, useState } from 'react'

import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
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
import { GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { UnshownRooms } from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from './RenameIcon'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import IfElseTree from '../../../Library/Edit/IfElseTree'
import { EditSchema, useEditContext } from '../../../Library/Edit/EditContext'
import { isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import ConnectionTable from '../../../Library/Edit/ConnectionTable'
import { addOnboardingComplete } from '../../../../slices/player/index.api'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { socketDispatchPromise } from '../../../../slices/lifeLine'
import { v4 as uuidv4 } from 'uuid'
import { requestLLMGeneration } from '../../../../slices/personalAssets'
import { isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import TutorialPopover from '../../../Onboarding/TutorialPopover'

type MapLayersProps = {
    mapId: string;
}

type MapLayersContextType = {
    mapId: string;
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ id: string; roomId: string; name: string; inherited?: boolean }> = ({ id, roomId, name, inherited, children }) => {
    const { UI: { itemSelected }, mapDispatch } = useMapContext()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { inheritedInvisible } = useMapLayersContext()
    const { standardForm, updateSchema, AssetId } = useLibraryAsset()
    const [open, setOpen] = useState<boolean>(false)
    const [renaming, setRenaming] = useState<boolean>(false)
    const [nameEdit, setNameEdit] = useState<string>('')
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const onRename = useCallback((value: string) => {
        const roomComponent = standardForm.byId[roomId]
        if (!(roomComponent && isStandardRoom(roomComponent))) {
            return
        }
        dispatch(addOnboardingComplete(['renameNewRoom']))
        if (value !== schemaOutputToString(roomComponent.shortName?.children ?? []) ?? roomId) {
            if (roomComponent.shortName?.id) {
                updateSchema({
                    type: 'replaceChildren',
                    id: roomComponent.shortName.id,
                    children: [{ data: { tag: 'String', value }, children: [] }]
                })
            }
            else {
                updateSchema({
                    type: 'addChild',
                    id: roomComponent.id,
                    item: {
                        data: { tag: 'ShortName' },
                        children: [{ data: { tag: 'String', value }, children: [] }]
                    }
                })
            }
            if (isEphemeraAssetId(AssetId)) {
                dispatch(requestLLMGeneration({ assetId: AssetId, roomId }))
            }
        }
    }, [standardForm, updateSchema, roomId, name, dispatch, AssetId])
    const renameRef = useRef<HTMLDivElement>(null)
    return <React.Fragment>
        <ListItemButton
            dense
            selected={itemSelected && itemSelected.type === 'Layer' && itemSelected.key === id}
            onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'Layer', key: id }})}}
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
                anchorEl={renameRef}
                placement='top'
                checkPoints={['renameNewRoom']}
                condition={Boolean(name.match(/^Room[\d]+$/))}
            />
            <IconButton onClick={() => { navigate(`/Draft/Room/${roomId}`) }}><EditIcon /></IconButton>
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

const AddIfButton: FunctionComponent<{ id: string }> = ({ id }) => {
    const { updateSchema } = useLibraryAsset()
    const onClick = useCallback(() => {
        updateSchema({
            type: 'addChild',
            id,
            item: {
                data: { tag: 'If' },
                children: [{
                    data: { tag: 'Statement', if: '' },
                    children: []
                }]
            }
        })
    }, [id, updateSchema])
    return <ListItem>
        <ListItemText sx={{ textAlign: 'center' }}><Button variant="contained" onClick={onClick}>Add If</Button></ListItemText>
    </ListItem>
}

const MapStubRender: FunctionComponent<{}> = () => {
    const { field } = useEditContext()
    return <React.Fragment>
        { field.children.map((node) => (<MapItemLayer item={node} key={node.id} />)) }
        <AddIfButton id={field.id} />
    </React.Fragment>
}

//
// MapItemLayer component accepts any of GenericTreeNode<MapItem>, and farms out the top-level
// data render to the appropriate component, passing children that are recursive calls of MapItemLayer on the
// children values
//
const MapItemLayer: FunctionComponent<{ item: GenericTreeNode<SchemaTag, TreeId>, highlightID?: string }> = ({ item, highlightID }) => {
    const render = useCallback(() => (<MapStubRender />), [])
    const { standardForm, combinedStandardForm } = useLibraryAsset()
    const { data } = item
    const { mapDispatch } = useMapContext()
    const onClick = useCallback((id: string) => {
        mapDispatch({ type: 'SelectItem', item: undefined })
        mapDispatch({ type: 'SelectParent', item: id })
    }, [mapDispatch])
    switch(data.tag) {
        case 'Room':
            const roomComponent = standardForm.byId[data.key]
            return <RoomLayer id={item.id} roomId={data.key} name={(roomComponent && isStandardRoom(roomComponent)) ? schemaOutputToString(roomComponent.shortName?.children ?? []) || data.key : data.key}>
                { item.children.map((child, index) => (<MapItemLayer key={`${data.key}-Child-${index}`} item={child} />)) }
            </RoomLayer>
        case 'Position':
            return <PositionLayer x={data.x} y={data.y} />
        case 'Exit':
            const destinationComponent = combinedStandardForm.byId[data.to]
            const exitName = (destinationComponent && isStandardRoom(destinationComponent)) ? schemaOutputToString(destinationComponent.shortName?.children ?? []) : ''
            return <ExitLayer name={exitName || data.to} />
        case 'If':
            return <EditSchema tag="If" field={item} parentId="">
                <IfElseTree
                    render={render}
                    showSelected={true}
                    highlightID={highlightID}
                    onClick={onClick}
                />
            </EditSchema>
        default:
            return null
    }
}

export const MapLayers: FunctionComponent<MapLayersProps> = ({ mapId }) => {
    const { tree, UI: { parentID }, nodeId } = useMapContext()
    return <MapLayersContext.Provider value={{ mapId }}>
        {/* <ConnectionTable
            label="Themes"
            minHeight="10em"
            target={mapId}
            tag="Theme"
            orientation="parents"
        /> */}
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em' }}>Unshown Rooms</Box>
        <UnshownRooms />
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em', marginTop: '0.5em' }}>Map Layers</Box>
        <Box sx={{position: "relative", zIndex: 0 }}>
            { tree.map((item, index) => (<MapItemLayer key={`MapLayerBase-${index}`} item={item} highlightID={parentID} />))}
            <AddIfButton id={nodeId} />
        </Box>
    </MapLayersContext.Provider>

}

export default MapLayers
