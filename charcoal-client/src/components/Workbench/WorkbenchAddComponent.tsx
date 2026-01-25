import React, { FunctionComponent, useCallback, useState } from 'react'
import {
    Box,
    Button,
    IconButton,
    Typography,
    useTheme
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import FeatureIcon from '@mui/icons-material/Search'
import KnowledgeIcon from '@mui/icons-material/School'
import MapIcon from '@mui/icons-material/Map'
import PersonIcon from '@mui/icons-material/Person'
import HomeIcon from '@mui/icons-material/Home'
import ImageIcon from '@mui/icons-material/Image'

export type AddComponentTag = 'Character' | 'Map' | 'Room' | 'Feature' | 'Knowledge' | 'Image'

interface WorkbenchAddComponentProps {
    onAddAsset: (tag: AddComponentTag) => void
    isEven?: boolean
}

const ADD_OPTIONS: { tag: AddComponentTag; icon: React.ReactNode; label: string }[] = [
    { tag: 'Character', icon: <PersonIcon sx={{ fontSize: '1rem' }} />, label: 'Character' },
    { tag: 'Map', icon: <MapIcon sx={{ fontSize: '1rem' }} />, label: 'Map' },
    { tag: 'Room', icon: <HomeIcon sx={{ fontSize: '1rem' }} />, label: 'Room' },
    { tag: 'Feature', icon: <FeatureIcon sx={{ fontSize: '1rem' }} />, label: 'Feature' },
    { tag: 'Knowledge', icon: <KnowledgeIcon sx={{ fontSize: '1rem' }} />, label: 'Knowledge' },
    { tag: 'Image', icon: <ImageIcon sx={{ fontSize: '1rem' }} />, label: 'Image' }
]

export const WorkbenchAddComponent: FunctionComponent<WorkbenchAddComponentProps> = ({
    onAddAsset,
    isEven = false
}) => {
    const theme = useTheme()
    const [expanded, setExpanded] = useState(false)

    const handleRowClick = useCallback(() => {
        setExpanded((prev) => !prev)
    }, [])

    const handleAddLocal = useCallback(
        (tag: AddComponentTag) => (e: React.MouseEvent) => {
            e.stopPropagation()
            onAddAsset(tag)
            setExpanded(false)
        },
        [onAddAsset]
    )

    const rowBg = isEven
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)
        : 'transparent'
    const rowHoverBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.18)

    return (
        <Box
            sx={{
                borderRadius: '4px',
                backgroundColor: expanded ? rowBg : undefined,
                '&:hover': expanded ? undefined : { backgroundColor: rowHoverBg }
            }}
        >
            <Box
                onClick={handleRowClick}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse add options' : 'Expand to add component'}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleRowClick()
                    }
                }}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    padding: '0.5em 0.75em',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: !expanded ? rowBg : 'transparent',
                    '&:hover': {
                        backgroundColor: rowHoverBg
                    }
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        width: '38px',
                        flexShrink: 0,
                        color: 'text.secondary'
                    }}
                >
                    <AddIcon sx={{ fontSize: '1.25rem' }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                        Add component
                    </Typography>
                </Box>
                <IconButton size="small" sx={{ padding: '0.25em' }} aria-hidden>
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>

            {expanded && (
                <Box
                    sx={{
                        padding: '0 0.75em 0.75em 0.75em',
                        paddingLeft: 'calc(38px + 8px + 0.75em)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {ADD_OPTIONS.map(({ tag, icon, label }) => (
                        <Button
                            key={tag}
                            size="small"
                            variant="contained"
                            startIcon={icon}
                            onClick={handleAddLocal(tag)}
                            sx={{ textTransform: 'none' }}
                        >
                            {label}
                        </Button>
                    ))}
                </Box>
            )}
        </Box>
    )
}

export default WorkbenchAddComponent
