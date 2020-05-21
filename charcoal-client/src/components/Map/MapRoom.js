import React from 'react'

import useStyles from '../styles'

export const MapRoom = ({ PermanentId, Name, className='svgLightBlue', position, onClick, clickable=false, ...rest }) => {
    const classes = useStyles()
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
    return <React.Fragment key={PermanentId}>
        <circle
            cx={position.x}
            cy={position.y}
            r={30}
            className={classes[className]}
            onClick={onClick}
            style={{ cursor: clickable ? 'pointer' : '' }}
            {...rest}
        />
        <text
            style={{
                fontFamily: "Roboto",
                fontSize: "10px",
                pointerEvents: "none"
            }}
            textAnchor="middle"
            x={position.x}
            y={position.y + 3}
            className={classes[`${className}Contrast`]}
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

export default MapRoom