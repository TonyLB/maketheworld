/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { createEditor } from 'slate'
import { Slate, withReact } from 'slate-react'
import LinkDialog from './LinkDialog'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// Mock the LibraryAsset hook
const mockUseLibraryAsset = vi.fn()
vi.mock('../LibraryAsset', () => ({
    useLibraryAsset: () => mockUseLibraryAsset()
}))

// Mock the slate editor
const mockEditor = withReact(createEditor())

// Mock slate-react useSlate hook and ReactEditor.focus
// ReactEditor.focus() requires DOM nodes that aren't available in the test environment,
// so we mock it to prevent "Cannot resolve a DOM node from Slate node" errors.
vi.mock('slate-react', async () => {
    const actual = await vi.importActual<typeof import('slate-react')>('slate-react')
    return {
        ...actual,
        useSlate: () => mockEditor,
        ReactEditor: {
            ...(actual?.ReactEditor || {}),
            focus: vi.fn() // Mock focus to avoid DOM resolution errors in tests
        }
    }
})

// Test wrapper with Material-UI theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const theme = createTheme()
    return (
        <ThemeProvider theme={theme}>
            <Slate editor={mockEditor} value={[]}>
                {children}
            </Slate>
        </ThemeProvider>
    )
}

describe('LinkDialog', () => {
    const mockOnClose = vi.fn()
    
    const mockStandardForm = new StandardForm(`
        <Asset uuid=(testAsset)>
            <Feature uuid=(feature1) key=(feature1) />
            <Feature uuid=(feature2) key=(feature2) />
            <Knowledge uuid=(knowledge1) key=(knowledge1) />
            <Knowledge uuid=(knowledge2) key=(knowledge2) />
        </Asset>
    `)

    beforeEach(() => {
        // Use fake timers to control setTimeout calls in LinkDialog component.
        // When a link is clicked, LinkDialog uses setTimeout (10ms delay) to restore
        // editor selection and focus. Without fake timers, this timeout fires after
        // the test completes and the component unmounts, causing ReactEditor.focus()
        // to fail when trying to resolve DOM nodes from an unmounted Slate editor.
        // Fake timers allow us to advance time during the test while the component
        // is still mounted, preventing this race condition.
        vi.useFakeTimers()
        vi.clearAllMocks()
        vi.resetAllMocks()
        mockUseLibraryAsset.mockReturnValue({
            standardForm: mockStandardForm
        })
    })

    afterEach(() => {
        // Clean up rendered components to prevent cross-test contamination.
        // This ensures components from previous tests don't interfere with current tests.
        cleanup()
        // Clear all pending timers without running them to prevent timers from
        // previous tests from executing after component cleanup. Running timers
        // here could cause side effects (like focus calls) on unmounted components.
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    describe('Dialog Rendering', () => {
        it('renders when open is true', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} />
                </TestWrapper>
            )
            
            expect(screen.getByText('Select Link Target')).toBeInTheDocument()
            expect(screen.getByText('Features')).toBeInTheDocument()
            expect(screen.getByText('Knowledge')).toBeInTheDocument()
        })

        it('does not render when open is false', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={false} onClose={mockOnClose} />
                </TestWrapper>
            )
            
            expect(screen.queryByText('Select Link Target')).not.toBeInTheDocument()
        })
    })

    describe('Feature Links', () => {
        it('displays feature options when Feature is in validTags', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} validTags={['Feature']} />
                </TestWrapper>
            )
            
            expect(screen.getByText('Features')).toBeInTheDocument()
            expect(screen.getByText('feature1')).toBeInTheDocument()
            expect(screen.getByText('feature2')).toBeInTheDocument()
        })

        it('calls onClose when feature link is selected', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} validTags={['Feature']} />
                </TestWrapper>
            )
            
            const featureLink = screen.getByText('feature1')
            fireEvent.click(featureLink)
            
            expect(mockOnClose).toHaveBeenCalledTimes(1)
            
            // Advance timers to trigger the setTimeout that restores editor focus.
            // This ensures the timeout executes while the component is still mounted,
            // preventing "Cannot resolve a DOM node from Slate node" errors.
            vi.advanceTimersByTime(10)
        })
    })

    describe('Knowledge Links', () => {
        it('displays knowledge options when Knowledge is in validTags', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} validTags={['Knowledge']} />
                </TestWrapper>
            )
            
            expect(screen.getByText('Knowledge')).toBeInTheDocument()
            expect(screen.getByText('knowledge1')).toBeInTheDocument()
            expect(screen.getByText('knowledge2')).toBeInTheDocument()
        })

        it('calls onClose when knowledge link is selected', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} validTags={['Knowledge']} />
                </TestWrapper>
            )
            
            const knowledgeLink = screen.getByText('knowledge1')
            fireEvent.click(knowledgeLink)
            
            expect(mockOnClose).toHaveBeenCalledTimes(1)
            
            // Advance timers to trigger the setTimeout that restores editor focus.
            // This ensures the timeout executes while the component is still mounted,
            // preventing "Cannot resolve a DOM node from Slate node" errors.
            vi.advanceTimersByTime(10)
        })
    })

    describe('Default Behavior', () => {
        it('defaults to showing both Feature and Knowledge when validTags is not provided', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} />
                </TestWrapper>
            )
            
            expect(screen.getByText('Features')).toBeInTheDocument()
            expect(screen.getByText('Knowledge')).toBeInTheDocument()
            expect(screen.getByText('feature1')).toBeInTheDocument()
            expect(screen.getByText('knowledge1')).toBeInTheDocument()
        })
    })

    describe('Close Functionality', () => {
        it('calls onClose when close button is clicked', () => {
            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} />
                </TestWrapper>
            )
            
            const closeButton = screen.getByLabelText('close')
            fireEvent.click(closeButton)
            
            expect(mockOnClose).toHaveBeenCalledTimes(1)
        })
    })

    describe('Empty State Handling', () => {
        it('handles empty standardForm gracefully', () => {
            const emptyStandardForm = new StandardForm(`<Asset uuid=(testAsset) />`)
            
            mockUseLibraryAsset.mockReturnValue({
                standardForm: emptyStandardForm
            })

            render(
                <TestWrapper>
                    <LinkDialog open={true} onClose={mockOnClose} />
                </TestWrapper>
            )
            
            expect(screen.getByText('Select Link Target')).toBeInTheDocument()
            expect(screen.queryByText('Features')).not.toBeInTheDocument()
            expect(screen.queryByText('Knowledge')).not.toBeInTheDocument()
        })
    })
})
