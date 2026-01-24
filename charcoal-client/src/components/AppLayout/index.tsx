//
// The AppLayout component handles high-level styling and positioning of data components within the app
//

import React, { FunctionComponent, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    BrowserRouter as Router,
    Routes,
    Route,
    useParams,
    useLocation
} from "react-router-dom"

import './index.css'

import useMediaQuery from '@mui/material/useMediaQuery'
import {
    Box,
    Snackbar,
    IconButton,
    SnackbarCloseReason
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import ActiveCharacter from '../ActiveCharacter'
import InDevelopment from '../InDevelopment'
import ChoiceDialog from '../ChoiceDialog'
import CharacterSelectionModal from '../CharacterSelection'
import Explore from '../Explore'

import MapView from '../Maps/View'
import Library from '../Library'
import EditAsset from '../Library/Edit/EditAsset'

import EditCharacter from '../Library/Edit/EditCharacter'
import { getMyCharacters, getMySettings, getPlayer } from '../../slices/player'
import { playerDataSourceSelectors } from '../../slices/player/playerDataSource'
import Knowledge from '../Knowledge'
import { OnboardingPanel } from '../Onboarding'
import { getClientSettings, getCurrentCharacterId } from '../../slices/settings'
import { putClientSettings } from '../../slices/settings'

type FeedbackSnackbarProps = {
    feedbackMessage: string;
    closeFeedback: () => void;
}

const FeedbackSnackbar: FunctionComponent<FeedbackSnackbarProps> = ({ feedbackMessage, closeFeedback }) => {
    const handleClose = (_?: any, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') {
            return
        }

        closeFeedback()
    }
    return <Snackbar
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
        }}
        open={Boolean(feedbackMessage)}
        message={feedbackMessage}
        autoHideDuration={6000}
        onClose={handleClose}
        action={
            <IconButton size="small" aria-label="close" color="inherit" onClick={() => { handleClose() }}>
                <CloseIcon fontSize="small" />
            </IconButton>
        }
    />

}

const CharacterRouterSwitch = ({ messagePanel }: any) => {
    const { CharacterId } = useParams()
    const { guestId } = useSelector(getMySettings)
    const myCharacters = useSelector(getMyCharacters)
    const { CharacterId: EphemeraId } = CharacterId === 'Guest' ? { CharacterId: `CHARACTER#${guestId}` as const } : (myCharacters.find(({ scopedId }) => (scopedId === CharacterId)) || {})
    if (!EphemeraId) {
        return null
    }
    return <ActiveCharacter key={`Character-${CharacterId}`} CharacterId={EphemeraId}>
        <Routes>
            <Route path={`Play`} element={messagePanel} />
            <Route path={`Map/`} element={<MapView />} />
        </Routes>
    </ActiveCharacter>
}

// Component to render play spine at root path
// Shows MessagePanel if character is selected, CharacterSelectionModal if not
const PlaySpineRoot: FunctionComponent<{ messagePanel: React.ReactElement }> = ({ messagePanel }) => {
    const currentCharacterId = useSelector(getCurrentCharacterId)
    const myCharacters = useSelector(getMyCharacters)
    const { guestId } = useSelector(getMySettings)
    const dispatch = useDispatch()
    const playerDataSourceStatus = useSelector(playerDataSourceSelectors.getStatus)
    
    // Check if player data is loaded
    const isPlayerDataLoaded = playerDataSourceStatus === 'READY' || playerDataSourceStatus === 'SUBSCRIBED'
    
    // Check available character options
    const hasCharacters = myCharacters && myCharacters.length > 0 && myCharacters.some(({ scopedId }) => scopedId)
    const hasGuestOption = guestId !== undefined && guestId !== null
    const characterCount = hasCharacters ? myCharacters.filter(({ scopedId }) => scopedId).length : 0
    const totalOptions = characterCount + (hasGuestOption ? 1 : 0)
    
    // Auto-select if there's only one character option and no current selection
    useEffect(() => {
        if (!currentCharacterId && isPlayerDataLoaded && totalOptions === 1) {
            if (hasGuestOption && !hasCharacters) {
                // Only Guest available
                dispatch(putClientSettings({ currentCharacterId: `CHARACTER#${guestId}` as const }))
            } else if (hasCharacters && characterCount === 1) {
                // Only one regular character available
                const character = myCharacters.find(({ scopedId }) => scopedId)
                if (character?.CharacterId) {
                    dispatch(putClientSettings({ currentCharacterId: character.CharacterId }))
                }
            }
        }
    }, [currentCharacterId, isPlayerDataLoaded, totalOptions, hasGuestOption, hasCharacters, characterCount, myCharacters, guestId, dispatch])

    // If no character selected, show selection modal (unless we're auto-selecting)
    if (!currentCharacterId) {
        // Show nothing while auto-selecting (will re-render once selection is set)
        // Or show modal if multiple options
        if (isPlayerDataLoaded && totalOptions === 1) {
            // Auto-selection in progress, return null to avoid showing modal
            return null
        }
        return <CharacterSelectionModal open={true} required={true} />
    }

    // Convert EphemeraCharacterId to the format needed for ActiveCharacter
    // ActiveCharacter expects EphemeraCharacterId directly
    const characterId = currentCharacterId

    // Verify character exists
    const isValidCharacter = characterId === `CHARACTER#${guestId}` || 
        myCharacters.some(({ CharacterId }) => CharacterId === characterId)

    if (!isValidCharacter) {
        // Character no longer exists, show selection modal
        return <CharacterSelectionModal open={true} required={true} />
    }

    // Render MessagePanel wrapped in ActiveCharacter context
    return (
        <ActiveCharacter CharacterId={characterId}>
            {messagePanel}
        </ActiveCharacter>
    )
}

export const AppLayout = ({ whoPanel, homePanel, settingsPanel, messagePanel, onboardingPanel, feedbackMessage, closeFeedback, signInOrUp }: any) => {
    const large = useMediaQuery('(orientation: landscape) and (min-width: 1500px)')
    const { AlwaysShowOnboarding } = useSelector(getClientSettings)

    const routes = useMemo(() => (
        <Routes>
            <Route path="/SignIn" element={signInOrUp} />
            <Route path="/Character/Archived" element={<InDevelopment />} />
            <Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch messagePanel={messagePanel} />} />
            <Route path="/Library/" element={<Library />} />
            <Route path="/Library/Edit/Asset/:AssetId/*" element={<EditAsset />} />
            <Route path="/Library/Edit/Character/:AssetId/*" element={<EditCharacter />} />
            <Route path="/Knowledge/" element={<Knowledge />} />
            <Route path="/Knowledge/:KnowledgeId/" element={<Knowledge />} />
            <Route path="/Explore" element={<Explore />} />
            <Route path="/Who/" element={whoPanel} />
            <Route path="/Settings/" element={settingsPanel} />
            <Route path="/index.html" element={homePanel} />
            <Route path="/" element={<PlaySpineRoot messagePanel={messagePanel} />} />
        </Routes>
    ), [messagePanel, whoPanel, settingsPanel, homePanel])
    const routeWrapper = useMemo(() => (
        <Routes>
            <Route path="/Onboarding/" element={onboardingPanel} />
            <Route path="*" element={
                AlwaysShowOnboarding
                    ? <OnboardingPanel wrapper>
                        { routes }
                    </OnboardingPanel>
                    : routes
            } />
        </Routes>
    ), [onboardingPanel, routes])
    return <Router>
        <Box
            sx={{
                height: "calc(var(--vh, 1vh) * 100)",
                width: "100vw",
                display: "grid",
                justifyContent: "stretch",
                "@media (orientation: landscape)": {
                    gridTemplateAreas: `"content"`,
                    gridTemplateColumns: "1fr",
                    gridTemplateRows: "1fr"
                },
                "@media (orientation: landscape) and (min-width: 1500px)": {
                    gridTemplateAreas: `"content sidebar"`,
                    gridTemplateColumns: "1fr 400px",
                    gridTemplateRows: "1fr"
                },
                "@media (orientation: portrait)": {
                    gridTemplateAreas: `"content"`,
                    gridTemplateRows: "1fr",
                    gridTemplateColumns: "100%"
                },
                backgroundColor: "background.paper"
            }}
        >
            <ChoiceDialog />
            <FeedbackSnackbar feedbackMessage={feedbackMessage} closeFeedback={closeFeedback} />
            <Box
                sx={{
                    gridArea: "content",
                    overflowY: "auto",
                    width: "100%",
                    height: "100%"
                }}
            >
                <Box sx={{ width: "100%", height: "100%" }}>
                    { routeWrapper }
                </Box>
            </Box>
            {large
                ? <Box
                    sx={{
                        gridArea: "sidebar",
                        overflowY: "auto",
                        bgcolor: 'primary'
                    }}
                >
                    {whoPanel}
                </Box>
                : []
            }
        </Box>
    </Router>

}

export default AppLayout