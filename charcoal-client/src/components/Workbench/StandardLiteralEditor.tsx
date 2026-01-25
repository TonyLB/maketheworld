import React, { FunctionComponent, useMemo, useEffect, useState, useCallback } from 'react'
import { TextField } from '@mui/material'
import { useDebouncedOnChange } from '../../hooks/useDebounce'
import { useWorkbenchAsset } from './useWorkbenchAsset'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

interface StandardLiteralEditorProps {
    value: StandardLiteral;
    onChange: (value: StandardLiteral) => void;
    placeholder?: string;
    readonly?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'medium';
}

export const WorkbenchStandardLiteralEditor: FunctionComponent<StandardLiteralEditorProps> = ({
    value,
    onChange,
    placeholder = '',
    readonly = false,
    fullWidth = true,
    size = 'medium'
}) => {
    const { readonly: assetReadonly } = useWorkbenchAsset()
    const isReadonly = readonly || assetReadonly
    
    const stringValue = useMemo(() => {
        return value?._payload?.plain?.toJSON() ?? ''
    }, [value])
    
    const [localValue, setLocalValue] = useState<string>(stringValue)
    
    useEffect(() => {
        const newValue = value?._payload?.plain?.toJSON() ?? ''
        setLocalValue(newValue)
    }, [value])
    
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

export default WorkbenchStandardLiteralEditor
