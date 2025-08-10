import React, { FunctionComponent, useMemo, useEffect, useState, useCallback } from 'react'
import { TextField } from '@mui/material'
import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import { useLibraryAsset } from '../LibraryAsset'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

interface StandardLiteralEditorProps {
    value: StandardLiteral;
    onChange: (value: StandardLiteral) => void;
    placeholder?: string;
    readonly?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'medium';
}

export const StandardLiteralEditor: FunctionComponent<StandardLiteralEditorProps> = ({
    value,
    onChange,
    placeholder = '',
    readonly = false,
    fullWidth = true,
    size = 'medium'
}) => {
    const { readonly: assetReadonly } = useLibraryAsset()
    const isReadonly = readonly || assetReadonly
    
    // Extract the string value from StandardLiteral
    const stringValue = useMemo(() => {
        return value?._payload?.plain?.toJSON() ?? ''
    }, [value])
    
    const [localValue, setLocalValue] = useState<string>(stringValue)
    
    // Update local value when prop value changes
    useEffect(() => {
        if (localValue !== value?._payload?.plain?.toJSON()) {
            setLocalValue(value?._payload?.plain?.toJSON())
        }
    }, [value])
    
    // Debounced onChange to avoid excessive updates
    useDebouncedOnChange({
        value: localValue,
        delay: 1000,
        onChange: (newValue: string) => {
            if (newValue !== stringValue) {
                const newLiteral = new StandardLiteral(newValue)
                onChange(newLiteral)
            }
        }
    })
    
    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(event.target.value)
    }, [])
    
    return (
        <TextField
            value={localValue}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={isReadonly}
            fullWidth={fullWidth}
            size={size}
            variant="outlined"
            sx={{
                '& .MuiOutlinedInput-root': {
                    backgroundColor: 'background.paper'
                }
            }}
        />
    )
}

export default StandardLiteralEditor
