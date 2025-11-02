/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import configureStore from 'redux-mock-store'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import Library from './index'
import { AssetClientPlayerAsset } from '@tonylb/mtw-interfaces/ts/asset'
import { libraryDataSourceSlice } from '../../slices/libraryDataSource'

// Mock navigation dependencies
vi.mock('../../slices/UI/navigationTabs/useAutoPin', () => ({
    default: vi.fn()
}))

vi.mock('../../slices/lifeLine', () => ({
    socketDispatchPromise: vi.fn(() => Promise.resolve({}))
}))

vi.mock('../Onboarding/useOnboarding', () => ({
    default: vi.fn(),
    useOnboardingCheckpoint: vi.fn()
}))

vi.mock('../../slices/libraryDataSource', async () => {
    const actual = await vi.importActual('../../slices/libraryDataSource')
    return {
        ...actual,
        subscribeToLibrary: vi.fn(() => ({ type: 'MOCK_SUBSCRIBE_TO_LIBRARY' })),
        unsubscribeFromLibrary: vi.fn(() => ({ type: 'MOCK_UNSUBSCRIBE_FROM_LIBRARY' }))
    }
})

const mockStore = configureStore()

// Helper to create test assets
const createTestAsset = (assetId: string, zone: string, shortName?: string): AssetClientPlayerAsset & { zone?: string; ShortName?: string } => ({
    AssetId: `ASSET#${assetId}`,
    zone: zone as any,
    ShortName: shortName,
    Story: undefined,
    instance: undefined
})

// Helper to get proper libraryDataSource initial state
const getLibraryDataSourceState = () => libraryDataSourceSlice.getInitialState()

const TestWrapper: React.FunctionComponent<{ children: React.ReactNode; store: any }> = ({ children, store }) => {
    const theme = createTheme()
    return (
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <BrowserRouter>
                    {children}
                </BrowserRouter>
            </ThemeProvider>
        </Provider>
    )
}

describe('Library - Multi-Draft Feature', () => {
    let store: any

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
        
        store = mockStore({
            player: {
                publicData: {
                    Assets: [],
                    Characters: []
                }
            },
            libraryDataSource: getLibraryDataSourceState()
        })
    })

    describe('Tab Filtering', () => {
        it('should display both Drafts and Assets tabs', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft', 'My Draft'),
                            createTestAsset('personal-1', 'Personal', 'My Asset')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Should show both tabs
            expect(screen.getByRole('tab', { name: /drafts/i })).toBeInTheDocument()
            expect(screen.getByRole('tab', { name: /assets/i })).toBeInTheDocument()
        })

        it('should show Drafts tab by default', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft', 'My Draft'),
                            createTestAsset('personal-1', 'Personal', 'My Asset')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Drafts tab should be selected
            const draftsTab = screen.getByRole('tab', { name: /drafts/i })
            expect(draftsTab).toHaveAttribute('aria-selected', 'true')
        })

        it('should filter to show only Draft zone assets in Drafts tab', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft', 'Draft One'),
                            createTestAsset('draft-2', 'Draft', 'Draft Two'),
                            createTestAsset('personal-1', 'Personal', 'Personal One'),
                            createTestAsset('personal-2', 'Personal', 'Personal Two')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Should show only draft assets
            expect(screen.getByText('Draft One')).toBeInTheDocument()
            expect(screen.getByText('Draft Two')).toBeInTheDocument()
            expect(screen.queryByText('Personal One')).not.toBeInTheDocument()
            expect(screen.queryByText('Personal Two')).not.toBeInTheDocument()
        })

        it('should filter to show only Personal zone assets in Assets tab', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft', 'Draft One'),
                            createTestAsset('draft-2', 'Draft', 'Draft Two'),
                            createTestAsset('personal-1', 'Personal', 'Personal One'),
                            createTestAsset('personal-2', 'Personal', 'Personal Two')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Switch to Assets tab
            const assetsTab = screen.getByRole('tab', { name: /assets/i })
            fireEvent.click(assetsTab)

            // Should show only personal assets
            expect(screen.queryByText('Draft One')).not.toBeInTheDocument()
            expect(screen.queryByText('Draft Two')).not.toBeInTheDocument()
            expect(screen.getByText('Personal One')).toBeInTheDocument()
            expect(screen.getByText('Personal Two')).toBeInTheDocument()
        })

        it('should handle empty Drafts tab gracefully', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('personal-1', 'Personal', 'Personal One')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Should show placeholder card for creating new draft
            expect(screen.getByText('New Draft')).toBeInTheDocument()
        })
    })

    describe('Card Display', () => {
        it('should display ShortName when available', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft', 'My Special Draft')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            expect(screen.getByText('My Special Draft')).toBeInTheDocument()
        })

        it('should display fallback label when ShortName is missing', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('draft-1', 'Draft')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Should show UUID-based fallback
            expect(screen.getByText(/Untitled draft-1/i)).toBeInTheDocument()
        })

        it('should show Summary when available', () => {
            const summaryText = 'This is a test summary'
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            {
                                ...createTestAsset('draft-1', 'Draft', 'My Draft'),
                                Summary: [
                                    { data: { tag: 'String', value: summaryText }, children: [] }
                                ]
                            }
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            expect(screen.getByText(summaryText)).toBeInTheDocument()
        })
    })

    describe('Create Draft Placeholder', () => {
        it('should show create draft placeholder in Drafts tab', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            expect(screen.getByText('New Draft')).toBeInTheDocument()
        })

        it('should not show create draft placeholder in Assets tab', () => {
            store = mockStore({
                player: {
                    publicData: {
                        Assets: [
                            createTestAsset('personal-1', 'Personal', 'My Asset')
                        ],
                        Characters: []
                    }
                },
                libraryDataSource: getLibraryDataSourceState()
            })

            render(
                <TestWrapper store={store}>
                    <Library />
                </TestWrapper>
            )

            // Switch to Assets tab
            const assetsTab = screen.getByRole('tab', { name: /assets/i })
            fireEvent.click(assetsTab)

            // Should not show placeholder
            expect(screen.queryByText('New Draft')).not.toBeInTheDocument()
        })
    })
})

