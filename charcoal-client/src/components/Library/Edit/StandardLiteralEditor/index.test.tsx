/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom' // Import for Jest DOM matchers
import { StandardLiteralEditor } from './index'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

// Mock the useLibraryAsset hook
const mockUseLibraryAsset = vi.fn(() => ({
    readonly: false
}))

vi.mock('../LibraryAsset', () => ({
    useLibraryAsset: () => mockUseLibraryAsset()
}))

// Mock the useDebouncedOnChange hook
const mockUseDebouncedOnChange = vi.fn()
vi.mock('../../../../hooks/useDebounce', () => ({
    useDebouncedOnChange: (props: any) => mockUseDebouncedOnChange(props)
}))

// Helper to create a StandardLiteral instance
const createTestLiteral = (value: string) => new StandardLiteral(value)

// Mock callback function for testing
const mockOnChange = vi.fn()

// Theme wrapper for Material-UI components
const TestWrapper: React.FunctionComponent = ({ children }) => {
    const theme = createTheme()
    return (
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    )
}

describe('StandardLiteralEditor', () => {
    beforeEach(() => {
        mockOnChange.mockClear()
        mockUseLibraryAsset.mockReturnValue({ readonly: false })
        mockUseDebouncedOnChange.mockClear()
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    describe('Rendering', () => {
        it('renders with basic props', () => {
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test Value')
            expect(textField).toBeInTheDocument()
        })

        it('renders with placeholder text', () => {
            const testValue = createTestLiteral('')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} placeholder="Enter text here" />
                </TestWrapper>
            )
            const textField = screen.getByPlaceholderText('Enter text here')
            expect(textField).toBeInTheDocument()
        })

        it('applies size prop correctly', () => {
            const testValue = createTestLiteral('Test')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} size="small" />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test')
            // Check for the size class on the input element
            expect(textField).toHaveClass('MuiInputBase-inputSizeSmall')
        })

        it('applies fullWidth prop correctly', () => {
            const testValue = createTestLiteral('Test')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} fullWidth={true} />
                </TestWrapper>
            )
            // Check for fullWidth on the FormControl wrapper
            const formControl = screen.getByDisplayValue('Test').closest('.MuiFormControl-root')
            expect(formControl).toHaveClass('MuiFormControl-fullWidth')
        })
    })

    describe('User Interactions', () => {
        it('updates local value on user input', () => {
            const testValue = createTestLiteral('Initial Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Initial Value')
            fireEvent.change(textField, { target: { value: 'New Value' } })
            expect(textField).toHaveValue('New Value')
        })

        it('calls useDebouncedOnChange hook with correct parameters', () => {
            const testValue = createTestLiteral('Initial Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            
            // Verify that useDebouncedOnChange was called with the correct parameters
            expect(mockUseDebouncedOnChange).toHaveBeenCalledWith({
                value: 'Initial Value',
                delay: 1000,
                onChange: expect.any(Function)
            })
        })

        it('does not call onChange when value is the same', () => {
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            
            // The component should not call onChange for the same value
            expect(mockOnChange).not.toHaveBeenCalled()
        })
    })

    describe('Readonly Behavior', () => {
        it('disables input when readonly prop is true', () => {
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} readonly={true} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test Value')
            expect(textField).toBeDisabled()
        })

        it('disables input when asset is readonly', () => {
            mockUseLibraryAsset.mockReturnValue({ readonly: true })
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test Value')
            expect(textField).toBeDisabled()
        })

        it('allows input when readonly is false and asset is not readonly', () => {
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} readonly={false} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test Value')
            expect(textField).not.toBeDisabled()
        })
    })

    describe('Value Handling', () => {
        it('handles empty StandardLiteral correctly', () => {
            const testValue = createTestLiteral('')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('')
            expect(textField).toBeInTheDocument()
        })

        it('handles undefined value gracefully', () => {
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={undefined as any} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('')
            expect(textField).toBeInTheDocument()
        })

        it('updates display when value prop changes', () => {
            const { rerender } = render(
                <TestWrapper>
                    <StandardLiteralEditor value={createTestLiteral('Initial')} onChange={mockOnChange} />
                </TestWrapper>
            )

            expect(screen.getByDisplayValue('Initial')).toBeInTheDocument()

            rerender(
                <TestWrapper>
                    <StandardLiteralEditor value={createTestLiteral('Updated')} onChange={mockOnChange} />
                </TestWrapper>
            )

            expect(screen.getByDisplayValue('Updated')).toBeInTheDocument()
        })
    })

    describe('Edge Cases', () => {
        it('handles very long text values', () => {
            const longText = 'a'.repeat(1000)
            const testValue = createTestLiteral(longText)
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue(longText)
            expect(textField).toBeInTheDocument()
        })

        it('handles special characters in text', () => {
            const specialText = '!@#$%^&*()_+{}[]|:;"\'<>,.?/~`'
            const testValue = createTestLiteral(specialText)
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue(specialText)
            expect(textField).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('has proper ARIA attributes', () => {
            const testValue = createTestLiteral('Test Value')
            render(
                <TestWrapper>
                    <StandardLiteralEditor value={testValue} onChange={mockOnChange} placeholder="Enter text" />
                </TestWrapper>
            )
            const textField = screen.getByDisplayValue('Test Value')
            expect(textField).toHaveAttribute('placeholder', 'Enter text')
            expect(textField).toHaveAttribute('aria-invalid', 'false')
        })
    })
})
