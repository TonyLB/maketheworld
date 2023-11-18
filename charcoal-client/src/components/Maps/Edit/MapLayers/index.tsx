import React, { FunctionComponent, useCallback, useContext, useMemo, useState } from 'react'

import RoomIcon from '@mui/icons-material/Home'
import ExitIcon from '@mui/icons-material/CallMade'
import LayersIcon from '@mui/icons-material/Layers'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import produce from 'immer'

import DraggableTree, { treeStateReducer, recursiveUpdate } from '../../../DraggableTree'
import { NestedTree, NestedTreeEntry } from '../../../DraggableTree/interfaces'

import { MapItem, MapTree, ProcessedTestItem, InheritedVisibilityType } from '../maps'
import useMapStyles from '../useMapStyles'
import { MapDispatch } from '../reducer'
import { Box, Stack, Typography } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import ArrowIcon from '@mui/icons-material/CallMade'
import { grey } from '@mui/material/colors'
import { useDispatch, useSelector } from 'react-redux'
import { mapEditAllConditions, mapEditConditionState, toggle } from '../../../../slices/UI/mapEdit'
import { useLibraryAsset } from '../../../Library/Edit/LibraryAsset'
import { isNormalMap } from '@tonylb/mtw-wml/dist/normalize/baseClasses'

type MapLayersProps = {
    mapId: string;
    tree: MapTree;
    dispatch: MapDispatch;
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

const RoomLayer: FunctionComponent<{ name: string, inherited?: boolean }> = ({ name, inherited }) => {
    const { inheritedInvisible } = useMapLayersContext()
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', border: '1.5px solid', borderColor: inheritedInvisible ? grey[200] : grey[500], overflow: 'hidden' }}>
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

export const MapLayers: FunctionComponent<MapLayersProps> = ({ mapId, tree, dispatch }) => {
    //
    // TODO: Use orderedConditionalTree method on Normalizer, with Map and Exit filter, to
    // derive an ordered conditional tree from the current normalForm, and derive from
    // that the items to display
    //
    const { normalForm } = useLibraryAsset()
    const topLevelRooms = useMemo<{ key: string; name: string }[]>(() => {
        const mapItem = normalForm[mapId]
        if (mapItem && isNormalMap(mapItem)) {
            return mapItem.appearances.map<{ key: string; name: string }[]>(
                ({ rooms }) => (
                    rooms
                        .filter(({ conditions }) => (conditions.length === 0))
                        .map(({ key }) => ({
                            key,
                            name: ''
                        }))
                )
            ).flat(1)
        }
        else {
            return []
        }
    }, [normalForm])
    const processedTree = useMemo<NestedTree<ProcessedTestItem>>(() => (
        tree.map<NestedTreeEntry<ProcessedTestItem>>(processTreeVisibility)
    ), [tree])
    const setTree = (tree: MapTree): void => {
        dispatch({
            type: 'updateTree',
            tree
        })
    }
    return <MapLayersContext.Provider value={{ mapId }}>
        <Box sx={{position: "relative", zIndex: 0 }}>
            { topLevelRooms.map(({ key, name }) => (<RoomLayer name={name || key} key={key} />))}
            {/* <RoomLayer name="Lobby" />
            <ExitLayer name="Stairs" />
            <RoomLayer name="Stairs" inherited />
            <ExitLayer name="Lobby" />
            <ConditionLayer
                src="defValue === true"
                conditionId="If-0"
            >
                <RoomLayer name="Closet" />
                <ConditionLayer
                    src="exitVisible"
                    conditionId="If-1"
                >
                    <RoomLayer name="Stairs" inherited />
                    <ExitLayer name="Closet" inherited />
                </ConditionLayer>
            </ConditionLayer> */}
        </Box>
    </MapLayersContext.Provider>

    // return <DraggableTree
    //     tree={processedTree}
    //     renderComponent={renderComponent((key, visibility) => { setTree(setTreeVisibility(tree, { key, visibility })) })}
    //     renderHandle={handleRender}
    //     onOpen={(key) => { setTree(treeStateReducer(tree, { type: 'OPEN', key })) } }
    //     onClose={(key) => { setTree(treeStateReducer(tree, { type: 'CLOSE', key })) } }
    //     onMove={({ fromKey, toKey, position }) => { setTree(treeStateReducer(tree, { type: 'MOVE', fromKey, toKey, position })) }}
    //     canDrop={canDrop}
    // />
}

export default MapLayers
