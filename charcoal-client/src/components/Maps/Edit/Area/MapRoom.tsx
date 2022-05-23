import React, { useMemo } from 'react'

type MapRoomProps = {
    PermanentId: string;
    Name: string;
    className: string;
    contrastClassName: string;
    x: number;
    y: number;
    icon: any;
    openContextMenu: any;
    Locked: boolean;
} | Record<string, any>

export const MapRoom = ({
        PermanentId,
        Name,
        className,
        contrastClassName,
        x,
        y,
        icon,
        openContextMenu = null,
        Locked,
        ...rest }: MapRoomProps) => {
    interface LineBreakout {
        currentLine: string;
        lines: string[];
    }
    const lines = useMemo(() => {
        const lineBreakout = (Name.split(/\s+/) as string[])
            .reduce<LineBreakout>(({ currentLine, lines }, word) => (
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
        return [ ...lineBreakout.lines, lineBreakout.currentLine ]
                .map((word) => (word.length > 10 ? `${word.slice(0, 7)}...` : word))
    }, [Name])
    if (x === undefined || Number.isNaN(x) || y === undefined || Number.isNaN(y)) {
        return null
    }
    return <g key={PermanentId} transform={`translate(${x}, ${y})`}>
        <circle
            data-permanentid={PermanentId}
            cx={0}
            cy={0}
            r={30}
            className={className}
            style={{
                fill: 'url(#Gradient1)'
            }}
            {...rest}
        />
        <text
            style={{
                fontFamily: "Roboto",
                fontSize: "10px",
                pointerEvents: "none",
                userSelect: "none",
                stroke: "rgba(255, 255, 255, 0.3)",
                strokeWidth: "1",
                fill: "black",
                paintOrder: "stroke fill"
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