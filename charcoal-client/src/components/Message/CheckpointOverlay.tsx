import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { Box, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { getStatus as getLifeLineStatus } from '../../slices/lifeLine'
import { playerDataSourceSelectors } from '../../slices/player/playerDataSource'
import { contentHeadersSelectors } from '../../slices/contentHeaders'
import { selectors as ephemeraSelectors } from '../../slices/ephemera'
import { getPlayerName } from '../../slices/settings'

/**
 * CheckpointItem - Individual checkpoint display item
 */
type CheckpointItemProps = {
    label: string
    completed: boolean
}

const CheckpointItem: FunctionComponent<CheckpointItemProps> = ({ label, completed }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
            }}
        >
            {completed ? (
                <CheckCircleIcon
                    sx={{
                        fontSize: '16px',
                        color: 'success.main',
                        flexShrink: 0
                    }}
                />
            ) : (
                <RadioButtonUncheckedIcon
                    sx={{
                        fontSize: '16px',
                        color: 'text.secondary',
                        flexShrink: 0
                    }}
                />
            )}
            <Typography
                variant="overline"
                sx={{
                    fontSize: '0.7rem',
                    lineHeight: 1.2,
                    color: completed ? 'text.primary' : 'text.secondary',
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px'
                }}
            >
                {label}
            </Typography>
        </Box>
    )
}

/**
 * CheckpointOverlay - Displays initialization checkpoint progress
 * 
 * Shows a minimal, computer-ish overlay with feathered edges that displays
 * the completion status of critical initialization steps.
 */
type CheckpointOverlayProps = {
    fadeZoneSize?: string
}

// Ease-in: solid band then fade. 0–easeInStop stays solid, easeInStop–100% fades to transparent.
const EASE_IN_STOP = 0.35

export const CheckpointOverlay: FunctionComponent<CheckpointOverlayProps> = ({ fadeZoneSize = '40px' }) => {
    // Selectors for checkpoint status
    const lifeLineStatus = useSelector(getLifeLineStatus)
    const playerName = useSelector(getPlayerName)
    const playerDataSourceStatus = useSelector(playerDataSourceSelectors.getStatus)
    const playerActiveStreamKeys = useSelector(playerDataSourceSelectors.getActiveStreamKeys)
    const contentHeadersStatus = useSelector(contentHeadersSelectors.getStatus)
    const contentHeadersActiveStreamKeys = useSelector(contentHeadersSelectors.getActiveStreamKeys)
    const ephemeraStatus = useSelector(ephemeraSelectors.getStatus)

    // LifeLine states: INITIAL → SUBSCRIBE → CONNECT → CONNECTED
    // "Subscribing to messages" is complete when we've started subscribing (SUBSCRIBE or later)
    const lifeLineSubscribed = lifeLineStatus === 'SUBSCRIBE' || lifeLineStatus === 'CONNECT' || lifeLineStatus === 'CONNECTED'
    // "Connection Established" is complete when connection succeeds (CONNECTED state)
    const lifeLineConnected = lifeLineStatus === 'CONNECTED'
    // "Receiving session info" is complete when PlayerName is available (from SessionInitialized message)
    const sessionInfoReceived = playerName !== ''

    // PlayerDataSource states: INITIAL → INITIALIZE → READY → SUBSCRIBE → SUBSCRIBED → READY
    const playerInitialized = playerDataSourceStatus === 'INITIALIZE' || playerDataSourceStatus === 'READY' || playerDataSourceStatus === 'SUBSCRIBE' || playerDataSourceStatus === 'SUBSCRIBED'
    const playerReady = playerDataSourceStatus === 'READY' || playerDataSourceStatus === 'SUBSCRIBE' || playerDataSourceStatus === 'SUBSCRIBED'
    // "Subscribing" is complete when we're actively subscribing OR we have active stream keys (meaning we've subscribed)
    const playerSubscribing = playerDataSourceStatus === 'SUBSCRIBE' || playerDataSourceStatus === 'SUBSCRIBED' || playerActiveStreamKeys.length > 0

    // ContentHeaders states: INITIAL → INITIALIZE → READY → SUBSCRIBE → SUBSCRIBED → READY
    const headersInitialized = contentHeadersStatus === 'INITIALIZE' || contentHeadersStatus === 'READY' || contentHeadersStatus === 'SUBSCRIBE' || contentHeadersStatus === 'SUBSCRIBED'
    const headersReady = contentHeadersStatus === 'READY' || contentHeadersStatus === 'SUBSCRIBE' || contentHeadersStatus === 'SUBSCRIBED'
    // "Subscribing" is complete when we're actively subscribing OR we have active stream keys (meaning we've subscribed)
    const headersSubscribing = contentHeadersStatus === 'SUBSCRIBE' || contentHeadersStatus === 'SUBSCRIBED' || contentHeadersActiveStreamKeys.length > 0

    // Ephemera states: INITIAL → SUBSCRIBE → SYNCHRONIZE → CONNECTED
    const ephemeraSubscribed = ephemeraStatus === 'SUBSCRIBE' || ephemeraStatus === 'SYNCHRONIZE' || ephemeraStatus === 'CONNECTED'
    const ephemeraSynchronizing = ephemeraStatus === 'SYNCHRONIZE' || ephemeraStatus === 'CONNECTED'

    // Checkpoint definitions - granular sub-states that complete before messages pane appears
    // Order: Items that can run immediately come first, items waiting for PlayerName come after
    const checkpoints = [
        {
            id: 'lifeline-subscribe',
            label: 'Subscribing to messages',
            completed: lifeLineSubscribed
        },
        {
            id: 'lifeline-connected',
            label: 'Connection established',
            completed: lifeLineConnected
        },
        {
            id: 'headers-initialize',
            label: 'Initializing world headers',
            completed: headersInitialized
        },
        {
            id: 'headers-ready',
            label: 'World headers ready',
            completed: headersReady
        },
        {
            id: 'headers-subscribe',
            label: 'Subscribing to world headers',
            completed: headersSubscribing
        },
        {
            id: 'ephemera-subscribe',
            label: 'Subscribing to ephemera',
            completed: ephemeraSubscribed
        },
        {
            id: 'ephemera-sync',
            label: 'Synchronizing ephemera',
            completed: ephemeraSynchronizing
        },
        {
            id: 'session-info',
            label: 'Receiving session info',
            completed: sessionInfoReceived
        },
        {
            id: 'player-initialize',
            label: 'Initializing player data',
            completed: playerInitialized
        },
        {
            id: 'player-ready',
            label: 'Player data ready',
            completed: playerReady
        },
        {
            id: 'player-subscribe',
            label: 'Subscribing to player data',
            completed: playerSubscribing
        }
    ]

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 1000
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `${fadeZoneSize} auto ${fadeZoneSize}`,
                    gridTemplateRows: `${fadeZoneSize} auto ${fadeZoneSize}`,
                    gridTemplateAreas: `
                        "top-left top top-right"
                        "left content right"
                        "bottom-left bottom bottom-right"
                    `,
                    width: 'fit-content',
                    height: 'fit-content'
                }}
            >
            {/* Top fade zone - solid at bottom (content), ease-in fade to transparent at top (outer) */}
            <Box
                sx={{
                    gridArea: 'top',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `linear-gradient(to top, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Bottom fade zone - solid at top (content), ease-in fade to transparent at bottom (outer) */}
            <Box
                sx={{
                    gridArea: 'bottom',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `linear-gradient(to bottom, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Left fade zone - solid at right (content), ease-in fade to transparent at left (outer) */}
            <Box
                sx={{
                    gridArea: 'left',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `linear-gradient(to left, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Right fade zone - solid at left (content), ease-in fade to transparent at right (outer) */}
            <Box
                sx={{
                    gridArea: 'right',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `linear-gradient(to right, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Top-left corner - radial from content corner, fixed radius = fadeZoneSize, same ease-in as edges */}
            <Box
                sx={{
                    gridArea: 'top-left',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `radial-gradient(circle ${fadeZoneSize} at bottom right, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Top-right corner - radial from content corner, fixed radius = fadeZoneSize, same ease-in as edges */}
            <Box
                sx={{
                    gridArea: 'top-right',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `radial-gradient(circle ${fadeZoneSize} at bottom left, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Bottom-left corner - radial from content corner, fixed radius = fadeZoneSize, same ease-in as edges */}
            <Box
                sx={{
                    gridArea: 'bottom-left',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `radial-gradient(circle ${fadeZoneSize} at top right, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Bottom-right corner - radial from content corner, fixed radius = fadeZoneSize, same ease-in as edges */}
            <Box
                sx={{
                    gridArea: 'bottom-right',
                    background: (theme) => {
                        const bgColor = theme.palette.background.paper
                        const pct = `${EASE_IN_STOP * 100}%`
                        return `radial-gradient(circle ${fadeZoneSize} at top left, ${bgColor} 0%, ${bgColor} ${pct}, transparent 100%)`
                    }
                }}
            />
            
            {/* Content box - shrink-wrap and center within grid cell; no radius/shadow so it melds with fade zones */}
            <Box
                sx={{
                    gridArea: 'content',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    alignSelf: 'center',
                    justifySelf: 'center',
                    width: 'fit-content',
                    height: 'fit-content',
                    padding: '12px 16px',
                    background: (theme) => theme.palette.background.paper,
                    minWidth: '200px',
                    maxWidth: '280px',
                    pointerEvents: 'auto'
                }}
            >
                {checkpoints.map((checkpoint) => (
                    <CheckpointItem
                        key={checkpoint.id}
                        label={checkpoint.label}
                        completed={checkpoint.completed}
                    />
                ))}
            </Box>
            </Box>
        </Box>
    )
}

export default CheckpointOverlay
