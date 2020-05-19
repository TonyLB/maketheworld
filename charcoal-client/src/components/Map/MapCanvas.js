import React from 'react'

const graph = {
  nodes: [
    { id: 1, label: "Node 1", color: "#e04141", position: { x: 100, y: 100 } },
    { id: 2, label: "Node 2", color: "#e09c41", position: { x: 200, y: 100 } },
    { id: 3, label: "Node 3", color: "#e0df41", position: { x: 100, y: 200 } },
    { id: 4, label: "Really extremelylongindeed", color: "#7be041", position: { x: 250, y: 200 } }
  ],
  edges: [{ from: 1, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 4 }]
};

const MapEdge = ({ fromPosition, toPosition }) => {
    const { x: fromX, y: fromY } = fromPosition
    const { x: toX, y: toY } = toPosition
    const edgeLength = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2))
    if (edgeLength < 60) {
        return null
    }
    const multiplier = 30.0 / edgeLength
    return <line
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

const MapRoom = ({ label, color, position }) => {
    const lineBreakout = label.split(/\s+/)
        .reduce(({ currentLine, lines }, word) => (
            ((`${currentLine} ${word}`.length < 10) || !currentLine)
                ? {
                    currentLine: `${currentLine} ${word}`,
                    lines
                }
                : {
                    currentLine: word,
                    lines: [...lines, currentLine]
                }
        ), { currentLine: '', lines: []})
    const lines = [ ...lineBreakout.lines, lineBreakout.currentLine ]
                .map((word) => (word.length > 10 ? `${word.slice(0, 7)}...` : word))
    return <React.Fragment>
        <circle cx={position.x} cy={position.y} r={30} fill={color} />
        <text
            style={{
                fontFamily: "Roboto",
                fontSize: "10px"
            }}
            textAnchor="middle"
            x={position.x}
            y={position.y + 3}
            fill="#000000"
        >
            {lines.length === 1 && lines[0]}
            {lines.length > 1 &&
                <React.Fragment>
                    <tspan x={position.x} y={position.y - 3}>{lines[0]}</tspan>
                    <tspan x={position.x} y={position.y + 9}>{lines[1]}</tspan>
                </React.Fragment>
            }
        </text>
    </React.Fragment>
}

export const MapCanvas = () => {
    return <svg width="600" height="400">
        <defs>
            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                    refX='10' refY='5'>
                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
            </marker>
        </defs>
        {
            graph.edges.map(({ from, to }, index) => (
                <MapEdge
                    key={`edge-${index}`}
                    fromPosition={graph.nodes.find(({ id }) => (id === from)).position}
                    toPosition={graph.nodes.find(({ id }) => (id === to)).position}
                />
            ))
        }
        {
            graph.nodes.map(({ id, label, color, position }) => (
                <MapRoom key={id} color={color} position={position} label={label} />
            ))
        }
    </svg>
}

export default MapCanvas