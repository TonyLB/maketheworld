import { FunctionComponent, ReactChild } from 'react'
import {
    useNavigate
} from "react-router-dom"

import {
    Box,
    Breadcrumbs,
    Link,
    Typography,
    Stack
} from '@mui/material'
import { blue } from '@mui/material/colors'
import ExplicitEdit from './ExplicitEdit';

interface BreadCrumbProps {
    href?: string;
    label: string;
}

interface LibraryBannerProps {
    primary: string;
    secondary?: string;
    onChangeSecondary?: (value: string) => void;
    validateSecondary?: (value: string) => boolean;
    icon?: ReactChild;
    commands?: ReactChild;
    breadCrumbProps: BreadCrumbProps[];
}

export const LibraryBanner: FunctionComponent<LibraryBannerProps> = ({ primary, secondary, onChangeSecondary, validateSecondary, icon, commands, breadCrumbProps }) => {
    const navigate = useNavigate()
    return <Box sx={{ display: 'flex', width: "100%", backgroundColor: blue[100] }}>
        <Box sx={{ flexGrow: 1 }}>
            <Breadcrumbs aria-label="navigation breadcrumbs">
                {
                    breadCrumbProps.map(({ href, label }, index) => (
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
                            : (<Typography key={`text-${index}`} color="text.primary">{label}</Typography>)
                    ))
                }
            </Breadcrumbs>
            <Box sx={{ display: 'flex', width: '100%', marginTop: '1em', marginBottom: '1em' }}>
                <Box sx={{ flexGrow:0, flexShrink: 0, minWidth: '3em', color: 'rgba(0, 0, 0, 0.5)' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', marginLeft: '1em', marginRight: '2em' }}>
                        <Box sx={{ flexGrow: 1 }} />
                        <Box sx={{ flexGrow: 0 }}>{icon}</Box>
                        <Box sx={{ flexGrow: 1 }} />
                    </Box>
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                    <Stack>
                        <Typography variant='body1'>{primary}</Typography>
                        <Typography variant='body2' component="div" sx={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                            { 
                                onChangeSecondary
                                    ? <ExplicitEdit value={secondary} onChange={onChangeSecondary} validate={validateSecondary} helperText='This key is already used' />
                                    : secondary
                            }
                        </Typography>
                    </Stack>
                </Box>
            </Box>
        </Box>
        <Box>
            { commands }
        </Box>
    </Box>
}

export default LibraryBanner
