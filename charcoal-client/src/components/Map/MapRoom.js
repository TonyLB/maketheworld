import React from 'react'

export const MapRoom = ({
        PermanentId,
        Name,
        className,
        contrastClassName,
        position,
        onClick,
        clickable=false,
        icon,
        ...rest }) => {
    const lineBreakout = Name.split(/\s+/)
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
    if (position.x === undefined || Number.isNaN(position.x) || position.y === undefined || Number.isNaN(position.y)) {
        return null
    }
    return <g key={PermanentId} transform={`translate(${position.x}, ${position.y})`}>
        <circle
            cx={0}
            cy={0}
            r={30}
            className={className}
            onClick={onClick}
            style={{ cursor: clickable ? 'pointer' : '' }}
            {...rest}
        />
        <text
            style={{
                fontFamily: "Roboto",
                fontSize: "10px",
                pointerEvents: "none",
                userSelect: "none"
            }}
            textAnchor="middle"
            x={0}
            y={3}
            className={contrastClassName}
        >
            {lines.length === 1 && lines[0]}
            {lines.length > 1 &&
                <React.Fragment>
                    <tspan x={0} y={-3}>{lines[0]}</tspan>
                    <tspan x={0} y={9}>{lines[1]}</tspan>
                </React.Fragment>
            }
        </text>
        { icon && <g transform="translate(15, 15), scale(0.05, 0.05)">{ icon }</g>}
    </g>
}

export default MapRoom