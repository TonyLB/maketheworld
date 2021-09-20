import React, { FunctionComponent, useState, useRef } from 'react'
import { useTransition, animated, config } from 'react-spring'
import Button from '@material-ui/core/Button'

import { NestedTree, FlatTree } from './interfaces'

import nestedToFlat from './nestedToFlat'

import VerticalLine from './TreeStructure/Vertical'
import HorizontalLine from './TreeStructure/Horizontal'
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

export const DraggableTree: FunctionComponent<MapLayersProps>= ({}) => {
    const localClasses = useMapStyles()
    const treeOne: NestedTree<TestItem> = [{
        name: 'One',
        children: [{
            name: 'Two',
            children: []
        }]
    },
    {
        name: 'Three',
        children: []
    }]
    const treeTwo: NestedTree<TestItem> = [{
        name: 'One',
        children: [{
            name: 'Two',
            children: []
        },
        {
            name: 'Two-and-a-half',
            children: []
        }]
    },
    {
        name: 'Three',
        children: []
    },
    {
        name: 'Four',
        children: []
    }]
    const [toggle, setToggle] = useState(true)
    const items = nestedToFlat(toggle ? treeOne : treeTwo)
    // const order = useRef(items.map((_, index) => index))
    const transitions = useTransition(items.map(({ name, level, verticalRows }) => ({ name, verticalLineHeight: `${verticalRows > 0 ? (verticalRows * 30) - 15 : 0}px`, transform: `translate3d(${level * 30}px,0px, 0)` })), {
        config: config.stiff,
        keys: ({ name }: { name: string }) => name,
        enter: ({ transform, verticalLineHeight }) => ({ transform, height: '30px', opacity: 1, verticalLineHeight }),
        update: ({ transform, verticalLineHeight }) => ({ transform, opacity: 1, verticalLineHeight }),
        leave: ({ transform }) => ({ height: '0px', transform, opacity: 0, verticalLineHeight: `0px` }),
        from: ({ transform, verticalLineHeight }) => ({ opacity: 0, transform, height: '0px', verticalLineHeight }),
    })

    // const bind = useDrag(({ args: [originalIndex], active, movement: [, y] }) => {
    //     const curIndex = order.current.indexOf(originalIndex)
    //     const curRow = clamp(Math.round((curIndex * 40 + y) / 40), 0, items.length - 1)
    //     const newOrder = arrayMove(order.current, curIndex, curRow)
    //     setSprings(fn(newOrder, active, originalIndex, curIndex, y)) // Feed springs new style data, they'll animate the view without causing a single render
    //     if (!active) order.current = newOrder
    // })
    
    return <React.Fragment>
        { transitions(({ transform, opacity, height, verticalLineHeight }, { name }) => (
            <animated.div
                // {...bind(i)}
                style={{
                    // zIndex,
                    // boxShadow: shadow.to((s) => `rgba(0, 0, 0, 0.15) 0px ${s}px ${2 * s}px 0px`),
                    height: height as any,
                    opacity: opacity as any
                    // scale
                }}
            >
                <animated.div
                    className={localClasses.highlighted}
                    style={{
                        transform: transform as any
                    }}
                >
                    <HorizontalLine />
                    <VerticalLine left={15} height={verticalLineHeight} />
                    <div>
                        {name}
                    </div>
                </animated.div>
            </animated.div>
        ))}
        <div style={{ transform: 'translate3d(0px, 500px, 0)'}}>
            <Button onClick={() => { setToggle(!toggle) }} variant="outlined">Toggle</Button>
        </div>
    </React.Fragment>
}

export default DraggableTree
