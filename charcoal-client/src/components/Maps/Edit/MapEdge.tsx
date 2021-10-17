import React from 'react'

type MapEdgeProps = {
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
    fromRoomId: string;
    toRoomId: string;
}

export const MapEdge = ({ fromX, fromY, toX, toY, fromRoomId, toRoomId }: MapEdgeProps) => {
    if (fromX === undefined || Number.isNaN(fromX) ||
        fromY === undefined || Number.isNaN(fromY) ||
        toX === undefined || Number.isNaN(toX) ||
        toY === undefined || Number.isNaN(toY)) {
        return null
    }
    const edgeLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
    if (edgeLength < 60) {
        return null
    }
    const multiplier = 30.0 / edgeLength
    return <line
        key={`${fromRoomId}-${toRoomId}`}
        x1={fromX + (toX - fromX) * multiplier}
        y1={fromY + (toY - fromY) * multiplier}
        x2={toX - (toX - fromX) * multiplier}
        y2={toY - (toY - fromY) * multiplier}
        markerEnd="url(#head)"
        style={{
            stroke: "#000000",
            strokeWidth: 1
        }}
    />
}

export default MapEdge