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
import { grey } from '@mui/material/colors'
import { useDispatch, useSelector } from 'react-redux'
import { mapEditConditionState, toggle } from '../../../../slices/UI/mapEdit'
import { useMapContext } from '../../Controller'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { MapTreeItem } from '../../Controller/baseClasses'
import { GenericTreeNode } from '@tonylb/mtw-wml/dist/sequence/tree/baseClasses'
import { UnshownRooms } from './UnshownRooms'
import { blue } from '@mui/material/colors'
import RenameIcon from './RenameIcon'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'
import { NormalReference } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { isSchemaRoom } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'

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
    const { normalForm, updateNormal } = useLibraryAsset()
    const [open, setOpen] = useState<boolean>(false)
    const [renaming, setRenaming] = useState<boolean>(false)
    const [nameEdit, setNameEdit] = useState<string>('')
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const onRename = useCallback((value: string) => {
        const normalizer = new Normalizer()
        normalizer._normalForm = normalForm
        const reference: NormalReference = { tag: 'Room', key: roomId, index: 0 }
        const baseSchema = normalizer.referenceToSchema(reference)
        if (isSchemaRoom(baseSchema)) {
            updateNormal({ type: 'put', item: { ...baseSchema, name: [{ tag: 'String', value }] }, position: { ...normalizer._referenceToInsertPosition(reference), replace: true } })
        }
    }, [normalForm, updateNormal, roomId])
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

const ConditionLayer: FunctionComponent<{ src: string, conditionId: string }> = ({ src, conditionId, children }) => {
    const { inheritedInvisible, mapId } = useMapLayersContext()
    const { UI: { hiddenBranches }, mapDispatch } = useMapContext()
    const [open, setOpen] = useState<boolean>(false)
    const childrenPresent = useMemo<boolean>(() => (Boolean(React.Children.count(children))), [children])
    const visible = useMemo(() => (!hiddenBranches.includes(conditionId)), [hiddenBranches])
    const visibilityOnClick = inheritedInvisible ? () => {} : () => { mapDispatch({ type: 'ToggleVisibility', key: conditionId }) }

    return <React.Fragment>
        <ListItem dense>
            <ListItemIcon>
                {
                    (visible && !inheritedInvisible)
                        ? <VisibilityIcon fontSize="small" sx={{ color: inheritedInvisible ? grey[500] : 'black' }} onClick={visibilityOnClick} />
                        : <VisibilityOffIcon fontSize="small" onClick={visibilityOnClick} />
                }
            </ListItemIcon>
            <ListItemText primary={`If: ${src}`} />
            {
                childrenPresent && (open ? <ExpandLess onClick={() => { setOpen(false) }} /> : <ExpandMore onClick={() => { setOpen(true) }} />)
            }
        </ListItem>
        { childrenPresent && 
            <Collapse in={open} timeout="auto" unmountOnExit><List>
                {
                    !visible
                        ? <MapLayersContext.Provider value={{ mapId, inheritedInvisible: true }}><List component="div" disablePadding sx={{ paddingLeft: '1em' }}>{ children }</List></MapLayersContext.Provider>
                        : <List component="div" disablePadding sx={{ paddingLeft: '1em' }}>{ children }</List>
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
            return <RoomLayer roomId={item.data.key} name={taggedMessageToString(item.data.name as any) || item.data.key}>
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
