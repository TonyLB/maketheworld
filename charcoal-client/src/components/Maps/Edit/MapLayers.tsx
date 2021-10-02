import React, { FunctionComponent, useReducer } from 'react'

import RoomGroupIcon from '@material-ui/icons/LocationCity'
import RoomIcon from '@material-ui/icons/Home'
import ExitGroupIcon from '@material-ui/icons/Shuffle'
import ExitIcon from '@material-ui/icons/CallMade'

import DraggableTree, { treeStateReducer, TreeReducerFn } from '../../DraggableTree'
import { NestedTree } from '../../DraggableTree/interfaces'

type MapLayersProps = {
}

type TestItemType = 'EXITGROUP' | 'EXIT' | 'ROOMGROUP' | 'ROOM'

type TestItem = {
    type: TestItemType;
    name: string;
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

const getMapKey = ({ name }: TestItem) => (name)

const typedTreeReducer: TreeReducerFn<TestItem> = treeStateReducer
export const MapLayers: FunctionComponent<MapLayersProps> = ({}) => {
    const [tree, treeDispatch]: [NestedTree<TestItem>, any] = useReducer<TreeReducerFn<TestItem>>(
        typedTreeReducer,
        [{
            key: 'One',
            item: {
                name: 'One',
                type: 'EXITGROUP'
            },
            children: [{
                key: 'One-A',
                item: {
                    name: 'One-A',
                    type: 'EXIT'
                },
                children: []
            },
            {
                key: 'One-B',
                item: {
                    name: 'One-B',
                    type: 'EXIT'
                },
                children: []
            }]
        },
        {
            key: 'Two',
            item: {
                name: 'Two',
                type: 'EXITGROUP'
            },
            children: []
        },
        {
            key: 'Three',
            item: {
                name: 'Three',
                type: 'ROOMGROUP'
            },
            children: [{
                key: 'Three-A',
                item: {
                    name: 'Three-A',
                    type: 'ROOMGROUP'
                },
                children: [{
                    key: 'Three-A-i',
                    item: {
                        name: 'Three-A-i',
                        type: 'ROOM'
                    },
                    children: []
                },
                {
                    key: 'Three-A-ii',
                    item: {
                        name: 'Three-A-ii',
                        type: 'ROOM'
                    },
                    children: []
                }]
            },
            {
                key: 'Three-B',
                item: {
                    name: 'Three-B',
                    type: 'ROOMGROUP'
                },
                children: []
            }]
        }]
    )
    return <DraggableTree
        tree={tree}
        getKey={getMapKey}
        renderComponent={simpleRender}
        renderHandle={handleRender}
        onOpen={(key) => { treeDispatch({ type: 'OPEN', key }) }}
        onClose={(key) => { treeDispatch({ type: 'CLOSE', key }) }}
        onMove={({ fromKey, toKey, position }) => { treeDispatch({ type: 'MOVE', fromKey, toKey, position })}}
    />
}

export default MapLayers
