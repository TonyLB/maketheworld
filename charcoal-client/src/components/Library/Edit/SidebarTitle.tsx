import { FunctionComponent } from "react"

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { blue } from "@mui/material/colors"

export const SidebarTitle: FunctionComponent<{ title: string, minHeight: string }> = ({ title, minHeight, children }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '0.5em',
        marginLeft: '0.5em'
    }}>
        <Box sx={{
            display: 'flex',
            width: '2em',
            minHeight,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: blue[50],
            borderTopColor: blue[500],
            borderTopStyle: 'solid',
            borderBottomColor: blue[500],
            borderBottomStyle: 'solid',
            marginRight: '0.5em'
        }}>
            <Typography
                sx={{ transform: 'rotate(-90deg)' }}
                variant="h5"
            >
                { title }
            </Typography>
        </Box>
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
        }}>
            { children }
        </Box>
    </Box>
)

export default SidebarTitle
