import React from 'react'
import { useSelector } from 'react-redux'

import { getPermanentHeaders } from '../../selectors/permanentHeaders'
import MapEdge from './MapEdge'
import MapRoom from './MapRoom'

export const MapDisplay = React.forwardRef(({ map, roomComponent=MapRoom, edgeComponent=MapEdge, width=600, height=400, classes={}, open=true }, ref) => {
    const permanentHeaders = useSelector(getPermanentHeaders)

    if (!map) {
        return <svg width={width} height={height} viewBox="0 0 600 400" />
    }
    const nodes = Object.values((map && map.Rooms) || {}).map(({ PermanentId, X, Y, ...rest }) => {
            return {
                PermanentId,
                key: PermanentId,
                Name: permanentHeaders[PermanentId].Name || '',
                position: {
                    x: X,
                    y: Y
                },
                ...rest
            }
        })
        .reduce((previous, { PermanentId, ...rest }) => ({ ...previous, [PermanentId]: { PermanentId, ...rest } }), {})
    const edges = Object.values((map && map.Rooms) || {})
        .map(({ PermanentId }) => (permanentHeaders[PermanentId]))
        .map(({ Exits = [], PermanentId }) => (
            Exits.filter(({ RoomId }) => (map.Rooms[RoomId]))
                .map(({ RoomId }) => ({
                    key: `${PermanentId}-${RoomId}`,
                    fromNode: nodes[PermanentId],
                    toNode: nodes[RoomId],
                    fromPosition: nodes[PermanentId].position,
                    toPosition: nodes[RoomId].position
                }))
        ))
        .reduce((previous, exitList) => ([ ...previous, ...exitList ]), [])

    return <svg ref={ref} width={width} height={height} viewBox="0 0 600 400">
        <defs>
            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                    refX='10' refY='5'>
                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
            </marker>
        </defs>
        <g opacity={open ? '1.0' : '0.0'}>
            {
                edges.map(edgeComponent)
            }
            {
                Object.values(nodes)
                    .map((node) => ({
                        className: classes.svgLightBlue,
                        contrastClassName: classes.svgLightBlueContrast,
                        ...node
                    }))
                    .map(roomComponent)
            }
        </g>
    </svg>
})

export default MapDisplay