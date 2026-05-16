import React, { FunctionComponent } from 'react'
import { Box, List, Typography } from '@mui/material'
import { ThinkingJobCompletedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import { CompletedJobRow } from './CompletedJobRow'

type CompletedJobsListProps = {
    jobs: ThinkingJobCompletedEvent[]
    connecting: boolean
    onSelectWorkItem: (workItemId: string) => void
}

export const CompletedJobsList: FunctionComponent<CompletedJobsListProps> = ({
    jobs,
    connecting,
    onSelectWorkItem
}) => (
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
                    <CompletedJobRow
                        key={job.generationId}
                        job={job}
                        onSelectWorkItem={onSelectWorkItem}
                    />
                ))}
            </List>
        )}
    </Box>
)
