import React, { FunctionComponent, useMemo } from 'react'

import RoomGroupIcon from '@material-ui/icons/LocationCity'
import RoomIcon from '@material-ui/icons/Home'
import ExitGroupIcon from '@material-ui/icons/Shuffle'
import ExitIcon from '@material-ui/icons/CallMade'
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff'
import VisibilityIcon from '@material-ui/icons/Visibility'
import produce from 'immer'

import DraggableTree, { treeStateReducer, recursiveUpdate } from '../../DraggableTree'
import { NestedTree, NestedTreeEntry } from '../../DraggableTree/interfaces'

import { TestItem, MapTree, ProcessedTestItem, InheritedVisibilityType } from './maps'
import useMapStyles from './useMapStyles'

type MapLayersProps = {
    tree: MapTree;
    setTree: (arg: MapTree) => void;
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
        case 'EXITGROUP':
            return <ExitGroupIcon />
        case 'EXIT':
            return <ExitIcon />
        case 'ROOMGROUP':
            return <RoomGroupIcon />
        case 'ROOM':
            return <RoomIcon />
    }
}

const canDrop = ({ dropEntry, toEntry }: { dropEntry: ProcessedTestItem, toEntry: ProcessedTestItem | null, position: number | null}) => {
    if (toEntry) {
        switch(toEntry.type) {
            case 'EXITGROUP':
                return ['EXITGROUP', 'EXIT'].includes(dropEntry.type)
            case 'ROOMGROUP':
                return ['ROOMGROUP', 'ROOM'].includes(dropEntry.type)
            default:
                return false
        }
    }
    else {
        return ['EXITGROUP', 'ROOMGROUP'].includes(dropEntry.type)
    }
}

const setTreeVisibility = (tree: MapTree, { key, visibility }: { key: string, visibility: boolean }): MapTree => (
    produce(tree, (draft) => {
        recursiveUpdate<TestItem>(draft as MapTree, (probe: NestedTreeEntry<TestItem>) => {
            if (probe.key === key) {
                probe.item.visible = visibility
            }
        })
    })
)

const setInheritedVisibility = ({ children, item, ...rest }: NestedTreeEntry<TestItem>): NestedTreeEntry<ProcessedTestItem> => {
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

const processTreeVisibility = ({ children, item, ...rest }: NestedTreeEntry<TestItem>): NestedTreeEntry<ProcessedTestItem> => {
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

export const MapLayers: FunctionComponent<MapLayersProps> = ({ tree, setTree }) => {
    const processedTree = useMemo<NestedTree<ProcessedTestItem>>(() => (
        tree.map<NestedTreeEntry<ProcessedTestItem>>(processTreeVisibility)
    ), [tree])
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
