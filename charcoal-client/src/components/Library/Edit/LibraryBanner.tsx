import { FunctionComponent, ReactChild } from 'react'
import {
    useNavigate
} from "react-router-dom"

import {
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Breadcrumbs,
    Link,
    Typography
} from '@mui/material'
import { blue } from '@mui/material/colors'

interface BreadCrumbProps {
    href?: string;
    label: string;
}

interface LibraryBannerProps {
    primary: string;
    secondary?: string;
    icon?: ReactChild;
    commands?: ReactChild;
    breadCrumbProps: BreadCrumbProps[];
}

export const LibraryBanner: FunctionComponent<LibraryBannerProps> = ({ primary, secondary, icon, commands, breadCrumbProps }) => {
    const navigate = useNavigate()
    return <Box sx={{ display: 'flex', width: "100%", backgroundColor: blue[100] }}>
        <Box sx={{ flexGrow: 1 }}>
            <Breadcrumbs aria-label="navigation breadcrumbs">
                {
                    breadCrumbProps.map(({ href, label }) => (
                        href 
                            ? (<Link
                                sx={{ cursor: 'pointer' }}
                                key={href}
                                underline="hover"
                                color="inherit"
                                onClick={() => { navigate(href) }}
                            >
                                {label}
                            </Link>)
                            : (<Typography color="text.primary">{label}</Typography>)
                    ))
                }
            </Breadcrumbs>
            <List>
                <ListItem>
                    <ListItemIcon>
                        {icon}
                    </ListItemIcon>
                    <ListItemText primary={primary} secondary={secondary} />
                </ListItem>
            </List>
        </Box>
        <Box>
            { commands }
        </Box>
    </Box>
}

export default LibraryBanner
