/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import thunk from 'redux-thunk'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'

import { ThinkingDashboardContainer } from './ThinkingDashboardContainer'

const mockStore = configureStore([thunk])

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

const thinkingResult = {
    schemaVersion: 1,
    generationId: completedJob.generationId,
    workItemId: 'work-1',
    segment: 'candidates' as const,
    ok: true,
    completedAt: '2026-05-14T13:00:00.000Z',
    verbose: { sample: true }
}

const buildStore = (overrides: {
    jobs?: typeof completedJob[]
    subscribed?: boolean
    open?: boolean
    selectedWorkItemId?: string | null
    thinkingResultsById?: Record<string, unknown>
} = {}) => {
    const jobs = overrides.jobs ?? []
    const subscribed = overrides.subscribed ?? true
    const selectedWorkItemId = overrides.selectedWorkItemId ?? null
    return mockStore({
        UI: {
            thinkingDashboard: { open: overrides.open ?? true, selectedWorkItemId }
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
        },
        thinkingResults: {
            byId: overrides.thinkingResultsById ?? {}
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

    it('renders job generationId and clickable segment rows', () => {
        const store = buildStore({ jobs: [completedJob] })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        expect(screen.getByText(completedJob.generationId)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /candidates/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /planSelect/i })).toBeInTheDocument()
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

    it('shows result detail when a segment is selected', () => {
        const store = buildStore({
            jobs: [completedJob],
            selectedWorkItemId: 'work-1',
            thinkingResultsById: {
                'work-1': {
                    internalData: { id: 'work-1', incrementalBackoff: 0.5 },
                    publicData: { result: thinkingResult },
                    meta: {
                        currentState: 'READY',
                        desiredStates: ['READY'],
                        inProgress: null,
                        onEnterPromises: {}
                    }
                }
            }
        })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        expect(screen.getByRole('heading', { name: 'Thinking result' })).toBeInTheDocument()
        expect(screen.getByText('candidates')).toBeInTheDocument()
        expect(screen.getByText('Success')).toBeInTheDocument()
    })

    it('dispatches openThinkingResultDetail when segment row is clicked', () => {
        const store = buildStore({ jobs: [completedJob] })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        fireEvent.click(screen.getByRole('button', { name: /candidates/i }))
        const actions = store.getActions()
        expect(actions.some((a) => a.type === 'thinkingDashboard/selectThinkingResult' && a.payload === 'work-1')).toBe(true)
    })

    it('returns to list when Back is clicked from detail view', () => {
        const store = buildStore({
            jobs: [completedJob],
            selectedWorkItemId: 'work-1',
            thinkingResultsById: {
                'work-1': {
                    internalData: { id: 'work-1', incrementalBackoff: 0.5 },
                    publicData: { result: thinkingResult },
                    meta: {
                        currentState: 'READY',
                        desiredStates: ['READY'],
                        inProgress: null,
                        onEnterPromises: {}
                    }
                }
            }
        })
        render(
            <Provider store={store}>
                <ThinkingDashboardContainer open={true} onClose={vi.fn()} />
            </Provider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        const actions = store.getActions()
        expect(actions.some((a) => a.type === 'thinkingDashboard/clearThinkingResultSelection')).toBe(true)
    })
})
