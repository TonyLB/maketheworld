import React, { FunctionComponent, useState, useRef } from 'react'
import { useSprings, animated } from 'react-spring'
import { useDrag } from 'react-use-gesture'

import {
    useRouteMatch,
    useHistory,
    useParams
} from "react-router-dom"

import Box from '@material-ui/core/Box'
import Divider from '@material-ui/core/Divider'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from "@material-ui/core/styles"

import useMapStyles from './useMapStyles'
import produce from 'immer'

import DraggableTree from '../../DraggableTree/DraggableTree'

type MapLayersProps = {
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

// export const MapLayers: FunctionComponent<MapLayersProps>= ({}) => {
//     const localClasses = useMapStyles()
//     const items = ['One', 'Two', 'Three']
//     const order = useRef(items.map((_, index) => index))
//     const [springs, setSprings] = useSprings(items.length, fn(order.current))

//     const bind = useDrag(({ args: [originalIndex], active, movement: [, y] }) => {
//         const curIndex = order.current.indexOf(originalIndex)
//         const curRow = clamp(Math.round((curIndex * 40 + y) / 40), 0, items.length - 1)
//         const newOrder = arrayMove(order.current, curIndex, curRow)
//         setSprings(fn(newOrder, active, originalIndex, curIndex, y)) // Feed springs new style data, they'll animate the view without causing a single render
//         if (!active) order.current = newOrder
//     })
    
//     return <React.Fragment>
//         { springs.map(({ zIndex, shadow, y, scale }, i) => (
//             <animated.div
//                 {...bind(i)}
//                 key={i}
//                 style={{
//                     zIndex,
//                     // boxShadow: shadow.to((s) => `rgba(0, 0, 0, 0.15) 0px ${s}px ${2 * s}px 0px`),
//                     y,
//                     scale
//                 }}
//                 children={items[i]}
//             />
//         ))}
//     </React.Fragment>
// }

export const MapLayers: FunctionComponent<MapLayersProps> = ({}) => {
    return <DraggableTree />
}

export default MapLayers
