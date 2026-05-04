import React, { FunctionComponent, useRef } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

import { blue } from '@mui/material/colors'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Grid } from '@mui/material'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddIcon from '@mui/icons-material/Add'

import LibraryIcon from '@mui/icons-material/ArtTrack'
import KnowledgeIcon from '@mui/icons-material/MenuBook'
import LockIcon from '@mui/icons-material/Lock'
import GuestIcon from '@mui/icons-material/PersonSearch'

import { AssetClientPlayerCharacter } from '@tonylb/mtw-interfaces/ts/asset'
import { getConfiguration } from '../../slices/configuration'
import { useSelector, useDispatch } from 'react-redux'
import { Typography } from '@mui/material'
import useOnboarding, { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { getMySettings } from '../../slices/player'
import { putClientSettings } from '../../slices/settings'
import TutorialPopover from '../Onboarding/TutorialPopover'
import { DevEnvironment } from '../../environment'

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
    const { guestId } = useSelector(getMySettings)
    const dispatch = useDispatch()
    useOnboardingCheckpoint('navigateHome', { requireSequence: true })
    useOnboardingCheckpoint('returnHome', { requireSequence: true })
    useOnboardingCheckpoint('navigateHomeInPlay', { requireSequence: true })
    const navigate = useNavigate()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 80 : medium ? 60 : 40
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
    const [knowledgeUnlocked] = useOnboarding('navigateHome')
    const [charactersUnlocked] = useOnboarding('closeTab')
    const [libraryUnlocked] = useOnboarding('closeTab')
    const guest = useRef<HTMLDivElement>()

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
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
                        Play
                    </Typography>
                <Divider />
            </Grid>
            {
                !charactersUnlocked && <Grid
                    container
                    size={{ sm: 3 }}
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
            { charactersUnlocked && guestId && myCharacters.filter(({ scopedId }) => (scopedId)).length === 0 &&
                <Grid
                    container
                    size={{ sm: 3 }}
                    sx={{
                        justifyContent: 'center',
                        alignContent: 'center',
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        if (guestId) {
                            dispatch(putClientSettings({ currentCharacterId: `CHARACTER#${guestId}` as const }))
                        }
                        navigate(`/Character/Guest/Play`)
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
                            alt='Guest'
                            ref={guest as any}
                        >
                            <GuestIcon fontSize="large" />
                        </Avatar>
                        <React.Fragment>Guest</React.Fragment>
                    </Stack>
                    <TutorialPopover anchorEl={guest as any} placement="right" checkPoints={['navigateInPlayEdit']} />
                </Grid>
            }
            { charactersUnlocked && myCharacters.filter(({ scopedId }) => (scopedId)).map(({ DisplayName, fileURL, scopedId }) => (
                scopedId && 
                <Grid
                    key={`${DisplayName}:${scopedId}`}
                    container
                    size={{ sm: 3 }}
                    sx={{
                        justifyContent: 'center',
                        alignContent: 'center',
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        if (scopedId) {
                            // Find the EphemeraCharacterId for this scopedId
                            const character = myCharacters.find(({ scopedId: id }) => (id === scopedId))
                            if (character?.CharacterId) {
                                dispatch(putClientSettings({ currentCharacterId: character.CharacterId }))
                            }
                            navigate(`/Character/${scopedId}/Play`)
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
                            alt={DisplayName || '???'}
                            src={fileURL && `${appBaseURL}/images/${fileURL}.png`}
                        >
                            {DisplayName[0] ? DisplayName[0].toUpperCase() : '?'}
                        </Avatar>
                        <React.Fragment>{ DisplayName }</React.Fragment>
                    </Stack>
                </Grid>))
            }
            <Grid size={{ xs: 12 }} />
            <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ alignItems: "start" }}>
                <Divider />
                    <Typography variant="h4" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                        Explore
                    </Typography>
                <Divider />
                <Grid container justifyContent="center">
                    <Grid
                        size={{ sm: 3 }}
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
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                <Divider />
                <Typography variant="h4" sx={{ marginTop: "0.5em", marginBottom: "0.5em", textAlign: "center" }}>
                    Share
                </Typography>
                <Divider />
                <Grid container justifyContent="center">
                    <Grid
                        size={{ sm: 3 }}
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

        </Grid>
    </Box>
}

export default Home
