import React, { FunctionComponent, useReducer, useState, useMemo } from 'react'
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

type DraggableTreeProps<T> = {
    tree: NestedTree<T>,
    getKey: (arg: T) => string,
    renderComponent: (arg: T) => React.ReactNode,
    onOpen: (key: string) => void,
    onClose: (key: string) => void
    //
    // ToDo:  Create callbacks for all data-changes that the tree can percolate
    // up to the lifted state (e.g. "onOpen", "onClose")
    //
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

const recursiveUpdate = <T extends object>(tree: NestedTree<T>, update: (arg: NestedTreeEntry<T>) => void ): void => {
    tree.forEach(item => {
        update(item)
        recursiveUpdate(item.children, update)
    })
}

export const treeStateReducer = <T extends object>(getKey: (arg: T) => string) => (state: NestedTree<T>, action: TreeAction): NestedTree<T> => (
    produce(state, draft => {
        switch(action.type) {
            case 'CLOSE':
                recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                    if (getKey(entry.item) === action.key) {
                        entry.open = false
                    }
                })
                break;
            case 'OPEN':
                recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                    if (getKey(entry.item) === action.key) {
                        entry.open = true
                    }
                })
                break;
            }
    })
)

export const DraggableTree = <T extends object>({
        tree,
        getKey,
        renderComponent,
        onOpen,
        onClose
    }: DraggableTreeProps<T>) => {
    const localClasses = useDraggableTreeStyles()
    const [draggingItem, setDraggingItem]: [T | null, any] = useState(null)
    const items = useMemo(() => {
            let calculationTree = tree
            if (draggingItem) {
                calculationTree = produce(calculationTree, draft => {
                    const draggingKey = getKey(draggingItem)
                    recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                        if (getKey(entry.item) === draggingKey) {
                            entry.draggingSource = true
                            entry.open = false
                        }
                    })
                })
            }
            return nestedToFlat(calculationTree)
        }, [tree, draggingItem])
    const maxLevel = items.reduce((previous, { level }) => ((level > previous) ? level : previous), 0)
    const lastRootRow = findIndexFromRight<FlatTreeRow<T>>(items, ({ level }) => (level === 0))

    const [draggingStyles, draggingApi] = useSpring(() => ({ opacity: 0, zIndex: -10, y: 0, x: 0, immediate: true }))


    const bind = useDrag(({ args: [item, startY, startX], active, last, first, movement: [x, y] }) => {
        if (first) {
            setDraggingItem({ ...item })
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
        }
        if (last) {
            setDraggingItem(null)
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
            <TreeContent item={draggingItem} renderComponent={renderComponent} />
        </animated.div>
        { items.map(({ level, verticalRows = 0, open, draggingSource, item }, index) => {
            return <div style={{
                    position: 'absolute',
                    height: `30px`,
                    zIndex: 2,
                    top: `${index * 32}px`
                }}
                key={getKey(item)}
            >
                <div
                    className={`${localClasses.Highlighted} ${(draggingSource && localClasses.DraggingSource) || ''}`}
                    style={{
                        transform: `translate3d(${(level + 1) * 34}px,0px, 0)`
                    }}
                >
                    { (open !== undefined) && <Collapsar left={-17} open={open} onClick={() => {
                            if (open) {
                                onClose(getKey(item))
                            }
                            else {
                                onOpen(getKey(item))
                            }
                        }} />
                    }
                    <HorizontalLine />
                    <VerticalLine left={17} height={`${verticalRows > 0 ? (verticalRows * 30) - 15 : 0}px`} />
                    <TreeContent item={item} bind={bind(item, index * 32, (level + 1) * 32)} renderComponent={renderComponent} />
                </div>
            </div>
        })}
    </div>
}

export default DraggableTree
