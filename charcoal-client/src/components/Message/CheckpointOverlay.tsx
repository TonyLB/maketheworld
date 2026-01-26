import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import { Box, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { getStatus as getLifeLineStatus } from '../../slices/lifeLine'
import { playerDataSourceSelectors } from '../../slices/player/playerDataSource'
import { contentHeadersSelectors } from '../../slices/contentHeaders'
import { selectors as ephemeraSelectors } from '../../slices/ephemera'
import { getActiveCharacters } from '../../slices/activeCharacters'
import { getCurrentCharacterId } from '../../slices/settings'

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
    const playerDataSourceStatus = useSelector(playerDataSourceSelectors.getStatus)
    const contentHeadersStatus = useSelector(contentHeadersSelectors.getStatus)
    const ephemeraStatus = useSelector(ephemeraSelectors.getStatus)
    const activeCharacters = useSelector(getActiveCharacters)
    const currentCharacterId = useSelector(getCurrentCharacterId)

    // Determine checkpoint completion status
    const connectionComplete = lifeLineStatus === 'CONNECTED'
    const playerInfoComplete = playerDataSourceStatus === 'READY' || playerDataSourceStatus === 'SUBSCRIBED'
    // DataSource slices redirect SUBSCRIBED → READY; when stable, contentHeaders sits in READY
    const worldHeadersComplete = contentHeadersStatus === 'READY' || contentHeadersStatus === 'SUBSCRIBED'
    // Ephemera: SUBSCRIBE → SYNCHRONIZE → CONNECTED. Treat SYNCHRONIZE as complete too (we've subscribed;
    // sync may never finish if the backend fails, but we've done our part).
    const ephemeraComplete = ephemeraStatus === 'SYNCHRONIZE' || ephemeraStatus === 'CONNECTED'
    
    // Character-related checkpoints (require currentCharacterId)
    const characterState = currentCharacterId ? activeCharacters[currentCharacterId] : null
    // Character registration is complete when we've reached REGISTER or later states
    const characterRegistrationComplete = characterState && (
        characterState.state === 'REGISTER' ||
        characterState.state === 'SYNCHRONIZE' ||
        characterState.state === 'SYNCHRONIZEBACKOFF' ||
        characterState.state === 'CONNECTED'
    )
    // Messages subscription is complete when character is CONNECTED (messages are subscribed at this point)
    // Note: Messages are subscribed during the activeCharacters flow, but fully active at CONNECTED
    const messagesSubscriptionComplete = characterState && characterState.state === 'CONNECTED'
    // Message sync is complete when character is CONNECTED (indicates SYNCHRONIZE has completed)
    // Both sync and subscription complete at CONNECTED, but we show them as separate logical steps
    const messageSyncComplete = characterState && characterState.state === 'CONNECTED'

    // Checkpoint definitions
    const checkpoints = [
        {
            id: 'connection',
            label: 'Establishing connection',
            completed: connectionComplete
        },
        {
            id: 'player',
            label: 'Reading player information',
            completed: playerInfoComplete
        },
        {
            id: 'headers',
            label: 'Subscribing to world headers',
            completed: worldHeadersComplete
        },
        {
            id: 'ephemera',
            label: 'Subscribing to ephemera',
            completed: ephemeraComplete
        },
        {
            id: 'character',
            label: 'Registering character',
            completed: characterRegistrationComplete || false
        },
        {
            id: 'messages',
            label: 'Subscribing to messages',
            completed: messagesSubscriptionComplete || false
        },
        {
            id: 'sync',
            label: 'Syncing message history',
            completed: messageSyncComplete || false
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
