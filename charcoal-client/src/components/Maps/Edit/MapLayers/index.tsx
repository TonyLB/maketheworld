import React, { FunctionComponent, useContext, useMemo, useState } from 'react'

import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Box, Collapse, IconButton, List, ListItem, ListItemIcon, ListItemText } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import { grey } from '@mui/material/colors'
import { useDispatch, useSelector } from 'react-redux'
import { mapEditConditionState, toggle } from '../../../../slices/UI/mapEdit'
import { useMapContext } from '../../Controller'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { MapTreeItem } from '../../Controller/baseClasses'
import { GenericTreeNode } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { UnshownRooms } from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from './RenameIcon'

type MapLayersProps = {
    mapId: string;
}

type MapLayersContextType = {
    mapId: string;
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited, children }) => {
    const { inheritedInvisible } = useMapLayersContext()
    const [open, setOpen] = useState<boolean>(false)
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    return <React.Fragment>
        <ListItem dense>
            <ListItemIcon>
                {
                    inherited
                        ? <CopyAllIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                        : <HomeIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                }
            </ListItemIcon>
            <ListItemText primary={name} />
            <IconButton><RenameIcon /></IconButton>
            {
                childrenPresent && (open ? <ExpandLess onClick={() => { setOpen(false) }} /> : <ExpandMore onClick={() => { setOpen(true) }} />)
            }
        </ListItem>
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

const ConditionLayer: FunctionComponent<{ src: string, conditionId: string }> = ({ src, conditionId, children }) => {
    const { inheritedInvisible, mapId } = useMapLayersContext()
    const [open, setOpen] = useState<boolean>(false)
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const dispatch = useDispatch()
    const visible = !useSelector(mapEditConditionState(mapId, conditionId))
    const visibilityOnClick = inheritedInvisible ? () => {} : () => { dispatch(toggle({ mapId, key: conditionId })) }

    return <React.Fragment>
        <ListItem dense>
            <ListItemIcon>
                {
                    (visible && !inheritedInvisible)
                        ? <VisibilityIcon fontSize="small" onClick={visibilityOnClick} />
                        : <VisibilityOffIcon fontSize="small" sx={{ color: inheritedInvisible ? grey[500] : 'black' }} onClick={visibilityOnClick} />
                }
            </ListItemIcon>
            <ListItemText primary={`If: ${src}`} />
            {
                childrenPresent && (open ? <ExpandMore onClick={() => { setOpen(false) }} /> : <ExpandLess onClick={() => { setOpen(true) }} />)
            }
        </ListItem>
        { childrenPresent && 
            <Collapse in={open} timeout="auto" unmountOnExit><List>
                {
                    !visible
                        ? <MapLayersContext.Provider value={{ mapId, inheritedInvisible: true }}><List component="div" disablePadding sx={{ paddingLeft: '1em' }}>{ children }</List></MapLayersContext.Provider>
                        : children
                }
            </List></Collapse>
        }
    </React.Fragment>
}

//
// MapItemLayer component accepts any of GenericTreeNode<MapItem>, and farms out the top-level
// data render to the appropriate component, passing children that are recursive calls of MapItemLayer on the
// children values
//
const MapItemLayer: FunctionComponent<{ item: GenericTreeNode<MapTreeItem> }> = ({ item }) => {
    switch(item.data.tag) {
        case 'Room':
            return <RoomLayer name={taggedMessageToString(item.data.name as any) || item.data.key}>
                { item.children.map((child, index) => (<MapItemLayer key={`${item.data.key}-Child-${index}`} item={child} />)) }
            </RoomLayer>
        case 'Exit':
            return <ExitLayer name={item.data.to} />
        case 'If':
            return <ConditionLayer src={item.data.conditions[0].if} conditionId={item.data.key}>
                { item.children.map((child, index) => (<MapItemLayer key={`${item.data.key}-Child-${index}`} item={child} />)) }
            </ConditionLayer>
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
        </Box>
    </MapLayersContext.Provider>

}

export default MapLayers
