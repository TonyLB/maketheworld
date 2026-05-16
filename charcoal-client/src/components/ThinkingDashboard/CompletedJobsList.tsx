import React, { FunctionComponent } from 'react'
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material'
import { ThinkingJobCompletedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import { formatSegmentSummary } from './formatSegmentSummary'

type CompletedJobsListProps = {
    jobs: ThinkingJobCompletedEvent[]
    connecting: boolean
}

export const CompletedJobsList: FunctionComponent<CompletedJobsListProps> = ({ jobs, connecting }) => (
    <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1 }}>
        {connecting && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Connecting to job stream...
            </Typography>
        )}
        {jobs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                No completed thinking jobs yet.
            </Typography>
        ) : (
            <List dense>
                {jobs.map((job) => (
                    <ListItem key={job.generationId} alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemText
                            primary={job.generationId}
                            primaryTypographyProps={{
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                sx: { wordBreak: 'break-all' }
                            }}
                            secondary={
                                <>
                                    <Typography component="span" variant="body2" color="text.secondary" display="block">
                                        {new Date(job.completedAt).toLocaleString()}
                                    </Typography>
                                    <Typography component="span" variant="body2" color="text.secondary" display="block">
                                        {formatSegmentSummary(job.schedules)}
                                    </Typography>
                                </>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        )}
    </Box>
)
