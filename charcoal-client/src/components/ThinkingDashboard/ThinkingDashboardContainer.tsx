import React, { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import {
    Box,
    Button,
    Dialog,
    Drawer,
    Typography,
    useMediaQuery
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

import {
    getCompletedThinkingJobsNewestFirst,
    getIsThinkingJobsSubscribed
} from '../../slices/thinkingJobs'
import { CompletedJobsList } from './CompletedJobsList'

type ThinkingDashboardContainerProps = {
    open: boolean
    onClose: () => void
}

const ThinkingDashboardPanel: FunctionComponent<{ onClose: () => void }> = ({ onClose }) => {
    const jobs = useSelector(getCompletedThinkingJobsNewestFirst)
    const subscribed = useSelector(getIsThinkingJobsSubscribed)

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
        >
            <Box
                sx={{
                    padding: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    minHeight: 64,
                    display: 'flex',
                    alignItems: 'center',
                    background: (theme) => (theme.palette as any).extras?.headerGradient
                }}
            >
                <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
                    Thinking jobs
                </Typography>
            </Box>

            <CompletedJobsList jobs={jobs} connecting={!subscribed} />

            <Box
                sx={{
                    padding: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                    minHeight: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<ArrowBackIcon />}
                    onClick={onClose}
                    sx={{ minWidth: 200 }}
                >
                    Return to Story
                </Button>
            </Box>
        </Box>
    )
}

export const ThinkingDashboardContainer: FunctionComponent<ThinkingDashboardContainerProps> = ({
    open,
    onClose
}) => {
    const isDesktop = useMediaQuery('(min-width: 1200px) and (orientation: landscape)')

    if (isDesktop) {
        return (
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                variant="persistent"
                sx={{
                    '& .MuiDrawer-paper': {
                        width: 600,
                        boxSizing: 'border-box'
                    }
                }}
            >
                <ThinkingDashboardPanel onClose={onClose} />
            </Drawer>
        )
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: {
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <ThinkingDashboardPanel onClose={onClose} />
        </Dialog>
    )
}
