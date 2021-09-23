import React, { FunctionComponent, useReducer } from 'react'

import { NestedTree, NestedTreeEntry, FlatTree, FlatTreeRow } from './interfaces'

import nestedToFlat from './nestedToFlat'

import VerticalLine from './TreeStructure/Vertical'
import HorizontalLine from './TreeStructure/Horizontal'
import SideVerticalLine from './TreeStructure/SideVertical'
import Collapsar from './TreeStructure/Collapsar'
import useMapStyles from '../Maps/Edit/useMapStyles'
import produce from 'immer'

type MapLayersProps = {
}

type TestItem = {
    name: string
}

const clamp = (value: number, min: number, max: number): number => (
    value < min ? min : value > max ? max : value
)

const arrayMove = (values: any[], from: number, to: number, rows: number = 1): any[] => {
    return produce(values, (draftState) => {
        draftState.splice(to, 0, ...draftState.splice(from, rows))
    })
}

const fn = (order: number[], active?: boolean, originalIndex?: number, curIndex?: number, y?: number) => (index: number): { y: number, scale: number, zIndex: any, shadow: number, immediate: any } =>
  active && index === originalIndex
    ? { y: 20 + (curIndex ?? 0) * 40 + (y ?? 0), scale: 1.1, zIndex: 1, shadow: 15, immediate: (n: string): boolean => n === 'y' || n === 'zIndex' }
    : { y: 20 + order.indexOf(index) * 40, scale: 1, zIndex: 0, shadow: 1, immediate: false }

const findIndexFromRight = <T extends unknown>(arr: T[], test: (arg: T) => boolean): number | null => (arr.reduceRight<number | null>((previous, item, index) => (previous ? previous : test(item) ? index : null), null))

type TreeAction = {
    type: 'CLOSE',
    key: string
} | {
    type: 'OPEN',
    key: string
}

const recursiveUpdate = (tree: NestedTree<TestItem>, update: (arg: NestedTreeEntry<TestItem>) => void ): void => {
    tree.forEach(item => {
        update(item)
        recursiveUpdate(item.children, update)
    })
}

const treeStateReducer = (state: NestedTree<TestItem>, action: TreeAction): NestedTree<TestItem> => (
    produce(state, draft => {
        switch(action.type) {
            case 'CLOSE':
                recursiveUpdate(draft, (item: NestedTreeEntry<TestItem>) => {
                    if (item.name === action.key) {
                        item.open = false
                    }
                })
                break;
            case 'OPEN':
                recursiveUpdate(draft, (item: NestedTreeEntry<TestItem>) => {
                    if (item.name === action.key) {
                        item.open = true
                    }
                })
                break;
            }
    })
)

export const DraggableTree: FunctionComponent<MapLayersProps>= ({}) => {
    const localClasses = useMapStyles()
    const [treeOne, treeDispatch]: [NestedTree<TestItem>, any] = useReducer(
        treeStateReducer,
        [{
            name: 'One',
            children: [{
                name: 'One-A',
                children: []
            },
            {
                name: 'One-B',
                children: []
            }]
        },
        {
            name: 'Two',
            children: []
        },
        {
            name: 'Three',
            children: [{
                name: 'Three-A',
                children: [{
                    name: 'Three-A-i',
                    children: []
                },
                {
                    name: 'Three-A-ii',
                    children: []
                }]
            },
            {
                name: 'Three-B',
                children: []
            }]
        }]
    )
    const items = nestedToFlat(treeOne)
    const lastRootRow = findIndexFromRight<FlatTreeRow<TestItem>>(items, ({ level }) => (level === 0))

    // const bind = useDrag(({ args: [originalIndex], active, movement: [, y] }) => {
    //     const curIndex = order.current.indexOf(originalIndex)
    //     const curRow = clamp(Math.round((curIndex * 40 + y) / 40), 0, items.length - 1)
    //     const newOrder = arrayMove(order.current, curIndex, curRow)
    //     setSprings(fn(newOrder, active, originalIndex, curIndex, y)) // Feed springs new style data, they'll animate the view without causing a single render
    //     if (!active) order.current = newOrder
    // })
    
    return <div style={{position: "relative", zIndex: 0 }}>
        <SideVerticalLine height={(lastRootRow === null) ? 0 : lastRootRow * 30} />
        { items.map(({ name, level, verticalRows, open }) => (
            <div style={{
                height: `30px`,
                zIndex: 2,
            }}>
                <div
                    className={localClasses.highlighted}
                    style={{
                        transform: `translate3d(${(level + 1) * 30}px,0px, 0)`
                    }}
                >
                    { (open !== undefined) && <Collapsar left={-15} open={open} onClick={() => { treeDispatch({ type: open ? 'CLOSE' : 'OPEN', key: name })}} />}
                    <HorizontalLine />
                    <VerticalLine left={15} height={`${verticalRows > 0 ? (verticalRows * 30) - 15 : 0}px`} />
                    <div>
                        {name}
                    </div>
                </div>
            </div>
        ))}
    </div>
}

export default DraggableTree
