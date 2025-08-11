# StandardLiteralEditor

## Overview

**Purpose**: A React component for editing `StandardLiteral` values using a Material-UI TextField, designed to replace `DescriptionEditor` in contexts where simple string editing is needed instead of rich text editing.

**Context**: This component is part of the Library Edit system, specifically designed to handle plain text editing for component properties like ShortName, replacing the complex conditional logic system that was being deprecated.

**Key Concepts**: 
- `StandardLiteral`: The data type representing plain string values in the WML system
- Debounced updates: Prevents excessive API calls during user typing
- Asset-level readonly states: Integrates with the broader library asset system

## Core Purpose

**Primary Function**: Provide a clean, focused interface for editing `StandardLiteral` data types without the complexity of rich text editing or conditional logic.

**Key Responsibilities**:
- Render a Material-UI TextField for string input
- Handle user input with immediate local state updates
- Debounce external changes to prevent excessive updates
- Respect readonly states from both component and asset levels
- Maintain type safety with TypeScript

## Technical Details

**Data Structures**:
- `StandardLiteralEditorProps`: Component interface with value, onChange, and styling options
- `StandardLiteral`: The core data type being edited
- Local state management for immediate UI responsiveness

**Core Methods**:
- `handleChange`: Processes user input events
- `useEffect`: Synchronizes local state with prop changes
- `useDebouncedOnChange`: Implements debounced update logic

**Configuration**:
- Debounce delay: 1000ms (configurable via hook)
- Default size: 'medium'
- Default fullWidth: true
- Default readonly: false

## Integration Points

**Dependencies**:
- `@mui/material/TextField`: Core input component
- `useDebouncedOnChange`: Custom hook for debounced updates
- `useLibraryAsset`: Hook for asset-level readonly state
- `StandardLiteral`: Data type from `@tonylb/mtw-wml`

**Cross-References**:
- See project documentation for the DescriptionEditor component that was replaced (component has been removed)
- See [`../LibraryAsset/AGENT.md`](../LibraryAsset/AGENT.md) for asset-level state management
- See [`../../../../hooks/useDebounce/AGENT.md`](../../../../hooks/useDebounce/AGENT.md) for debouncing logic

**API Contracts**:
- `onChange: (value: StandardLiteral) => void`: Callback for value updates
- `value: StandardLiteral`: Current value to display and edit
- Props for styling and behavior customization

**System Relationships**: 
- Part of the Library Edit system for component property editing
- Integrates with the asset management system for readonly states
- Replaces complex schema-based editing with direct component editing

## Usage Patterns

**Common Scenarios**:
```tsx
// Basic usage for ShortName editing
<StandardLiteralEditor
    value={component.shortName}
    onChange={(newShortName) => updateComponent(newShortName)}
    placeholder="Enter short name..."
    size="small"
/>

// Readonly display
<StandardLiteralEditor
    value={displayValue}
    onChange={handleChange}
    readonly={true}
/>
```

**Best Practices**:
- Use `size="small"` for inline editing contexts
- Provide meaningful placeholder text for user guidance
- Handle the `onChange` callback to persist changes
- Respect readonly states for display-only scenarios

**Error Handling**:
- Gracefully handles undefined values by defaulting to empty string
- Maintains controlled input state to prevent React warnings
- Validates input through TypeScript type checking

## Navigation Tips

**Getting Started**: Begin with the main component file `index.tsx` to understand the core implementation, then examine the test file for usage examples.

**Key Files**:
- `index.tsx`: Main component implementation
- `index.test.tsx`: Comprehensive test coverage and usage examples
- `AGENT.md`: This documentation file

**Related Documentation**:
- See [`../WMLComponentDetail/AGENT.md`](../WMLComponentDetail/AGENT.md) for usage in component editing
- See [`../../../../hooks/useDebounce/AGENT.md`](../../../../hooks/useDebounce/AGENT.md) for debouncing implementation details

## Development Notes

**Current State**: Fully functional with comprehensive test coverage. All tests are passing and the component has been successfully integrated into `WMLComponentDetail.tsx` for ShortName editing.

**Future Plans**: 
- Consider adding validation hooks for input constraints
- Explore integration with form validation systems
- Potential for additional input types beyond plain text

**Technical Debt**: 
- Minor React warning about controlled/uncontrolled inputs in edge cases
- Could benefit from more granular error boundary handling

## Testing

**Test Coverage**: Comprehensive unit tests covering all major functionality:
- Rendering with various prop combinations
- User interactions and state management
- Readonly behavior and asset integration
- Edge cases and error handling
- Accessibility features

**Running Tests**:
```bash
npm test -- --run src/components/Library/Edit/StandardLiteralEditor/index.test.tsx
```

**Test Environment**: Uses Vitest with jsdom for DOM testing and Material-UI theme providers for proper component rendering.
