import React, { FunctionComponent } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import { blue } from '@mui/material/colors'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddIcon from '@mui/icons-material/Add'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'

import LibraryIcon from '@mui/icons-material/ArtTrack'
import MapIcon from '@mui/icons-material/Explore'
import KnowledgeIcon from '@mui/icons-material/MenuBook'
import LockIcon from '@mui/icons-material/Lock'
import { AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/dist/asset'
import { getConfiguration } from '../../slices/configuration'
import { useSelector } from 'react-redux'
import { Typography } from '@mui/material'
import useOnboarding, { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

//
// TODO:  Choose better typography for the Home page.
//

//
// TODO: Create a navigation path to the Help page
//
type HomeProps = {
    myCharacters?: AssetClientPlayerCharacter[];
    signOut?: () => void;
}

export const Home: FunctionComponent<HomeProps> = ({
    myCharacters = [],
    signOut = () => {}
}) => {
    useOnboardingCheckpoint('navigateHome', { requireSequence: true })
    const navigate = useNavigate()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 80 : medium ? 60 : 40
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = process.env.NODE_ENV === 'development' ? `https://${AppBaseURL}` : ''
    const [knowledgeUnlocked] = useOnboarding('navigateHome')
    const [charactersUnlocked] = useOnboarding('closeTab')
    const [libraryUnlocked] = useOnboarding('closeTab')

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        <Grid
            sx={{ width: "100%", padding: "10px" }}
            container
            direction="row"
            justifyContent="center"
            spacing={3}
        >
            <Grid item xs={12} sx={{ textAlign: "center" }}>
                <Divider />
                    <Typography variant="h4" sx={{ margin: "0.5em" }}>
                        Play
                    </Typography>
                <Divider />
            </Grid>
            {
                !charactersUnlocked && <Grid
                    container
                    item
                    sm={3}
                    sx={{
                        justifyContent: 'center',
                        alignContent: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <Stack
                        direction="column"
                        justifyContent="center"
                        alignItems="center"
                        spacing={2}
                    >
                        <Avatar
                            sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                            alt={'Locked'}
                        >
                            <LockIcon sx={{ fontSize: iconSize * 0.6 }} />
                        </Avatar>
                        <React.Fragment>Locked</React.Fragment>
                    </Stack>
                </Grid>
            }
            { charactersUnlocked && myCharacters.map(({ Name, CharacterId, fileURL }) => (
                CharacterId && 
                <Grid
                    key={`${Name}:${CharacterId}`}
                    container
                    item
                    sm={3}
                    sx={{
                        justifyContent: 'center',
                        alignContent: 'center',
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        if (CharacterId) {
                            navigate(`/Character/${CharacterId.split('#')[1]}/Play`)
                        }
                    }}
                >
                    <Stack
                        direction="column"
                        justifyContent="center"
                        alignItems="center"
                        spacing={2}
                    >
                        <Avatar
                            sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                            alt={Name || '???'}
                            src={fileURL && `${appBaseURL}/images/${fileURL}.png`}
                        >
                            {Name[0] ? Name[0].toUpperCase() : '?'}
                        </Avatar>
                        <React.Fragment>{ Name }</React.Fragment>
                    </Stack>
                </Grid>))
            }
            { charactersUnlocked && <Grid key='NewCharacter'
                        container
                        item
                        sm={3}
                        sx={{
                            justifyContent: 'center',
                            alignContent: 'center',
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            navigate(`/Library`)
                        }}
                >
                    <Stack
                        direction="column"
                        justifyContent="center"
                        alignItems="center"
                        spacing={2}
                    >
                        <Avatar
                            sx={{
                                width: `${iconSize}px`,
                                height: `${iconSize}px`
                            }}
                            alt='New Character'
                        >
                            <AddIcon sx={{
                                fontSize: iconSize,
                                color: 'grey'
                            }} />
                        </Avatar>
                        <React.Fragment>New Character</React.Fragment>
                    </Stack>
                </Grid>
            }
            <Grid item xs={12} />
            <Grid item xs={12} md={6} sx={{ alignItems: "start" }}>
                <Divider />
                    <Typography variant="h4" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                        Explore
                    </Typography>
                <Divider />
                <Grid container justifyContent="center">
                    <Grid
                        item
                        sm={3}
                        sx={{
                            marginTop: "1em",
                            cursor: 'pointer',
                        }}
                    >
                        <Stack
                            direction="column"
                            justifyContent="center"
                            alignItems="center"
                            spacing={2}
                            sx={{ marginTop: "1em", width: "100%" }}
                        >
                            { knowledgeUnlocked && <React.Fragment>
                                <Avatar
                                    sx={{ width: `${iconSize}px`, height: `${iconSize}px`, bgcolor: blue[300] }}
                                    alt={'Knowledge'}
                                    onClick={() => { navigate('/Knowledge/') }}
                                >
                                    <KnowledgeIcon sx={{ fontSize: iconSize * 0.6 }} />
                                </Avatar>
                                Knowledge
                            </React.Fragment> }
                            { !knowledgeUnlocked && <React.Fragment>
                                <Avatar
                                    sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                    alt={'Locked'}
                                >
                                    <LockIcon sx={{ fontSize: iconSize * 0.6 }} />
                                </Avatar>
                                Locked
                            </React.Fragment> }
                        </Stack>
                    </Grid>
                </Grid>

            </Grid>
            <Grid item xs={12} md={6}>
                <Divider />
                <Typography variant="h4" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                    Create
                </Typography>
                <Divider />
                <Grid container justifyContent="center">
                    <Grid
                        item
                        sm={3}
                        sx={{
                            marginTop: "1em",
                            cursor: 'pointer',
                        }}
                    >
                        <Stack
                            direction="column"
                            justifyContent="center"
                            alignItems="center"
                            spacing={2}
                            sx={{ marginTop: "1em", width: "100%" }}
                        >
                            { libraryUnlocked && <React.Fragment>
                                <Avatar
                                    sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                    alt={'Library'}
                                    onClick={() => { navigate('/Library/') }}
                                >
                                    <LibraryIcon sx={{ fontSize: iconSize * 0.6 }} />
                                </Avatar>
                                Library
                            </React.Fragment> }
                            { !libraryUnlocked && <React.Fragment>
                                <Avatar
                                    sx={{ width: `${iconSize}px`, height: `${iconSize}px` }}
                                    alt={'Locked'}
                                >
                                    <LockIcon sx={{ fontSize: iconSize * 0.6 }} />
                                </Avatar>
                                Locked
                            </React.Fragment> }
                        </Stack>
                    </Grid>
                </Grid>

            </Grid>

            {/* <Grid item xs={12} sx={{ textAlign: "center" }}>
                <Divider />
                    <h2>Administer</h2>
                <Divider />
            </Grid>
            {[
                {
                    icon: <NotificationsActiveIcon />,
                    title: 'Notifications',
                    href: '/Notifications/',
                    onClick: undefined
                }
            ].map(({ icon, title, href, onClick }) => (
                <Grid key={title} item sm={3}>
                    <Card onClick={() => {
                        if (href) {
                            navigate(href)
                        }
                        else {
                            if (onClick) {
                                onClick()
                            }
                        }
                    }}>
                        <CardHeader
                            avatar={<Avatar>{icon}</Avatar>}
                            title={title}
                        />
                        <CardContent>
                        </CardContent>
                    </Card>
                </Grid>
            )) } */}
        </Grid>
    </Box>
}
//
// TODO: Re-enable Notifications when there is a more complete workflow including them
//

export default Home
