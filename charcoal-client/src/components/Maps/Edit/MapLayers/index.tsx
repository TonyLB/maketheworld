import React, { FunctionComponent, useContext, useMemo } from 'react'

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
import ArrowIcon from '@mui/icons-material/CallMade'
import { grey } from '@mui/material/colors'

type MapLayersProps = {
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
    inheritedInvisible?: boolean;
}

const MapLayersContext = React.createContext<MapLayersContextType>({})
export const useMapLayersContext = () => (useContext(MapLayersContext))

const RoomLayer: FunctionComponent<{ name: string }> = ({ name }) => {
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', border: '1.5px solid', borderColor: grey[500], overflow: 'hidden' }}>
        <Stack direction="row">
            <Box sx={{ background: grey[300], paddingLeft: '0.5em', paddingRight: '0.25em', marginRight: '0.25em' }}>
                <HomeIcon />
            </Box>
            { name }
        </Stack>
    </Box>
}

const ExitLayer: FunctionComponent<{ name: string }> = ({ name }) => {
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', marginLeft: '0.75em', border: '1px solid', borderColor: grey[300], overflow: 'hidden' }}>
        <Stack direction="row">
            <Box sx={{ background: grey[200], paddingLeft: '0.35em', paddingRight: '0.25em', marginTop: '-0.2em', marginRight: '0.25em' }}>
                <ArrowIcon fontSize="small" sx={{ fontSize: '12px' }} />
            </Box>
            <Typography variant='overline' fontSize="8px">
                to: { name }
            </Typography>
        </Stack>
    </Box>
}

const ConditionLayer: FunctionComponent<{ src: string }> = ({ src, children }) => {
    return <Box sx={{ borderRadius: '0.5em', margin: '0.25em', marginTop: '1em', border: '1.5px dashed', borderColor: grey[300] }}>
        <Box sx={{
            top: '-0.75em',
            left: '0.5em',
            position: 'relative',
            background: 'white',
            border: '1px solid',
            borderRadius: '0.5em',
            borderColor: grey[300],
            paddingLeft: '0.25em',
            maxWidth: '60%'
        }}>
            { src }
        </Box>
        <Box sx={{ top: '-0.5em', marginLeft: '1em', position: 'relative' }}>
            { children }
        </Box>
    </Box>
}

export const MapLayers: FunctionComponent<MapLayersProps> = ({ tree, dispatch }) => {
    const processedTree = useMemo<NestedTree<ProcessedTestItem>>(() => (
        tree.map<NestedTreeEntry<ProcessedTestItem>>(processTreeVisibility)
    ), [tree])
    const setTree = (tree: MapTree): void => {
        dispatch({
            type: 'updateTree',
            tree
        })
    }
    return <MapLayersContext.Provider value={{}}>
        <Box sx={{position: "relative", zIndex: 0 }}>
            <RoomLayer name="Lobby" />
            <ExitLayer name="Stairs" />
            <RoomLayer name="Stairs" />
            <ExitLayer name="Lobby" />
            <ConditionLayer src="defValue === true">
                <RoomLayer name="Closet" />
                <ConditionLayer src="exitVisible">
                    <RoomLayer name="Stairs" />
                    <ExitLayer name="Closet" />
                </ConditionLayer>
            </ConditionLayer>
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
