import { FunctionComponent, useReducer } from 'react'

import DraggableTree from '../../DraggableTree/DraggableTree'
import { NestedTree } from '../../DraggableTree/interfaces'

type MapLayersProps = {
}

type TestItem = {
    name: string
}

const simpleRender = ({ name }: TestItem): React.ReactNode => (name)

export const MapLayers: FunctionComponent<MapLayersProps> = ({}) => {
    const [tree, treeDispatch]: [NestedTree<TestItem>, any] = useReducer(
        (state) => (state),
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
    console.log(tree)
    return <DraggableTree tree={tree} getKey={({ name }) => (name)} renderComponent={simpleRender}/>
}

export default MapLayers
