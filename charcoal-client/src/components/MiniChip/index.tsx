import { FunctionComponent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { blue } from '@mui/material/colors'

export const MiniChip: FunctionComponent<{ text: string }> = ({ text }) => {
    const linearGradient = (color: Record<string | number, string>, low: number, high: number) => `linear-gradient(${color[low]}, ${color[high]})`
    return <Box
        component="span"
        sx={{
            display: "inline-block",
            background: linearGradient(blue, 500, 700),
            color: "white",
            borderRadius: '200px',
            paddingTop: '0.125em',
            paddingBottom: '0.125em',
            paddingLeft: '0.35em',
            paddingRight: '0.35em',
            position: "relative",
            top: "-0.125em",
            marginLeft: "0.5em"
        }}
    >
        <Typography variant="body2">{ text }</Typography>
    </Box>
}

export default MiniChip
