import { FunctionComponent, useReducer } from 'react'

import DraggableTree, { treeStateReducer, TreeReducerFn } from '../../DraggableTree'
import { NestedTree } from '../../DraggableTree/interfaces'

type MapLayersProps = {
}

type TestItem = {
    name: string
}

const simpleRender = ({ name }: TestItem): React.ReactNode => (name)

const getMapKey = ({ name }: TestItem) => (name)

const typedTreeReducer: TreeReducerFn<TestItem> = treeStateReducer
export const MapLayers: FunctionComponent<MapLayersProps> = ({}) => {
    const [tree, treeDispatch]: [NestedTree<TestItem>, any] = useReducer<TreeReducerFn<TestItem>>(
        typedTreeReducer,
        [{
            key: 'One',
            item: { name: 'One' },
            children: [{
                key: 'One-A',
                item: { name: 'One-A' },
                children: []
            },
            {
                key: 'One-B',
                item: { name: 'One-B' },
                children: []
            }]
        },
        {
            key: 'Two',
            item: { name: 'Two' },
            children: []
        },
        {
            key: 'Three',
            item: { name: 'Three' },
            children: [{
                key: 'Three-A',
                item: { name: 'Three-A' },
                children: [{
                    key: 'Three-A-i',
                    item: { name: 'Three-A-i' },
                    children: []
                },
                {
                    key: 'Three-A-ii',
                    item: { name: 'Three-A-ii' },
                    children: []
                }]
            },
            {
                key: 'Three-B',
                item: { name: 'Three-B' },
                children: []
            }]
        }]
    )
    return <DraggableTree
        tree={tree}
        getKey={getMapKey}
        renderComponent={simpleRender}
        onOpen={(key) => { treeDispatch({ type: 'OPEN', key }) }}
        onClose={(key) => { treeDispatch({ type: 'CLOSE', key }) }}
        onMove={({ fromKey, toKey, position }) => { treeDispatch({ type: 'MOVE', fromKey, toKey, position })}}
    />
}

export default MapLayers
