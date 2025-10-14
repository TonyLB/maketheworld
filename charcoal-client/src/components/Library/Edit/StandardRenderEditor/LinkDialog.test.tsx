/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom'
import { createEditor } from 'slate'
import { Slate, withReact } from 'slate-react'
import LinkDialog from './LinkDialog'
import { useLibraryAsset } from '../LibraryAsset'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

// Mock the LibraryAsset hook
const mockUseLibraryAsset = vi.fn()
vi.mock('../LibraryAsset', () => ({
    useLibraryAsset: () => mockUseLibraryAsset()
}))

// Mock the slate editor
const mockEditor = withReact(createEditor())

// Mock slate-react useSlate hook
vi.mock('slate-react', async () => {
    const actual = await vi.importActual('slate-react')
    return {
        ...actual,
        useSlate: () => mockEditor
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
            <Feature key=(feature1) />
            <Feature key=(feature2) />
            <Knowledge key=(knowledge1) />
            <Knowledge key=(knowledge2) />
        </Asset>
    `)

    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
        mockUseLibraryAsset.mockReturnValue({
            standardForm: mockStandardForm
        })
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
