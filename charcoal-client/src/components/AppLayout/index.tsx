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
import MessagePanelSkeleton from '../Message/MessagePanelSkeleton'
import CheckpointOverlay from '../Message/CheckpointOverlay'

import MapView from '../Maps/View'
import { getMyCharacters, getMySettings, getPlayer } from '../../slices/player'
import { playerDataSourceSelectors } from '../../slices/player/playerDataSource'
import Knowledge from '../Knowledge'
import { OnboardingPanel } from '../Onboarding'
import { getClientSettings, getCurrentCharacterId } from '../../slices/settings'
import { getForceCharacterSelection, setForceCharacterSelection } from '../../slices/UI/playSpine'
import { putClientSettings } from '../../slices/settings'
import { getWorkbenchOpen, getCurrentAssetId, getSecondaryContext, closeWorkbench } from '../../slices/UI/workbench'
import { getThinkingDashboardOpen, closeThinkingDashboard } from '../../slices/UI/thinkingDashboard'
import { WorkbenchContainer, WorkbenchAssetEditor } from '../Workbench'
import { ThinkingDashboardContainer } from '../ThinkingDashboard'

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
// Shows skeletons during loading, CharacterSelectionModal when data loaded but no character selected,
// or MessagePanel when data loaded and character selected
const PlaySpineRoot: FunctionComponent<{ messagePanel: React.ReactElement }> = ({ messagePanel }) => {
    const currentCharacterId = useSelector(getCurrentCharacterId)
    const myCharacters = useSelector(getMyCharacters)
    const { guestId } = useSelector(getMySettings)
    const dispatch = useDispatch()
    const playerDataSourceStatus = useSelector(playerDataSourceSelectors.getStatus)
    
    // State Tracking (Critical): Track "initial load complete" separately from "character selected"
    const isDataLoaded = playerDataSourceStatus === 'READY' || playerDataSourceStatus === 'SUBSCRIBED'
    const hasCharacterSelected = currentCharacterId !== null && currentCharacterId !== undefined
    const forceCharacterSelection = useSelector(getForceCharacterSelection) // User-initiated selection intent
    
    // Check available character options
    const hasCharacters = myCharacters && myCharacters.length > 0 && myCharacters.some(({ scopedId }) => scopedId)
    const hasGuestOption = guestId !== undefined && guestId !== null
    const characterCount = hasCharacters ? myCharacters.filter(({ scopedId }) => scopedId).length : 0
    const totalOptions = characterCount + (hasGuestOption ? 1 : 0)
    
    // Auto-select if there's only one character option and no current selection
    // BUT only if user hasn't explicitly requested to see the selection modal
    useEffect(() => {
        if (!hasCharacterSelected && isDataLoaded && totalOptions === 1 && !forceCharacterSelection) {
            // Clear flag if it was somehow set during auto-selection
            dispatch(setForceCharacterSelection(false))
            
            if (hasGuestOption && !hasCharacters) {
                // Only Guest available
                dispatch(putClientSettings({ 
                    currentCharacterId: `CHARACTER#${guestId}` as const
                }))
            } else if (hasCharacters && characterCount === 1) {
                // Only one regular character available
                const character = myCharacters.find(({ scopedId }) => scopedId)
                if (character?.CharacterId) {
                    dispatch(putClientSettings({ 
                        currentCharacterId: character.CharacterId
                    }))
                }
            }
        }
    }, [hasCharacterSelected, isDataLoaded, totalOptions, hasGuestOption, hasCharacters, characterCount, myCharacters, guestId, dispatch, forceCharacterSelection])

    // Rendering Logic: Three distinct states

    // State 1: Show skeletons during loading, auto-selection, or when characters aren't available yet
    // Consolidate all skeleton conditions here
    const hasCharactersAvailable = hasCharacters || hasGuestOption
    // Only auto-select (show skeletons) for single option if user hasn't explicitly requested selection modal
    const shouldAutoSelect = !hasCharacterSelected && totalOptions <= 1 && !forceCharacterSelection
    if (!isDataLoaded || 
        shouldAutoSelect || 
        (!hasCharacterSelected && !hasCharactersAvailable) ||
        (hasCharacterSelected && !hasCharactersAvailable)) {
        // Render MessagePanelSkeleton directly (not wrapped in ActiveCharacter)
        // Do NOT show CharacterSelectionModal (data not ready, auto-selection in progress, or characters not available)
        // Also show skeletons when character is selected but characters haven't loaded yet (race condition)
        return (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                <MessagePanelSkeleton />
                <CheckpointOverlay />
            </Box>
        )
    }
    
    // State 2: Data loaded, no character selected, characters ready
    // Show modal if multiple options OR if user explicitly requested selection (even with single option)
    if (!hasCharacterSelected) {
        // Render modal over skeleton so modal appears over content, not empty space
        return (
            <>
                <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <MessagePanelSkeleton />
                    <CheckpointOverlay />
                </Box>
                <CharacterSelectionModal open={true} required={true} />
            </>
        )
    }

    // State 3: Data loaded, character selected, characters available
    // Convert EphemeraCharacterId to the format needed for ActiveCharacter
    const characterId = currentCharacterId

    // Verify character exists (characters are guaranteed to be available at this point)
    const isValidCharacter = characterId === `CHARACTER#${guestId}` || 
        myCharacters.some(({ CharacterId }) => CharacterId === characterId)

    if (!isValidCharacter) {
        // Character no longer exists, show selection modal over skeleton (treat as state 2)
        return (
            <>
                <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <MessagePanelSkeleton />
                    <CheckpointOverlay />
                </Box>
                <CharacterSelectionModal open={true} required={true} />
            </>
        )
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
    const dispatch = useDispatch()
    
    // Workbench state
    const workbenchOpen = useSelector(getWorkbenchOpen)
    const thinkingDashboardOpen = useSelector(getThinkingDashboardOpen)
    const currentAssetId = useSelector(getCurrentAssetId)
    const secondaryContext = useSelector(getSecondaryContext)

    const routes = useMemo(() => (
        <Routes>
            <Route path="/SignIn" element={signInOrUp} />
            <Route path="/Character/Archived" element={<InDevelopment />} />
            <Route path="/Character/:CharacterId/*" element={<CharacterRouterSwitch messagePanel={messagePanel} />} />
            <Route path="/Knowledge/" element={<Knowledge />} />
            <Route path="/Knowledge/:KnowledgeId/" element={<Knowledge />} />
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
            <WorkbenchContainer
                open={workbenchOpen}
                onClose={() => dispatch(closeWorkbench())}
                assetId={currentAssetId}
                secondaryContext={secondaryContext}
            >
                {workbenchOpen && currentAssetId !== null ? <WorkbenchAssetEditor /> : null}
            </WorkbenchContainer>
            <ThinkingDashboardContainer
                open={thinkingDashboardOpen}
                onClose={() => dispatch(closeThinkingDashboard())}
            />
        </Box>
    </Router>

}

export default AppLayout