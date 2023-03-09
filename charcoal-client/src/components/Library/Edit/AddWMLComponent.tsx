import React, { FunctionComponent, useCallback } from 'react'

import {
    TextField
} from '@mui/material'

import { useLibraryAsset } from './LibraryAsset'
import AssetDataAddHeader from './AssetDataAddHeader'

interface AddWMLComponentProps {
    type: 'Room' | 'Feature' | 'Image';
    onAdd?: (key: string) => void;
}

const addWMLRenderFieldsGenerator: (validate: (props: { key: string }) => string) => FunctionComponent<{ key: string; onChange: (props: { key: string }) => void }> = (validate) => ({ key, onChange }) => {
    const errorMessage = validate({ key })
    return <TextField
        required
        id="component-key"
        label="Key"
        size="small"
        value={key}
        onChange={(event) => {
            onChange({ key: event.target.value })
        }}
        error={Boolean(errorMessage)}
    />
}

export const AddWMLComponent: FunctionComponent<AddWMLComponentProps> = ({ type, onAdd = () => { }}) => {
    const onAddWrapper = useCallback(({ key }: { key: string }) => { onAdd(key) }, [onAdd])
    const { normalForm } = useLibraryAsset()
    const validate = useCallback(({ key }: { key: string }) => {
        if (key in normalForm) {
            return `"${key}" is already used in this asset`
        }
        if (key.length && (key.search(/^[A-Za-z][\w\_]*$/) === -1)) {
            return `Keys must start with a letter and be made of up letters, digits, and the "_" character`
        }
        if (!key.length) {
            return 'You must specify a key'
        }
        return ''
    }, [normalForm])
    const asynchronousValidate = useCallback(async ({ key }: { key: string }) => {
        return await validate({key})
    }, [validate])
    return <AssetDataAddHeader
        defaultFields={{ key: '' }}
        label={`Add ${type}`}
        renderFields={addWMLRenderFieldsGenerator(validate)}
        validate={asynchronousValidate}
        onAdd={onAddWrapper}
    />
}

export default AddWMLComponent
