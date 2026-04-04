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

# Single run mode (all tests) --- package script: vitest run
npm run test:single

# Test specific file or directory (arguments after --)
npm run test:single -- src/path/to/test.tsx
```

### **Key Differences from Jest**
- **Command**: `npm test` instead of `npm run test`
- **Single run**: Use `npm run test:single` (runs `vitest run`) instead of Jest's `--watchAll=false`
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

### **Mocking useAutoPin Hook**

The `useAutoPin` hook manages navigation tabs and is commonly used across Library components. It should be mocked in component tests since it has Redux selector dependencies that require complex state setup.

**Standard Pattern**:
```typescript
// At the top of your test file, before imports
vi.mock('../../slices/UI/navigationTabs/useAutoPin', () => ({
    default: vi.fn()
}))
```

**Key Insights**:
- Mock at the module level before any imports (Vitest hoists `vi.mock` calls)
- Use `default` export since `useAutoPin` is a default export
- No need to provide return values - the hook has no return value
- Mocking prevents Redux selector errors from `navigationTabs` slice
- **Critical**: The mock path must match the import path in the component being tested

**When to Use This Pattern**:
- Testing any component that imports `useAutoPin`
- Avoiding Redux state setup for navigation tabs slice
- Component tests that don't need to verify tab navigation behavior

**Verifying Mock Works**:
If the mock isn't working, you'll see errors like `Cannot read properties of undefined (reading 'navigationTabs')`. Verify:
1. The mock path exactly matches the component's import path
2. The export name (`default`) matches what the component imports
3. The mock is defined before the component import (though hoisting should handle this)

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

## UserEvent Integration Testing Patterns

**For comprehensive userEvent testing patterns and development roadmap, see [AGENT.testing.userevent.md](./AGENT.testing.userevent.md)**

**⚠️ Critical Discovery**: JSDOM limitations prevent reliable userEvent.type() testing with Slate editors. See [Known Limitations and Future Investigations](#known-limitations-and-future-investigations) for details and the [slate-test-utils investigation backlog](#backlog-investigate-slate-test-utils).

This includes:
- **JSDOM Limitations** - Why userEvent.type() doesn't work with Slate editors
- **Alternative Approaches** - slate-test-utils and direct Slate API testing
- **Limited userEvent Usage** - What operations still work (click, focus, etc.)
- **Hybrid Testing Strategy** - Combining working userEvent + Slate-specific tools
- **Implementation Roadmap** - Revised approach focusing on alternative testing methods

The userEvent testing patterns are substantial enough to warrant their own dedicated documentation file, especially given the current integration test needs in StandardRenderEditor and the JSDOM limitations we've discovered.

## Known Limitations and Future Investigations

### **JSDOM Limitations with Slate Editors**

**Status**: Identified but not resolved - requires investigation of alternative testing approaches

**Problem**: JSDOM (used by React Testing Library and Jest/Vitest) does not fully support `contenteditable` or the `beforeinput` event that Slate heavily utilizes for its internal logic.

**Impact**: 
- Standard `userEvent.type()` calls hang/timeout when testing Slate editors
- Tests cannot reliably simulate realistic user typing interactions
- Integration testing of rich text editor workflows is limited

**Evidence**: 
- Tests in `StandardRenderEditor/index.test.tsx` consistently timeout when attempting userEvent interactions
- This is not an implementation issue but an environment limitation
- Multiple attempts to work around the limitation were unsuccessful

**Current Workaround**: 
- Focus on testing component rendering, props, and state changes
- Avoid userEvent interactions that depend on Slate's contenteditable logic
- Use direct component prop testing and state verification

### **Backlog: Investigate slate-test-utils**

**Priority**: Medium - investigate when time permits, not blocking current development

**Goal**: Evaluate whether `slate-test-utils` can provide better testing support for Slate editors than userEvent in JSDOM

**Research Questions**:
1. Does `slate-test-utils` work with our Vitest setup?
2. Can it simulate user interactions more reliably than userEvent?
3. Does it provide utilities for testing Slate-specific features (links, formatting)?
4. How does it integrate with React Testing Library?

**Expected Outcome**: Either adoption of slate-test-utils for Slate testing, or confirmation that we need to develop alternative testing strategies

**Dependencies**: None - can be investigated independently

**Estimated Effort**: 2-4 hours for initial investigation and proof-of-concept

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

### **UserEvent Import Issues**
**Cause**: Import path or configuration problems
**Solution**: Verify package installation and import syntax

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

## Slate Editor Testing

**For comprehensive Slate editor testing patterns, see [AGENT.testing.slate.md](./AGENT.testing.slate.md)**

This includes:
- **Slate Component Testing Setup** - Test wrappers, Material-UI integration
- **Element Component Testing** - Feature links, knowledge links, paragraphs
- **Leaf Component Testing** - Highlight boxes, attributes, conditional rendering
- **Editor Plugin Testing** - withConstrainedWhitespace, withInlines, etc.
- **Common Pitfalls & Solutions** - Troubleshooting guide

The Slate testing patterns are substantial enough to warrant their own dedicated documentation file.

## Integration with Project Standards

### **Cross-Reference with Project AGENT.md**
- **Client Testing**: Use `npm run test:single` for a single full run (this document)
- **Package Testing**: Use `npm run test -- --watchAll=false` (project AGENT.md)

---

**Note**: This is a **PROVISIONAL DRAFT** of evolving testing standards. As we discover better patterns and practices, this document should be updated to reflect our collective learning and establish consistent testing approaches across the client codebase.

**Next Priority**: Develop comprehensive userEvent testing patterns to support the StandardRenderEditor integration tests and establish consistent user interaction testing across the client codebase.
