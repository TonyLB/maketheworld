type HighlightCircleProps = {
    x: number;
    y: number;
} | Record<string, any>

export const HighlightCircle = ({
        x,
        y,
        ...rest }: HighlightCircleProps) => {

    if (x === undefined || Number.isNaN(x) || y === undefined || Number.isNaN(y)) {
        return null
    }
    return <g transform={`translate(${x}, ${y})`}>
        <circle
            cx={0}
            cy={0}
            r={30}
            strokeWidth={2}
            stroke='blue'
            fill='none'
            {...rest}
        />
        <circle
            cx={0}
            cy={0}
            r={30}
            strokeWidth={1}
            stroke='white'
            fill='none'
            {...rest}
        />
    </g>
}

export default HighlightCircle