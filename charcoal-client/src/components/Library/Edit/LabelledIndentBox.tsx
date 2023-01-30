import { FunctionComponent, ReactNode } from 'react'
import Box from '@mui/material/Box'

type LabelledIndentBoxProps = {
    color: Record<number | string, string>;
    children: any;
    label: ReactNode;
    slate?: boolean;
}

export const LabelledIndentBox: FunctionComponent<LabelledIndentBoxProps> = ({ color, children, label, slate }) => {
    return <Box sx={{ position: 'relative', width: "100%" }}>
        <Box
            sx={{
                borderRadius: '0em 1em 1em 0em',
                borderStyle: 'solid',
                borderColor: color[500],
                background: color[50],
                paddingRight: '0.5em',
                paddingLeft: '0.25em',
                paddingTop: "0.5em",
                ...(slate
                    ? {
                        position: "relative",
                        top: '1em',
                        left: 0
                    }
                    : { marginTop: '1em' }
                )
            }}
        >
            {children}
        </Box>
        <Box
            {...(slate ? { contentEditable: false } : {})}
            sx={{
                borderRadius: "0em 1em 1em 0em",
                borderStyle: 'solid',
                borderColor: color[500],
                background: color[100],
                display: 'inline',
                paddingRight: '0.25em',
                position: 'absolute',
                top: 0,
                left: 0
            }}
        >
            { label }
        </Box>
    </Box>
}