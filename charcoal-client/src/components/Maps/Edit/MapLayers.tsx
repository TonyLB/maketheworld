import React, { FunctionComponent } from 'react'

import RoomGroupIcon from '@material-ui/icons/LocationCity'
import RoomIcon from '@material-ui/icons/Home'
import ExitGroupIcon from '@material-ui/icons/Shuffle'
import ExitIcon from '@material-ui/icons/CallMade'

import DraggableTree, { treeStateReducer } from '../../DraggableTree'

import { TestItem, MapTree } from './maps'

type MapLayersProps = {
    tree: MapTree;
    setTree: (arg: MapTree) => void;
}

const simpleRender = ({ name }: TestItem): React.ReactNode => (name)

const handleRender = ({ type }: TestItem): React.ReactNode => {
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

const canDrop = ({ dropEntry, toEntry }: { dropEntry: TestItem, toEntry: TestItem | null, position: number | null}) => {
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

const getMapKey = ({ name }: TestItem) => (name)

export const MapLayers: FunctionComponent<MapLayersProps> = ({ tree, setTree }) => {
    return <DraggableTree
        tree={tree}
        getKey={getMapKey}
        renderComponent={simpleRender}
        renderHandle={handleRender}
        onOpen={(key) => { setTree(treeStateReducer(tree, { type: 'OPEN', key })) } }
        onClose={(key) => { setTree(treeStateReducer(tree, { type: 'CLOSE', key })) } }
        onMove={({ fromKey, toKey, position }) => { setTree(treeStateReducer(tree, { type: 'MOVE', fromKey, toKey, position })) }}
        canDrop={canDrop}
    />
}

export default MapLayers
