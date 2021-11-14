import React from 'react'

type MapEdgeProps = {
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
    //
    // TODO:  Decide if fromRoomId and toRoomId serve a purpose
    //
    fromRoomId?: string;
    toRoomId?: string;
    decorator?: boolean;
    double?: boolean;
}

export const MapEdge = ({ fromX, fromY, toX, toY, decorator = false, double = true }: MapEdgeProps) => {
    if (fromX === undefined || Number.isNaN(fromX) ||
        fromY === undefined || Number.isNaN(fromY) ||
        toX === undefined || Number.isNaN(toX) ||
        toY === undefined || Number.isNaN(toY)) {
        return null
    }
    const edgeLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
    if (edgeLength < 70) {
        return null
    }
    const multiplier = 35.0 / edgeLength
    const line = (markerEnd: string, markerStart: string, stroke: string, strokeWidth: number) => <line
        x1={fromX + (toX - fromX) * multiplier}
        y1={fromY + (toY - fromY) * multiplier}
        x2={toX - (toX - fromX) * multiplier}
        y2={toY - (toY - fromY) * multiplier}
        markerEnd={`url(#${markerEnd})`}
        {...(double ? { markerStart: `url(#${markerStart})` } : {})}
        style={{
            stroke,
            strokeWidth
        }}
    />
    if (decorator) {
        return <React.Fragment>
            { line('outlineHead', 'outlineTail', 'blue', 2) }
            { line('coreHead', 'coreTail', 'white', 1) }
        </React.Fragment>
    }
    else {
        return line('head', 'tail', '#000000', 1)
    }
}

export default MapEdge