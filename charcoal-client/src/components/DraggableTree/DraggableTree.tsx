import React, { FunctionComponent, useReducer, useState } from 'react'
import { makeStyles } from "@material-ui/core/styles"
import { useSpring, animated } from 'react-spring'
import { useDrag } from 'react-use-gesture'

import { NestedTree, NestedTreeEntry, FlatTreeRow } from './interfaces'

import nestedToFlat from './nestedToFlat'

import VerticalLine from './TreeStructure/Vertical'
import HorizontalLine from './TreeStructure/Horizontal'
import SideVerticalLine from './TreeStructure/SideVertical'
import Collapsar from './TreeStructure/Collapsar'
import TreeContent from './TreeStructure/TreeContent'
import produce from 'immer'
import useDraggableTreeStyles from './useTreeStyles'

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
    const localClasses = useDraggableTreeStyles()
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
    const maxLevel = items.reduce((previous, { level }) => ((level > previous) ? level : previous), 0)
    const lastRootRow = findIndexFromRight<FlatTreeRow<TestItem>>(items, ({ level }) => (level === 0))

    const [draggingStyles, draggingApi] = useSpring(() => ({ opacity: 0, zIndex: -10, y: 0, x: 0, immediate: true }))

    const [draggingName, setDraggingName] = useState('')

    const bind = useDrag(({ args: [name, startY, startX], active, last, first, movement: [x, y] }) => {
        if (first) {
            setDraggingName(name)
            draggingApi({ opacity: 1 })
        }
        if (active) {
            if (draggingStyles.zIndex?.set) {
                draggingStyles.zIndex.set(10)
            }
            if (draggingStyles.x?.set) {
                draggingStyles.x.set(clamp(startX + x, 0, (maxLevel + 2) * 32))
            }
            if (draggingStyles.y?.set) {
                draggingStyles.y.set(startY + y)
            }
            // draggingApi({ x: startX + x, y: startY + y, immediate: true })
        }
        if (last) {
            // draggingApi([{ opacity: 0 }, { display: "none", immediate: true }])
            draggingApi([{ opacity: 0, zIndex: -10, immediate: (val) => (val === 'zIndex') }])
        }
    })
    
    return <div style={{position: "relative", zIndex: 0 }}>
        <SideVerticalLine height={(lastRootRow === null) ? 0 : lastRootRow * 30} />
        <animated.div
            className={`${localClasses.Highlighted} ${localClasses.Dragging}`}
            style={{
                opacity: draggingStyles.opacity as any,
                x: draggingStyles.x,
                y: draggingStyles.y,
                zIndex: draggingStyles.zIndex as any
                // display: draggingStyles.display as any
            }}
        >
            <TreeContent name={draggingName} />
        </animated.div>
        { items.map(({ name, level, verticalRows, open }, index) => (
            <div style={{
                    position: 'absolute',
                    height: `30px`,
                    zIndex: 2,
                    top: `${index * 32}px`
                }}
                key={name}
            >
                <div
                    className={localClasses.Highlighted}
                    style={{
                        transform: `translate3d(${(level + 1) * 34}px,0px, 0)`
                    }}
                >
                    { (open !== undefined) && <Collapsar left={-17} open={open} onClick={() => { treeDispatch({ type: open ? 'CLOSE' : 'OPEN', key: name })}} />}
                    <HorizontalLine />
                    <VerticalLine left={17} height={`${verticalRows > 0 ? (verticalRows * 30) - 15 : 0}px`} />
                    <TreeContent name={name} bind={bind(name, index * 32, (level + 1) * 32)} />
                </div>
            </div>
        ))}
    </div>
}

export default DraggableTree
