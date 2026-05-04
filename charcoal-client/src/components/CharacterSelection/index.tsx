import React, { FunctionComponent, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import { Grid } from '@mui/material'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import GuestIcon from '@mui/icons-material/PersonSearch'

import { getConfiguration } from '../../slices/configuration'
import { getMySettings, getMyCharacters } from '../../slices/player'
import { putClientSettings } from '../../slices/settings'
import { setForceCharacterSelection } from '../../slices/UI/playSpine'
import TutorialPopover from '../Onboarding/TutorialPopover'
import { DevEnvironment } from '../../environment'

type CharacterSelectionModalProps = {
    open: boolean;
    onClose?: () => void;
    required?: boolean; // If true, modal cannot be dismissed
}

export const CharacterSelectionModal: FunctionComponent<CharacterSelectionModalProps> = ({
    open,
    onClose,
    required = false
}) => {
    const { guestId } = useSelector(getMySettings)
    const myCharacters = useSelector(getMyCharacters)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const medium = useMediaQuery('(min-width: 600px)')
    const large = useMediaQuery('(min-width: 1200px)')
    const iconSize = large ? 80 : medium ? 60 : 40
    const { AppBaseURL = '' } = useSelector(getConfiguration)
    const appBaseURL = DevEnvironment ? `https://${AppBaseURL}` : ''
    const guest = useRef<HTMLDivElement>()

    // Check if we have characters available
    // Note: This modal only shows when data is loaded but no character selected (handled by PlaySpineRoot)
    const hasCharacters = myCharacters && myCharacters.length > 0 && myCharacters.some(({ scopedId }) => scopedId)
    const hasGuestOption = guestId !== undefined && guestId !== null

    const handleCharacterSelect = (characterId: string, isGuest: boolean = false) => {
        // Clear user intent flag
        dispatch(setForceCharacterSelection(false))
        
        if (isGuest && guestId) {
            dispatch(putClientSettings({ 
                currentCharacterId: `CHARACTER#${guestId}` as const
            }))
        } else {
            const character = myCharacters.find(({ CharacterId }) => (CharacterId === characterId))
            if (character?.CharacterId) {
                dispatch(putClientSettings({ 
                    currentCharacterId: character.CharacterId
                }))
            }
        }
        // Navigate to root, which will show the chat interface
        navigate('/')
        if (onClose) {
            onClose()
        }
    }

    const handleClose = (event?: {}, reason?: string) => {
        // Prevent closing if required
        if (required && reason !== 'backdropClick') {
            return
        }
        if (onClose) {
            onClose()
        }
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown={required}
        >
            <DialogTitle>
                Select a Character
                {!required && (
                    <IconButton
                        aria-label="close"
                        onClick={handleClose}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ flexGrow: 1, padding: "10px" }}>
                    <Grid
                        sx={{ width: "100%", padding: "10px" }}
                        container
                        direction="row"
                        justifyContent="center"
                        spacing={3}
                    >
                        {hasGuestOption && (
                            <Grid
                                container
                                size={{ sm: 3 }}
                                sx={{
                                    justifyContent: 'center',
                                    alignContent: 'center',
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleCharacterSelect('', true)}
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
                        )}
                        {hasCharacters && myCharacters.filter(({ scopedId }) => (scopedId)).map(({ DisplayName, fileURL, scopedId, CharacterId }) => (
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
                                onClick={() => handleCharacterSelect(CharacterId)}
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
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </DialogContent>
        </Dialog>
    )
}

export default CharacterSelectionModal
