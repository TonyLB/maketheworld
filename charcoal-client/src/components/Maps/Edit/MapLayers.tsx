import React, { FunctionComponent, useMemo } from 'react'

import RoomIcon from '@mui/icons-material/Home'
import ExitIcon from '@mui/icons-material/CallMade'
import LayersIcon from '@mui/icons-material/Layers'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import produce from 'immer'

import DraggableTree, { treeStateReducer, recursiveUpdate } from '../../DraggableTree'
import { NestedTree, NestedTreeEntry } from '../../DraggableTree/interfaces'

import { MapItem, MapTree, ProcessedTestItem, InheritedVisibilityType } from './maps'
import useMapStyles from './useMapStyles'
import { MapDispatch } from './reducer.d'

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
    return <DraggableTree
        tree={processedTree}
        renderComponent={renderComponent((key, visibility) => { setTree(setTreeVisibility(tree, { key, visibility })) })}
        renderHandle={handleRender}
        onOpen={(key) => { setTree(treeStateReducer(tree, { type: 'OPEN', key })) } }
        onClose={(key) => { setTree(treeStateReducer(tree, { type: 'CLOSE', key })) } }
        onMove={({ fromKey, toKey, position }) => { setTree(treeStateReducer(tree, { type: 'MOVE', fromKey, toKey, position })) }}
        canDrop={canDrop}
    />
}

export default MapLayers
