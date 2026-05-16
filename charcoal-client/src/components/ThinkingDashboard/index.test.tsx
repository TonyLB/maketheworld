/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'

import { ThinkingDashboardContainer } from './ThinkingDashboardContainer'

const mockStore = configureStore([])

const completedJob = {
    schemaVersion: 1,
    generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    jobStatus: 'completed' as const,
    completedAt: '2026-05-14T13:00:00.000Z',
    schedules: [
        {
            schemaVersion: 1,
            generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            workItemId: 'work-1',
            segment: 'candidates' as const,
            scheduleStatus: 'completed' as const
        },
        {
            schemaVersion: 1,
            generationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            workItemId: 'work-2',
            segment: 'planSelect' as const,
            scheduleStatus: 'completed' as const
        }
    ]
}

const buildStore = (overrides: {
    jobs?: typeof completedJob[]
    subscribed?: boolean
    open?: boolean
} = {}) => {
    const jobs = overrides.jobs ?? []
    const subscribed = overrides.subscribed ?? true
    return mockStore({
        UI: {
            thinkingDashboard: { open: overrides.open ?? true }
        },
        thinkingJobs: {
            publicData: {
                activeStreamKeys: subscribed ? ['global'] : [],
                subscribedStreams: {
                    global: {
                        materializedView: { completedJobs: jobs },
                        recentEvents: []
                    }
                }
            }
        }
    })
}

describe('ThinkingDashboardContainer', () => {
    it('shows empty state when there are no completed jobs', () => {
        const store = buildStore({ jobs: [] })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        expect(screen.getByText('No completed thinking jobs yet.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Thinking jobs' })).toBeInTheDocument()
    })

    it('renders job generationId, time, and segment summary', () => {
        const store = buildStore({ jobs: [completedJob] })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        expect(screen.getByText(completedJob.generationId)).toBeInTheDocument()
        expect(screen.getByText('candidates, planSelect')).toBeInTheDocument()
    })

    it('shows connecting caption when not subscribed', () => {
        const store = buildStore({ jobs: [], subscribed: false })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        expect(screen.getByText('Connecting to job stream...')).toBeInTheDocument()
    })

    it('calls onClose when Return to Story is clicked', () => {
        const onClose = vi.fn()
        const store = buildStore({ jobs: [] })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={onClose} />
            </Provider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Return to Story' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
