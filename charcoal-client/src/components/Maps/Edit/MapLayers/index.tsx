import React, { FunctionComponent, useCallback, useContext, useMemo, useState } from 'react'

import RoomIcon from '@mui/icons-material/Home'
import ExitIcon from '@mui/icons-material/CallMade'
import LayersIcon from '@mui/icons-material/Layers'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import produce from 'immer'

import { recursiveUpdate } from '../../../DraggableTree'
import { NestedTreeEntry } from '../../../DraggableTree/interfaces'

import { MapItem, MapTree, ProcessedTestItem, InheritedVisibilityType } from '../maps'
import useMapStyles from '../useMapStyles'
import { MapDispatch } from '../reducer'
import { Box, Stack, Typography } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import { grey } from '@mui/material/colors'
import { useDispatch, useSelector } from 'react-redux'
import { mapEditConditionState, toggle } from '../../../../slices/UI/mapEdit'
import { useMapContext } from '../../Controller'
import { taggedMessageToString } from '@tonylb/mtw-interfaces/dist/messages'
import { MapTreeItem } from '../../Controller/baseClasses'
import { GenericTreeNode } from '@tonylb/mtw-sequence/dist/tree/baseClasses'

type MapLayersProps = {
    mapId: string;
}

const VisibilityControl = ({ visible, onClick }: { visible: InheritedVisibilityType; onClick: () => void }) => {
    const localClasses = useMapStyles()
    return <div
        className={["True", "False"].includes(visible) ? localClasses.visibilityControl : localClasses.overriddenVisibilityControl }
        onClick={onClick}
    >
        {(["True", "OverrideTrue"].includes(visible)) ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
    </div>
}

const SimpleRender: FunctionComponent<ProcessedTestItem & { itemKey?: string; setVisibility: (key: string, value: boolean) => void }> = ({ itemKey, name, visible, setVisibility }) => {
    const localClasses = useMapStyles()
    return <div className={localClasses.renderWrapper}>
        { itemKey && <VisibilityControl onClick={() => { setVisibility(itemKey, !(['True', 'OverrideTrue'].includes(visible))) }} visible={visible} /> }
        <div className={localClasses.renderContent}>{name}</div>
    </div>
}

const renderComponent = (setVisibility: (key: string, value: boolean) => void) => ((props: ProcessedTestItem & { key? : string }) => (<SimpleRender setVisibility={setVisibility} {...props} />))

const handleRender = ({ type }: ProcessedTestItem): React.ReactNode => {
    switch(type) {
        case 'GROUP':
            return <LayersIcon />
        case 'EXIT':
            return <ExitIcon />
        case 'ROOM':
            return <RoomIcon />
    }
}

const canDrop = ({ dropEntry, toEntry }: { dropEntry: ProcessedTestItem, toEntry: ProcessedTestItem | null, position: number | null}) => {
    if (toEntry) {
        switch(toEntry.type) {
            case 'GROUP':
                return true
            default:
                return false
        }
    }
    else {
        return dropEntry.type === 'GROUP'
    }
}

const setTreeVisibility = (tree: MapTree, { key, visibility }: { key: string, visibility: boolean }): MapTree => (
    produce(tree, (draft) => {
        recursiveUpdate<MapItem>(draft as MapTree, (probe: NestedTreeEntry<MapItem>) => {
            if (probe.key === key) {
                probe.item.visible = visibility
            }
        })
    })
)

const setInheritedVisibility = ({ children, item, ...rest }: NestedTreeEntry<MapItem>): NestedTreeEntry<ProcessedTestItem> => {
    const visible = item.visible ? 'OverrideTrue' : 'OverrideFalse'
    return {
        item: {
            ...item,
            visible
        },
        children: children.map(setInheritedVisibility),
        ...rest
    }
}

const processTreeVisibility = ({ children, item, ...rest }: NestedTreeEntry<MapItem>): NestedTreeEntry<ProcessedTestItem> => {
    if (item.visible) {            
        return {
            item: {
                ...item,
                visible: 'True'
            },
            children: children.map(processTreeVisibility),
            ...rest
        }
    }
    else {
        return {
            item: {
                ...item,
                visible: 'False'
            },
            children: children.map(setInheritedVisibility),
            ...rest
        }
    }
}

type MapLayersContextType = {
    mapId: string;
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({ mapId: '' })
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited, children }) => {
    const { inheritedInvisible } = useMapLayersContext()
    return <React.Fragment>
        <Box sx={{ borderRadius: '0.5em', margin: '0.25em', border: '1.5px solid', borderColor: inheritedInvisible ? grey[200] : grey[500], overflow: 'hidden' }}>
            <Stack direction="row">
                <Box sx={{ background: inheritedInvisible ? grey[100] : grey[300], paddingLeft: '0.5em', paddingRight: '0.25em', marginRight: '0.25em' }}>
                    {
                        inherited
                            ? <CopyAllIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                            : <HomeIcon sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                    }
                </Box>
                <Typography color={inheritedInvisible ? grey[500] : 'black' }>
                    { name }
                </Typography>
            </Stack>
        </Box>
        { children }
    </React.Fragment>
}

const ExitLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited }) => {
    const { inheritedInvisible } = useMapLayersContext()
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', marginLeft: '0.75em', border: '1px solid', borderColor: inheritedInvisible ? grey[100] : grey[300], overflow: 'hidden' }}>
        <Stack direction="row">
            <Box sx={{ background: inheritedInvisible ? grey[50] : grey[200], paddingLeft: '0.35em', paddingRight: '0.25em', marginTop: '-0.2em', marginRight: '0.25em' }}>
                {
                    inherited
                        ? <CopyAllIcon fontSize="small" sx={{ fontSize: '12px', color: inheritedInvisible ? grey[500] : 'black' }} />
                        : <ArrowIcon fontSize="small" sx={{ fontSize: '12px', color: inheritedInvisible ? grey[500] : 'black' }} />
                }
            </Box>
            <Typography variant='overline' fontSize="8px" color={inheritedInvisible ? grey[500] : 'black' }>
                to: { name }
            </Typography>
        </Stack>
    </Box>
}

const ConditionLayer: FunctionComponent<{ src: string, conditionId: string }> = ({ src, conditionId, children }) => {
    const { inheritedInvisible, mapId } = useMapLayersContext()
    const dispatch = useDispatch()
    const visible = !useSelector(mapEditConditionState(mapId, conditionId))
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', marginTop: '1em', border: '1.5px dashed', borderColor: inheritedInvisible ? grey[100] : grey[300] }}>
        <Box sx={{
            top: '-0.75em',
            left: '0.5em',
            position: 'relative',
            background: 'white',
            border: '1px solid',
            borderRadius: '0.5em',
            borderColor: grey[300],
            maxWidth: '60%',
            overflow: 'hidden'
        }}>
            <Stack direction="row">
                <Box
                    sx={{
                        background: inheritedInvisible ? grey[50] : grey[200],
                        paddingLeft: '0.25em',
                        paddingTop: '0.2em',
                        paddingBottom: '-0.2em',
                        paddingRight: '0.25em',
                        marginRight: '0.25em',
                        cursor: 'pointer'
                    }}
                    onClick={inheritedInvisible ? () => {} : () => { dispatch(toggle({ mapId, key: conditionId })) }}
                >
                    {
                        (visible && !inheritedInvisible)
                            ? <VisibilityIcon fontSize="small" />
                            : <VisibilityOffIcon fontSize="small" sx={{ color: inheritedInvisible ? grey[500] : 'black' }} />
                    }
                </Box>
                <Typography color={inheritedInvisible ? grey[500] : 'black' }>
                    { src }
                </Typography>
            </Stack>
        </Box>
        <Box sx={{ top: '-0.5em', marginLeft: '1em', position: 'relative' }}>
            {
                !visible
                    ? <MapLayersContext.Provider value={{ mapId, inheritedInvisible: true }}>{ children }</MapLayersContext.Provider>
                    : children
            }
        </Box>
    </Box>
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
        <Box sx={{position: "relative", zIndex: 0 }}>
            { tree.map((item, index) => (<MapItemLayer key={`MapLayerBase-${index}`} item={item} />))}
        </Box>
    </MapLayersContext.Provider>

}

export default MapLayers
