import React, { FunctionComponent, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
    Box,
    Button,
    Collapse,
    Typography
} from '@mui/material'

import {
    getThinkingResult,
    getThinkingResultDisplayError,
    getThinkingResultFetchState,
    requestThinkingResult
} from '../../slices/thinkingResults'
import { getSelectedThinkingWorkItemId } from '../../slices/UI/thinkingDashboard'
import { RootState } from '../../store'

export const ThinkingResultDetail: FunctionComponent = () => {
    const dispatch = useDispatch()
    const workItemId = useSelector(getSelectedThinkingWorkItemId)
    const result = useSelector((state: RootState) => (workItemId ? getThinkingResult(workItemId)(state) : undefined))
    const fetchState = useSelector((state: RootState) => (workItemId ? getThinkingResultFetchState(workItemId)(state) : undefined))
    const displayError = useSelector((state: RootState) => (workItemId ? getThinkingResultDisplayError(workItemId)(state) : undefined))
    const [verboseOpen, setVerboseOpen] = useState(false)

    if (!workItemId) {
        return null
    }

    const handleRetry = () => {
        dispatch(requestThinkingResult(workItemId))
    }

    return (
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mb: 2 }}>
                {workItemId}
            </Typography>

            {fetchState === 'loading' && (
                <Typography color="text.secondary">Loading result...</Typography>
            )}

            {fetchState === 'error' && (
                <Box>
                    <Typography color="error" sx={{ mb: 1 }}>
                        {displayError ?? 'Failed to load thinking result'}
                    </Typography>
                    <Button variant="outlined" size="small" onClick={handleRetry}>
                        Retry
                    </Button>
                </Box>
            )}

            {fetchState === 'ready' && result && (
                <Box component="dl" sx={{ m: 0 }}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                        Segment
                    </Typography>
                    <Typography component="dd" variant="body1" sx={{ mt: 0, mb: 1 }}>
                        {result.segment}
                    </Typography>

                    <Typography component="dt" variant="caption" color="text.secondary">
                        Status
                    </Typography>
                    <Typography component="dd" variant="body1" sx={{ mt: 0, mb: 1 }}>
                        {result.ok ? 'Success' : 'Failed'}
                    </Typography>

                    <Typography component="dt" variant="caption" color="text.secondary">
                        Completed at
                    </Typography>
                    <Typography component="dd" variant="body1" sx={{ mt: 0, mb: 1 }}>
                        {new Date(result.completedAt).toLocaleString()}
                    </Typography>

                    {result.generationId && (
                        <>
                            <Typography component="dt" variant="caption" color="text.secondary">
                                Generation
                            </Typography>
                            <Typography
                                component="dd"
                                variant="body2"
                                sx={{ mt: 0, mb: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}
                            >
                                {result.generationId}
                            </Typography>
                        </>
                    )}

                    {!result.ok && result.errorCode && (
                        <>
                            <Typography component="dt" variant="caption" color="text.secondary">
                                Error code
                            </Typography>
                            <Typography component="dd" variant="body1" sx={{ mt: 0, mb: 1 }}>
                                {result.errorCode}
                            </Typography>
                        </>
                    )}

                    {!result.ok && result.errorMessage && (
                        <>
                            <Typography component="dt" variant="caption" color="text.secondary">
                                Error message
                            </Typography>
                            <Typography component="dd" variant="body1" sx={{ mt: 0, mb: 1 }}>
                                {result.errorMessage}
                            </Typography>
                        </>
                    )}

                    {result.verbose !== undefined && (
                        <Box sx={{ mt: 2 }}>
                            <Button size="small" onClick={() => setVerboseOpen((open) => !open)}>
                                {verboseOpen ? 'Hide verbose' : 'Show verbose'}
                            </Button>
                            <Collapse in={verboseOpen}>
                                <Box
                                    component="pre"
                                    sx={{
                                        mt: 1,
                                        p: 1,
                                        overflow: 'auto',
                                        fontSize: '0.75rem',
                                        bgcolor: 'action.hover',
                                        borderRadius: 1
                                    }}
                                >
                                    {JSON.stringify(result.verbose, null, 2)}
                                </Box>
                            </Collapse>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    )
}
