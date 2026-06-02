import React, { FunctionComponent, useMemo, useEffect, useState, useCallback } from 'react'
import { TextField, Box, Typography } from '@mui/material'
import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

// Import theme extensions as side-effect to ensure module augmentation is applied
import '../../../../theme/extensions'

interface TopLevelStandardLiteralEditorProps {
    value: StandardLiteral;
    onChange: (value: StandardLiteral) => void;
    label: string; // e.g., "Short Name"
    placeholder?: string;
    readonly?: boolean;
    size?: 'small' | 'medium';
    /** When false, onChange fires on each keystroke (session flush debounces persist). Default true. */
    debounce?: boolean;
}

/**
 * Top-level StandardLiteral editor with two-cell layout.
 * 
 * This component provides a self-contained presentation for StandardLiteral fields
 * when used as top-level elements in workbench component editors. It features:
 * - Single rounded orange border (not double)
 * - Two-cell layout: label cell (left) and input cell (right)
 * - Label cell: light orange background with field name
 * - Input cell: white background with borderless Material UI TextField
 * 
 * This is distinct from the accordion-style presentation used in WorkbenchTitledBox,
 * which is better suited for nested/grouped fields.
 */
export const TopLevelStandardLiteralEditor: FunctionComponent<TopLevelStandardLiteralEditorProps> = ({
    value,
    onChange,
    label,
    placeholder = '',
    readonly = false,
    size = 'medium',
    debounce = true
}) => {
    const { readonly: assetReadonly } = useWorkbenchAsset()
    const isReadonly = readonly || assetReadonly
    
    // Extract the string value from StandardLiteral
    const stringValue = useMemo(() => {
        return value?._payload?.plain?.toJSON() ?? ''
    }, [value])
    
    const [localValue, setLocalValue] = useState<string>(stringValue)
    
    // Update local value when prop value changes
    useEffect(() => {
        const newValue = value?._payload?.plain?.toJSON() ?? ''
        setLocalValue(newValue)
    }, [value])
    
    useDebouncedOnChange({
        value: localValue,
        delay: 1000,
        onChange: (newValue: string) => {
            if (debounce && newValue !== stringValue) {
                const newLiteral = new StandardLiteral(newValue)
                onChange(newLiteral)
            }
        }
    })

    const propagateChange = useCallback(
        (newValue: string) => {
            if (newValue !== stringValue) {
                onChange(new StandardLiteral(newValue))
            }
        },
        [onChange, stringValue]
    )

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = event.target.value
            setLocalValue(newValue)
            if (!debounce) {
                propagateChange(newValue)
            }
        },
        [debounce, propagateChange]
    )
    
    return (
        <Box
            sx={{
                display: 'flex',
                border: (theme) => `2px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`,
                borderRadius: '0.5em',
                overflow: 'hidden',
                width: '100%'
            }}
        >
            {/* Left cell: Label */}
            <Box
                sx={{
                    backgroundColor: (theme) => (theme.palette as any).extras?.sectionHeaderBackground ?? theme.palette.primary.light,
                    borderRight: (theme) => `1px solid ${(theme.palette as any).extras?.sectionBorder ?? theme.palette.primary.main}`,
                    paddingLeft: '0.75em',
                    paddingRight: '0.75em',
                    paddingTop: size === 'small' ? '0.5em' : '0.75em',
                    paddingBottom: size === 'small' ? '0.5em' : '0.75em',
                    minWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                }}
            >
                <Typography
                    variant={size === 'small' ? 'body2' : 'body1'}
                    sx={{
                        fontWeight: 500,
                        color: 'text.primary'
                    }}
                >
                    {label}
                </Typography>
            </Box>
            
            {/* Right cell: Input */}
            <Box
                sx={{
                    flex: 1,
                    backgroundColor: 'background.paper',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: '0.5em',
                    paddingRight: '0.5em'
                }}
            >
                <TextField
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={isReadonly}
                    fullWidth
                    size={size}
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none'
                        },
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'transparent',
                            padding: 0,
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                            },
                            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                            }
                        },
                        '& .MuiInputBase-input': {
                            padding: size === 'small' ? '0.5em' : '0.75em'
                        }
                    }}
                />
            </Box>
        </Box>
    )
}

export default TopLevelStandardLiteralEditor
