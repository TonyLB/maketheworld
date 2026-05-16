import React, { FunctionComponent } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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
import {
    clearThinkingResultSelection,
    getSelectedThinkingWorkItemId,
    openThinkingResultDetail
} from '../../slices/UI/thinkingDashboard'
import { CompletedJobsList } from './CompletedJobsList'
import { ThinkingResultDetail } from './ThinkingResultDetail'

type ThinkingDashboardContainerProps = {
    open: boolean
    onClose: () => void
}

const ThinkingDashboardPanel: FunctionComponent<{ onClose: () => void }> = ({ onClose }) => {
    const dispatch = useDispatch()
    const jobs = useSelector(getCompletedThinkingJobsNewestFirst)
    const subscribed = useSelector(getIsThinkingJobsSubscribed)
    const selectedWorkItemId = useSelector(getSelectedThinkingWorkItemId)
    const showingDetail = Boolean(selectedWorkItemId)

    const handleSelectWorkItem = (workItemId: string) => {
        dispatch(openThinkingResultDetail(workItemId))
    }

    const handleBackToList = () => {
        dispatch(clearThinkingResultSelection())
    }

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
                    gap: 1,
                    background: (theme) => (theme.palette as any).extras?.headerGradient
                }}
            >
                {showingDetail && (
                    <Button size="small" onClick={handleBackToList} sx={{ minWidth: 'auto', px: 1 }}>
                        Back
                    </Button>
                )}
                <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
                    {showingDetail ? 'Thinking result' : 'Thinking jobs'}
                </Typography>
            </Box>

            {showingDetail ? (
                <ThinkingResultDetail />
            ) : (
                <CompletedJobsList
                    jobs={jobs}
                    connecting={!subscribed}
                    onSelectWorkItem={handleSelectWorkItem}
                />
            )}

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
