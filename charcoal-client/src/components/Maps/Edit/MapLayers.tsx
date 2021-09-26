import { FunctionComponent, useReducer } from 'react'

import DraggableTree, { treeStateReducer } from '../../DraggableTree/DraggableTree'
import { NestedTree } from '../../DraggableTree/interfaces'

type MapLayersProps = {
}

type TestItem = {
    name: string
}

const simpleRender = ({ name }: TestItem): React.ReactNode => (name)

const getMapKey = ({ name }: TestItem) => (name)

export const MapLayers: FunctionComponent<MapLayersProps> = ({}) => {
    const [tree, treeDispatch]: [NestedTree<TestItem>, any] = useReducer(
        treeStateReducer(getMapKey),
        [{
            item: { name: 'One' },
            children: [{
                item: { name: 'One-A' },
                children: []
            },
            {
                item: { name: 'One-B' },
                children: []
            }]
        },
        {
            item: { name: 'Two' },
            children: []
        },
        {
            item: { name: 'Three' },
            children: [{
                item: { name: 'Three-A' },
                children: [{
                    item: { name: 'Three-A-i' },
                    children: []
                },
                {
                    item: { name: 'Three-A-ii' },
                    children: []
                }]
            },
            {
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
    />
}

export default MapLayers
