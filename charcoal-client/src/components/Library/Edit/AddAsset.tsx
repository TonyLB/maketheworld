import TextField from "@mui/material/TextField"
import { FunctionComponent, useCallback } from "react"
import AssetDataAddHeader from "./AssetDataAddHeader"

const addAssetGenerator: (validate: (props: { key: string }) => Promise<string>) => FunctionComponent<{ key: string; onChange: (props: { key: string }) => void }> = (validate) => ({ key, onChange }) => {
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

type AddAssetProps = {
    type: 'Asset' | 'Character';
    onAdd: (key: string) => void
}

export const AddAsset: FunctionComponent<AddAssetProps> = ({ type, onAdd = () => { }}) => {
    const onAddWrapper = useCallback(({ key }: { key: string }) => { onAdd(key) }, [onAdd])
    const validate = useCallback(async ({ key }: { key: string }) => {
        if (key.length && (key.search(/^[A-Za-z][\w\_]*$/) === -1)) {
            return `Keys must start with a letter and be made of up letters, digits, and the "_" character`
        }
        if (!key.length) {
            return 'You must specify a key'
        }
        return ''
    }, [])
    return <AssetDataAddHeader
        defaultFields={{ key: '' }}
        label={`Add ${type}`}
        renderFields={addAssetGenerator(validate)}
        validate={validate}
        onAdd={onAddWrapper}
    />
}

export default AddAsset
