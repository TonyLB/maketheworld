# Client Testing Standards - Provisional Draft

## Overview

**Purpose**: This document captures our evolving insights and patterns for testing React components in the Vitest framework within the charcoal-client package.

**Context**: This is a **PROVISIONAL DRAFT** of evolving testing standards. As we refine new patterns of testing, we should document them here to establish consistent practices across the client codebase.

**Key Concepts**: 
- **Vitest**: Modern testing framework replacing Jest in the client
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM environment for browser-like testing
- **Material-UI**: Component library requiring special test setup

## Core Testing Commands

### **Basic Test Execution**
```bash
# Watch mode (default)
npm test

# Single run mode (use --run flag)
npm test -- --run

# Test specific file
npm test -- --run src/path/to/test.tsx
```

### **Key Differences from Jest**
- **Command**: `npm test` instead of `npm run test`
- **Run Flag**: Use `--run` for single execution instead of `--watchAll=false`
- **Mocking**: Use `vi` instead of `jest` global
- **Environment**: Explicitly specify `jsdom` environment

## Test File Structure and Setup

### **Required Test File Header**
```typescript
/**
 * @vitest-environment jsdom
 */
```

**Why**: Vitest needs explicit DOM environment for React component testing.

### **Essential Imports**
```typescript
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { vi, beforeEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom' // For Jest DOM matchers
```

## Mocking Patterns

### **Hook Mocking with Vitest**
```typescript
// Create mock functions as variables for better control
const mockUseLibraryAsset = vi.fn(() => ({
    readonly: false
}))

// Mock modules
vi.mock('../LibraryAsset', () => ({
    useLibraryAsset: () => mockUseLibraryAsset()
}))

// Reset mocks in beforeEach
beforeEach(() => {
    mockUseLibraryAsset.mockReturnValue({ readonly: false })
    vi.clearAllMocks()
    vi.resetAllMocks()
})
```

**Key Insights**:
- Use `vi.fn()` instead of `jest.fn()`
- Create mock variables for better control and resetting
- Reset mocks in `beforeEach` to ensure clean state

## Material-UI Testing Setup

### **Theme Provider Wrapper**
```typescript
const TestWrapper: React.FunctionComponent = ({ children }) => {
    const theme = createTheme()
    return (
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    )
}
```

**Why**: Material-UI components need theme context to render properly.

### **Testing Material-UI Props**
```typescript
// Test size prop
it('applies size prop correctly', () => {
    render(
        <TestWrapper>
            <TextField size="small" />
        </TestWrapper>
    )
    const textField = screen.getByRole('textbox')
    expect(textField).toHaveClass('MuiInputBase-inputSizeSmall')
})
```

## Testing Patterns and Best Practices

### **Component State Testing**
```typescript
it('updates local value on user input', () => {
    render(
        <TestWrapper>
            <YourComponent value={initialValue} onChange={mockOnChange} />
        </TestWrapper>
    )
    
    const input = screen.getByDisplayValue(initialValue)
    fireEvent.change(input, { target: { value: 'New Value' } })
    
    expect(input).toHaveValue('New Value')
})
```

### **Hook Integration Testing**
```typescript
it('calls useDebouncedOnChange hook with correct parameters', () => {
    render(
        <TestWrapper>
            <YourComponent value={testValue} onChange={mockOnChange} />
        </TestWrapper>
    )
    
    expect(mockUseDebouncedOnChange).toHaveBeenCalledWith({
        value: 'Expected Value',
        delay: 1000,
        onChange: expect.any(Function)
    })
})
```

## Troubleshooting Common Issues

### **"document is not defined" Error**
**Cause**: Missing `@vitest-environment jsdom` directive
**Solution**: Add the directive at the top of your test file

### **"jest is not defined" Error**
**Cause**: Using Jest syntax instead of Vitest
**Solution**: Replace `jest.fn()` with `vi.fn()`, `jest.mock()` with `vi.mock()`

### **Material-UI Components Not Rendering**
**Cause**: Missing theme provider
**Solution**: Wrap components in `TestWrapper` with Material-UI theme

## Test File Naming Conventions

### **Component Test Files**
- **Standard**: `index.test.tsx` for components with `index.tsx` files
- **Location**: Same directory as the component being tested

### **Example Structure**
```
ComponentName/
├── index.tsx              # Main component
├── index.test.tsx         # Unit tests
└── AGENT.md               # Documentation
```

## Slate Editor Testing Patterns

### **Slate Component Testing Setup**
```typescript
// Test wrapper with Material-UI theme and Slate editor
const TestWrapper: React.FC<{ children: React.ReactNode, value?: any[] }> = ({ children, value = [] }) => {
    const theme = createTheme()
    const editor = withReact(createEditor())
    
    return (
        <ThemeProvider theme={theme}>
            <Slate editor={editor} value={value}>
                {children}
            </Slate>
        </ThemeProvider>
    )
}
```

**Why**: Slate components need both theme context and editor context to render properly.

### **Mocking Slate Dependencies**
```typescript
// Mock external components used by Slate components
const MockDescriptionLinkFeatureChip = ({ children, tooltipTitle }: { children: React.ReactNode, tooltipTitle: string }) => (
    <span data-testid="description-link-chip" title={tooltipTitle}>
        {children}
    </span>
)

vi.mock('../../../Message/DescriptionLink', () => ({
    DescriptionLinkFeatureChip: MockDescriptionLinkFeatureChip
}))

// Mock utility components
const MockInlineChromiumBugfix = () => <span data-testid="inline-chromium-bugfix" />

vi.mock('../../../../lib/slateUtils', () => ({
    default: MockInlineChromiumBugfix
}))
```

**Key Insights**:
- Mock external dependencies to isolate Slate component testing
- Use `data-testid` attributes for reliable element selection
- Keep mocks simple and focused on testing needs

### **Testing Slate Element Components**
```typescript
describe('Element Component', () => {
    const mockAttributes = { 'data-slate-element': 'true' }
    const mockChildren = <span>Test content</span>

    it('renders feature link with correct tooltip and structure', () => {
        const element: CustomFeatureLinkElement = {
            type: 'featureLink',
            to: 'test-feature',
            children: []
        }

        render(
            <TestWrapper>
                <Element
                    attributes={mockAttributes}
                    children={mockChildren}
                    element={element}
                />
            </TestWrapper>
        )

        const linkChip = screen.getByTestId('description-link-chip')
        expect(linkChip).toHaveAttribute('title', 'Feature: test-feature')
        
        // Check for InlineChromiumBugfix components
        const bugfixes = screen.getAllByTestId('inline-chromium-bugfix')
        expect(bugfixes).toHaveLength(2)
    })
})
```

**Key Patterns**:
- Test different element types with appropriate mock data
- Verify both structure and content rendering
- Check for conditional rendering based on element properties

### **Testing Slate Leaf Components**
```typescript
describe('Leaf Component', () => {
    it('renders leaf with highlight when highlight is true', () => {
        const leaf: CustomText = {
            text: 'test',
            highlight: true
        }

        render(
            <TestWrapper>
                <Leaf
                    attributes={mockAttributes}
                    children={mockChildren}
                    leaf={leaf}
                />
            </TestWrapper>
        )

        // Check for highlight styling
        const highlightBox = document.querySelector('[style*="background-color: rgb(144, 202, 249)"]')
        expect(highlightBox).toBeInTheDocument()
    })
})
```

**Key Patterns**:
- Test conditional rendering based on leaf properties
- Verify styling and visual effects
- Check attribute application

### **Testing Slate Editor Plugins**
```typescript
describe('withParagraphBR Plugin', () => {
    it('applies paragraph BR normalization to editor', () => {
        const editor = withReact(createEditor())
        const originalNormalizeNode = editor.normalizeNode
        
        const enhancedEditor = withParagraphBR(editor)
        
        expect(enhancedEditor.normalizeNode).not.toBe(originalNormalizeNode)
        expect(typeof enhancedEditor.normalizeNode).toBe('function')
    })
})
```

**Key Patterns**:
- Test that plugins modify editor behavior correctly
- Verify plugin functions return enhanced editor
- Test plugin integration without full editor complexity

### **Testing Slate Decorator Functions**
```typescript
describe('decorateFactory Function', () => {
    it('creates decorators for leading spaces in paragraph content', () => {
        const editor = withReact(createEditor())
        const decorate = decorateFactory(editor)
        
        const paragraphNode = {
            type: 'paragraph',
            children: [{ type: 'text', text: ' leading space' }]
        }
        const result = decorate([paragraphNode, [0]])
        
        expect(result).toHaveLength(1)
        expect(result[0]).toHaveProperty('highlight', true)
    })
})
```

**Key Patterns**:
- Test decorator creation with various input types
- Verify decorator properties and structure
- Test edge cases and empty inputs

## Integration with Project Standards

### **Cross-Reference with Project AGENT.md**
- **Client Testing**: Use `npm test -- --run` (this document)
- **Package Testing**: Use `npm run test -- --watchAll=false` (project AGENT.md)

---

**Note**: This is a **PROVISIONAL DRAFT** of evolving testing standards. As we discover better patterns and practices, this document should be updated to reflect our collective learning and establish consistent testing approaches across the client codebase.
