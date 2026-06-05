import React, { FunctionComponent, useMemo, useEffect, useState, useCallback } from 'react'
import { TextField } from '@mui/material'
import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import { useWorkbenchAsset } from '../useWorkbenchAsset'
import { literalPlainString } from '../workbenchMutations'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

// Import theme extensions so palette.extras is available when inside workbench theme
import '../../../../theme/extensions'

interface StandardLiteralEditorProps {
    value: StandardLiteral;
    onChange: (value: StandardLiteral) => void;
    label?: string;
    placeholder?: string;
    readonly?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'medium';
    variant?: 'outlined' | 'filled' | 'standard';
    /** When false, onChange fires on each keystroke (session flush debounces persist). Default true. */
    debounce?: boolean;
}

export const StandardLiteralEditor: FunctionComponent<StandardLiteralEditorProps> = ({
    value,
    onChange,
    label,
    placeholder = '',
    readonly = false,
    fullWidth = true,
    size = 'medium',
    variant = 'outlined',
    debounce = true
}) => {
    const { readonly: assetReadonly } = useWorkbenchAsset()
    const isReadonly = readonly || assetReadonly
    
    const stringValue = useMemo(() => literalPlainString(value), [value])

    const [localValue, setLocalValue] = useState<string>(stringValue)

    useEffect(() => {
        setLocalValue(stringValue)
    }, [stringValue])

    useDebouncedOnChange({
        value: localValue,
        delay: 1000,
        enabled: debounce,
        onChange: (newValue: string) => {
            if (newValue !== stringValue) {
                onChange(new StandardLiteral(newValue))
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
        <TextField
            value={localValue}
            onChange={handleChange}
            label={label}
            placeholder={placeholder}
            disabled={isReadonly}
            fullWidth={fullWidth}
            size={size}
            variant={variant}
            hiddenLabel={size === 'small' && !label}
            sx={
                variant === 'outlined'
                    ? {
                          '& .MuiOutlinedInput-root': {
                              backgroundColor: 'background.paper'
                          }
                      }
                    : variant === 'filled'
                      ? {
                          '& .MuiFilledInput-root': {
                              backgroundColor: (theme) =>
                                  (theme.palette as unknown as { extras?: { sectionBackground?: string } }).extras?.sectionBackground ?? '#fffbf5'
                          }
                      }
                    : undefined
            }
        />
    )
}

export default StandardLiteralEditor
