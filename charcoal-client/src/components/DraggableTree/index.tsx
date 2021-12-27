import React, { useState, useMemo, Reducer, FunctionComponent } from 'react'
import { useSpring, animated } from 'react-spring'
import { useDrag } from '@use-gesture/react'

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
    renderComponent: FunctionComponent<T & { key?: string }>,
    renderHandle: (arg: T) => React.ReactNode,
    onOpen?: (key: string) => void,
    onClose?: (key: string) => void,
    onMove?: (args: { fromKey: string, toKey?: string, position: number }) => void,
    canDrop?: (args: { dropEntry: T, toEntry: T | null, position: number }) => boolean
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
    type: 'REMOVE',
    fromKey: string
} | {
    type: 'ADD',
    toKey?: string,
    position: number,
    entry: NestedTreeEntry<T>
} | {
    type: 'MOVE',
    fromKey: string,
    toKey?: string,
    position: number,
}

export const recursiveUpdate = <T extends object>(tree: NestedTree<T>, update: (arg: NestedTreeEntry<T>) => void ): void => {
    tree.forEach(item => {
        update(item)
        recursiveUpdate(item.children, update)
    })
}

export const findInTree = <T extends object>(tree: NestedTree<T>, key: string): NestedTreeEntry<T> | undefined => (
    tree.reduce<NestedTreeEntry<T> | undefined>((previous, item) => (previous ? previous : (item.key === key) ? item : findInTree(item.children, key)), undefined)
)

export type TreeReducerFn<T extends object> = Reducer<NestedTree<T>, TreeAction<T>>

export const treeStateReducer = <T extends object>(state: NestedTree<T>, action: TreeAction<T>): NestedTree<T> => (
    produce(state, draft => {
        const addAction = ({ toKey, position, entry }: { toKey?: string, position: number, entry: NestedTreeEntry<T>}) => {
            if (toKey !== undefined) {
                recursiveUpdate(draft as NestedTree<T>, (probeEntry: NestedTreeEntry<T>) => {
                    if (probeEntry.key === toKey) {
                        probeEntry.children.splice(position, 0, entry)
                    }
                })
            }
            else {
                (draft as NestedTree<T>).splice(position, 0, entry)
            }
        }
        const removeAction = ({ fromKey }: { fromKey: string }) => {
            const topLevelIndex = draft.findIndex(({ key }) => (key === fromKey))
            if (topLevelIndex > -1) {
                draft.splice(topLevelIndex, 1)
            }
            else {
                recursiveUpdate(draft as NestedTree<T>, (probeEntry: NestedTreeEntry<T>) => {
                    probeEntry.children = probeEntry.children.filter(({ key }) => (key !== fromKey))
                })
            }
        }
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
                addAction(action)
                break;
            case 'REMOVE':
                removeAction(action)
                break;
            case 'MOVE':
                const entry: NestedTreeEntry<T> | undefined = findInTree(draft as NestedTree<T>, action.fromKey)
                if (entry) {
                    removeAction(action)
                    addAction({ ...action, entry })
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
        renderComponent,
        renderHandle,
        onOpen = () => {},
        onClose = () => {},
        onMove = () => {},
        canDrop = () => (true)
    }: DraggableTreeProps<T>) => {
    const localClasses = useDraggableTreeStyles()
    const [draggingEntry, setDraggingEntry]: [DraggingEntry<T>, any] = useState<DraggingEntry<T>>(null)
    const [draggingTarget, setDraggingTarget]: [DraggingTarget, any] = useState<DraggingTarget>(null)
    const [calculationTree, items] = useMemo(() => {
        let calculationTree = tree
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
        }
        return [calculationTree, nestedToFlat(calculationTree)]
    }, [tree, draggingEntry])
    const displayItems = useMemo(() => {
        let displayTree = calculationTree
        if (draggingEntry && draggingTarget) {
            const { parentKey, position } = draggingTarget
            displayTree = treeStateReducer(calculationTree, {
                type: 'ADD',
                toKey: parentKey,
                position,
                entry: {
                    key: draggingEntry.key,
                    item: draggingEntry.item,
                    children: [],
                    draggingTarget: true
                }
            })
        }
        return nestedToFlat(displayTree)
    }, [calculationTree, draggingEntry, draggingTarget])
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
        if (active || last) {
            if (draggingStyles.zIndex?.set) {
                if (active) {
                    draggingStyles.zIndex.set(10)
                }
                else {
                    draggingStyles.zIndex.set(-5)
                }
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
            const { key: draggingSourceKey = undefined, position: draggingSourcePosition = null } = draggingEntry?.draggingPoints[draggingEntry.draggingPoints.length-1] ?? {}
            if (rowIndex === 0) {
                if (entry && canDrop({ dropEntry: entry.item, toEntry: null, position: 0 })) {
                    newPosition = 0
                }
            }
            else {
                const prospectives = [...items[rowIndex - 1].draggingPoints, ...(items[rowIndex - 1].open === false ? [] : [{ key: items[rowIndex - 1].key, position: 0 }])]
                    .filter(({ key, position }) => {
                        const toEntry = key ? findInTree(calculationTree, key) : null
                        return entry ? canDrop({ dropEntry: entry.item, toEntry: (toEntry ?? { item: null }).item, position }) : false
                    })
                const closestProspective = prospectives
                    .map((value, index) => ({ ...value, xOffset: Math.abs((index + 1) * 32 - (startX + x)) }))
                    .reduce<{ key?: string, position: number | null, xOffset: number }>((previous, value) => ((value.xOffset < previous.xOffset) ? value : previous ), { position: null, xOffset: Infinity })
                if (closestProspective.position !== null && !((closestProspective.key === draggingEntry?.key) ||
                        ((closestProspective.key === draggingSourceKey) &&
                        ((closestProspective.position === draggingSourcePosition) || (draggingSourcePosition === closestProspective.position + 1))
                    ))) {
                    newParentKey = closestProspective.key
                    newPosition = closestProspective.position
                }
            }
            if (last) {
                if (newPosition !== null) {
                    onMove({ fromKey: entry.key, toKey: newParentKey, position: newPosition })
                }
                setDraggingEntry(null)
                draggingApi([{ opacity: 0, zIndex: -10, immediate: (val) => (val === 'zIndex') }])
            }
            else {
                if (newPosition === null) {
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
            { draggingEntry && <TreeContent item={draggingEntry.item} renderComponent={renderComponent} /> }
        </animated.div>
        { displayItems.map((entry, index) => {
            const { level, verticalRows = 0, open, draggingSource, draggingTarget, item, key } = entry
            return <div style={{
                    position: 'absolute',
                    height: `30px`,
                    zIndex: 2,
                    top: `${index * 32}px`
                }}
                key={draggingTarget ? `target-${key}` : key }
            >
                <div
                    className={`${localClasses.Highlighted} ${(draggingSource && localClasses.DraggingSource) || ''} ${(draggingTarget && localClasses.DraggingTarget) || ''}`}
                    style={{
                        transform: `translate3d(${(level + 1) * 34}px,0px, 0)`
                    }}
                >
                    { (open !== undefined) && <Collapsar left={-17} open={open} onClick={() => {
                            if (open) {
                                onClose(key)
                            }
                            else {
                                onOpen(key)
                            }
                        }} />
                    }
                    <HorizontalLine />
                    <VerticalLine left={17} height={`${verticalRows > 0 ? (verticalRows * 30) - 15 : 0}px`} />
                    <TreeContent item={{ ...item, itemKey: key }} bind={bind(entry, index * 32, (level + 1) * 32)} renderComponent={renderComponent} renderHandle={renderHandle} />
                </div>
            </div>
        })}
    </div>
}

export default DraggableTree
