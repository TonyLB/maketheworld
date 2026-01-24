import React, { FunctionComponent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { blue } from '@mui/material/colors'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Grid } from '@mui/material'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import LibraryIcon from '@mui/icons-material/ArtTrack'
import KnowledgeIcon from '@mui/icons-material/MenuBook'
import LockIcon from '@mui/icons-material/Lock'

import { getConfiguration } from '../../slices/configuration'
import useOnboarding from '../Onboarding/useOnboarding'
import { DevEnvironment } from '../../environment'

export const Explore: FunctionComponent = () => {
    const navigate = useNavigate()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 80 : medium ? 60 : 40
    const [knowledgeUnlocked] = useOnboarding('navigateHome')
    const [libraryUnlocked] = useOnboarding('closeTab')

    return (
        <Box sx={{ flexGrow: 1, padding: "10px" }}>
            <Grid
                sx={{ width: "100%", padding: "10px" }}
                container
                direction="row"
                justifyContent="center"
                spacing={3}
            >
                <Grid size={{ xs: 12 }} sx={{ textAlign: "center" }}>
                    <Divider />
                    <Typography variant="h4" sx={{ margin: "0.5em" }}>
                        Explore
                    </Typography>
                    <Divider />
                    <Typography variant="body2" sx={{ margin: "1em", color: "text.secondary" }}>
                        These features will be migrated to side-track implementations in future phases.
                    </Typography>
                </Grid>

                <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ alignItems: "start" }}>
                    <Divider />
                    <Typography variant="h5" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                        Knowledge
                    </Typography>
                    <Divider />
                    <Grid container justifyContent="center">
                        <Grid
                            size={{ sm: 3 }}
                            sx={{
                                marginTop: "1em",
                                cursor: knowledgeUnlocked ? 'pointer' : 'default',
                            }}
                        >
                            <Stack
                                direction="column"
                                justifyContent="center"
                                alignItems="center"
                                spacing={2}
                                sx={{ marginTop: "1em", width: "100%" }}
                            >
                                {knowledgeUnlocked && (
                                    <React.Fragment>
                                        <Avatar
                                            sx={{ width: `${iconSize}px`, height: `${iconSize}px`, bgcolor: blue[300] }}
                                            alt={'Knowledge'}
                                            onClick={() => { navigate('/Knowledge/') }}
                                        >
                                            <KnowledgeIcon sx={{ fontSize: iconSize * 0.6 }} />
                                        </Avatar>
                                        Knowledge
                                    </React.Fragment>
                                )}
                                {!knowledgeUnlocked && (
                                    <React.Fragment>
                                        <Avatar
                                            sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                            alt={'Locked'}
                                        >
                                            <LockIcon sx={{ fontSize: iconSize * 0.6 }} />
                                        </Avatar>
                                        Locked
                                    </React.Fragment>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                    <Divider />
                    <Typography variant="h5" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                        Library
                    </Typography>
                    <Divider />
                    <Grid container justifyContent="center">
                        <Grid
                            size={{ sm: 3 }}
                            sx={{
                                marginTop: "1em",
                                cursor: libraryUnlocked ? 'pointer' : 'default',
                            }}
                        >
                            <Stack
                                direction="column"
                                justifyContent="center"
                                alignItems="center"
                                spacing={2}
                                sx={{ marginTop: "1em", width: "100%" }}
                            >
                                {libraryUnlocked && (
                                    <React.Fragment>
                                        <Avatar
                                            sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                            alt={'Library'}
                                            onClick={() => { navigate('/Library/') }}
                                        >
                                            <LibraryIcon sx={{ fontSize: iconSize * 0.6 }} />
                                        </Avatar>
                                        Library
                                    </React.Fragment>
                                )}
                                {!libraryUnlocked && (
                                    <React.Fragment>
                                        <Avatar
                                            sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                            alt={'Locked'}
                                        >
                                            <LockIcon sx={{ fontSize: iconSize * 0.6 }} />
                                        </Avatar>
                                        Locked
                                    </React.Fragment>
                                )}
                            </Stack>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </Box>
    )
}

export default Explore
