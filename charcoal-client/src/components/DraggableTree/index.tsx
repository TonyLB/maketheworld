import React, { useState, useMemo, Reducer } from 'react'
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

const findIndexFromRight = <T extends unknown>(arr: T[], test: (arg: T) => boolean): number | null => (arr.reduceRight<number | null>((previous, item, index) => (previous ? previous : test(item) ? index : null), null))

type TreeAction<T extends object> = {
    type: 'CLOSE',
    key: string
} | {
    type: 'OPEN',
    key: string
} | {
    type: 'ADD',
    parentKey?: string,
    position: number,
    entry: NestedTreeEntry<T>
}

const recursiveUpdate = <T extends object>(tree: NestedTree<T>, update: (arg: NestedTreeEntry<T>) => void ): void => {
    tree.forEach(item => {
        update(item)
        recursiveUpdate(item.children, update)
    })
}

export type TreeReducerFn<T extends object> = Reducer<NestedTree<T>, TreeAction<T>>

export const treeStateReducer = <T extends object>(state: NestedTree<T>, action: TreeAction<T>): NestedTree<T> => (
    produce(state, draft => {
        switch(action.type) {
            case 'CLOSE':
                recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                    if (entry.key === action.key) {
                        entry.open = false
                    }
                })
                break;
            case 'OPEN':
                recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                    if (entry.key === action.key) {
                        entry.open = true
                    }
                })
                break;
            case 'ADD':
                const { parentKey, position, entry } = action
                if (parentKey !== undefined) {
                    recursiveUpdate(draft as NestedTree<T>, (probeEntry: NestedTreeEntry<T>) => {
                        if (probeEntry.key === parentKey) {
                            probeEntry.children.splice(position, 0, entry)
                        }
                    })
                }
                else {
                    (draft as NestedTree<T>).splice(position, 0, entry)
                }
                break;
        }
    })
)

type DraggingTarget = {
    parentKey: string;
    position: number
} | null

type DraggingEntry<T> = FlatTreeRow<T> | null

export const DraggableTree = <T extends object>({
        tree,
        getKey,
        renderComponent,
        onOpen,
        onClose
    }: DraggableTreeProps<T>) => {
    const localClasses = useDraggableTreeStyles()
    const [draggingEntry, setDraggingEntry]: [DraggingEntry<T>, any] = useState<DraggingEntry<T>>(null)
    const [draggingTarget, setDraggingTarget]: [DraggingTarget, any] = useState<DraggingTarget>(null)
    const [items, displayItems] = useMemo(() => {
            let calculationTree = tree
            let displayTree = tree
            if (draggingEntry) {
                calculationTree = produce(calculationTree, draft => {
                    const draggingKey = draggingEntry.key
                    recursiveUpdate(draft as NestedTree<T>, (entry: NestedTreeEntry<T>) => {
                        if (entry.key === draggingKey) {
                            entry.draggingSource = true
                            entry.open = false
                        }
                    })
                })
                displayTree = calculationTree
                if (draggingTarget) {
                    const { parentKey, position } = draggingTarget
                    displayTree = treeStateReducer(displayTree, {
                        type: 'ADD',
                        parentKey,
                        position,
                        entry: {
                            key: draggingEntry.key,
                            item: draggingEntry.item,
                            children: [],
                            draggingTarget: true
                        }
                    })
                }
            }
            return [nestedToFlat(calculationTree), nestedToFlat(displayTree)]
        }, [tree, draggingEntry, draggingTarget])
    const maxLevel = displayItems.reduce((previous, { level }) => ((level > previous) ? level : previous), 0)
    //
    // TODO: Refactor so that lastRootRow displays correctly when dragging to end of root level
    //
    const lastRootRow = findIndexFromRight<FlatTreeRow<T>>(displayItems, ({ level }) => (level === 0))

    const [draggingStyles, draggingApi] = useSpring(() => ({ opacity: 0, zIndex: -10, y: 0, x: 0, immediate: true }))

    const bind = useDrag(({ args: [entry, startY, startX], active, last, first, movement: [x, y] }) => {
        if (first) {
            setDraggingEntry({ ...entry })
            draggingApi({ opacity: 1 })
        }
        if (active) {
            //
            // TODO: Refactor so that draggingTarget is not legitimate if it would end in the same position
            // as the draggingSource (even if the target isn't being dragged visually over the source to
            // cause that outcome)
            //
            if (draggingStyles.zIndex?.set) {
                draggingStyles.zIndex.set(10)
            }
            if (draggingStyles.x?.set) {
                draggingStyles.x.set(clamp(startX + x, 0, (maxLevel + 2) * 32))
            }
            if (draggingStyles.y?.set) {
                draggingStyles.y.set(startY + y)
            }
            const rowIndex = clamp(Math.floor((startY + y + 16) / 32), 0, items.length)
            let newParentKey: string | undefined = undefined
            let newPosition: number | null = null
            if (rowIndex === 0) {
                newPosition = 0
            }
            else {
                const prospectives = [...items[rowIndex - 1].draggingPoints, { key: items[rowIndex - 1].key, position: 0 }]
                const closestProspective = prospectives
                    .map((value, index) => ({ ...value, xOffset: Math.abs((index + 1) * 32 - (startX + x)) }))
                    .reduce<{ key?: string, position: number | null, xOffset: number }>((previous, value) => ((value.xOffset < previous.xOffset) ? value : previous ), { position: null, xOffset: Infinity })
                newParentKey = closestProspective.key
                newPosition = closestProspective.position
            }
            if (rowIndex > 0 && items[rowIndex - 1].draggingSource) {
                setDraggingTarget(null)
            }
            else {
                if (draggingTarget) {
                    if (!(newParentKey === draggingTarget.parentKey) || (newPosition !== draggingTarget.position)) {
                        setDraggingTarget({ parentKey: newParentKey, position: newPosition })
                    }
                }
                else {
                    setDraggingTarget({ parentKey: newParentKey, position: newPosition })
                }    
            }
        }
        if (last) {
            setDraggingEntry(null)
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
            }}
        >
            <TreeContent item={draggingEntry && draggingEntry.item} renderComponent={renderComponent} />
        </animated.div>
        { displayItems.map((entry, index) => {
            const { level, verticalRows = 0, open, draggingSource, draggingTarget, item } = entry
            return <div style={{
                    position: 'absolute',
                    height: `30px`,
                    zIndex: 2,
                    top: `${index * 32}px`
                }}
                key={draggingTarget ? `target-${getKey(item)}` : getKey(item) }
            >
                <div
                    className={`${localClasses.Highlighted} ${(draggingSource && localClasses.DraggingSource) || ''} ${(draggingTarget && localClasses.DraggingTarget) || ''}`}
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
                    <TreeContent item={item} bind={bind(entry, index * 32, (level + 1) * 32)} renderComponent={renderComponent} />
                </div>
            </div>
        })}
    </div>
}

export default DraggableTree
