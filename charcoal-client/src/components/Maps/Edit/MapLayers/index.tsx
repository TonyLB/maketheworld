import React, { FunctionComponent, useCallback, useContext, useMemo, useState } from 'react'

import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Box, Collapse, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, TextField } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import AcceptIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PositionIcon from '@mui/icons-material/ControlCamera'
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

type MapLayersProps = {
    mapId: string;
}

type MapLayersContextType = {
    mapId: string;
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ roomId: string; name: string; inherited?: boolean }> = ({ roomId, name, inherited, children }) => {
    const { UI: { itemSelected }, mapDispatch } = useMapContext()
    const { inheritedInvisible } = useMapLayersContext()
    const { standardForm, updateSchema } = useLibraryAsset()
    const [open, setOpen] = useState<boolean>(false)
    const [renaming, setRenaming] = useState<boolean>(false)
    const [nameEdit, setNameEdit] = useState<string>('')
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const onRename = useCallback((value: string) => {
        const roomComponent = standardForm.byId[roomId]
        if (!(roomComponent && isStandardRoom(roomComponent))) {
            return
        }
        if (value !== schemaOutputToString(roomComponent.shortName.children) ?? roomId) {
            if (roomComponent.shortName.id) {
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
        }
    }, [standardForm, updateSchema, roomId, name])
    return <React.Fragment>
        <ListItemButton
            dense
            selected={itemSelected && itemSelected.type === 'Layer' && itemSelected.key === roomId}
            onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'Layer', key: roomId }})}}
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

const MapStubRender: FunctionComponent<{}> = () => {
    const { field } = useEditContext()
    return <React.Fragment>{ field.children.map((node) => (<MapItemLayer item={node} key={node.id} />)) }</React.Fragment>
}

//
// MapItemLayer component accepts any of GenericTreeNode<MapItem>, and farms out the top-level
// data render to the appropriate component, passing children that are recursive calls of MapItemLayer on the
// children values
//
const MapItemLayer: FunctionComponent<{ item: GenericTreeNode<SchemaTag, TreeId> }> = ({ item }) => {
    const { standardForm } = useLibraryAsset()
    const { data } = item
    switch(data.tag) {
        case 'Room':
            const roomComponent = standardForm.byId[data.key]
            return <RoomLayer roomId={data.key} name={(roomComponent && isStandardRoom(roomComponent)) ? schemaOutputToString(roomComponent.shortName.children) || data.key : data.key}>
                { item.children.map((child, index) => (<MapItemLayer key={`${data.key}-Child-${index}`} item={child} />)) }
            </RoomLayer>
        case 'Position':
            return <PositionLayer x={data.x} y={data.y} />
        case 'Exit':
            return <ExitLayer name={data.to} />
        case 'If':
            return <EditSchema tag="If" field={item} parentId="">
                <IfElseTree
                    render={() => (<MapStubRender />)}
                    showSelected={true}
                />
            </EditSchema>
        default:
            return null
    }
}

export const MapLayers: FunctionComponent<MapLayersProps> = ({ mapId }) => {
    const { tree } = useMapContext()
    return <MapLayersContext.Provider value={{ mapId }}>
        <ConnectionTable
            label="Themes"
            minHeight="10em"
            target={mapId}
            tag="Theme"
            orientation="parents"
        />
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em' }}>Unshown Rooms</Box>
        <UnshownRooms />
        <Box sx={{ width: '100%', background: blue[50], marginBottom: '0.5em', marginTop: '0.5em' }}>Map Layers</Box>
        <Box sx={{position: "relative", zIndex: 0 }}>
            { tree.map((item, index) => (<MapItemLayer key={`MapLayerBase-${index}`} item={item} />))}
        </Box>
    </MapLayersContext.Provider>

}

export default MapLayers
