import React, { FunctionComponent } from 'react'
import {
    ListItem,
    ListItemButton,
    ListItemText,
    Typography
} from '@mui/material'
import { ThinkingJobCompletedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

type CompletedJobRowProps = {
    job: ThinkingJobCompletedEvent
    onSelectWorkItem: (workItemId: string) => void
}

const truncateWorkItemId = (workItemId: string): string =>
    workItemId.length > 12 ? `${workItemId.slice(0, 8)}...${workItemId.slice(-4)}` : workItemId

export const CompletedJobRow: FunctionComponent<CompletedJobRowProps> = ({ job, onSelectWorkItem }) => (
    <>
        <ListItem alignItems="flex-start" sx={{ px: 0, pb: 0 }}>
            <ListItemText
                primary={job.generationId}
                primaryTypographyProps={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    sx: { wordBreak: 'break-all' }
                }}
                secondary={
                    <Typography component="span" variant="body2" color="text.secondary" display="block">
                        {new Date(job.completedAt).toLocaleString()}
                    </Typography>
                }
            />
        </ListItem>
        {job.schedules.map((schedule) => (
            <ListItem key={schedule.workItemId} disablePadding sx={{ pl: 2 }}>
                <ListItemButton onClick={() => onSelectWorkItem(schedule.workItemId)}>
                    <ListItemText
                        primary={schedule.segment}
                        secondary={truncateWorkItemId(schedule.workItemId)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem'
                        }}
                    />
                </ListItemButton>
            </ListItem>
        ))}
    </>
)
