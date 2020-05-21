import React from 'react'

export const MapEdge = ({ fromPosition, toPosition, fromNode, toNode }) => {
    const { x: fromX, y: fromY } = fromPosition
    const { x: toX, y: toY } = toPosition
    const edgeLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
    if (edgeLength < 60) {
        return null
    }
    const multiplier = 30.0 / edgeLength
    return <line
        key={`${fromNode.PermanentId}-${toNode.PermanentId}`}
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