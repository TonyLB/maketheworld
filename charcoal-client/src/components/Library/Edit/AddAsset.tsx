import TextField from "@mui/material/TextField"
import { FunctionComponent, useCallback } from "react"
import { useDispatch } from "react-redux";
import { socketDispatchPromise } from "../../../slices/lifeLine";
import AssetDataAddHeader from "./AssetDataAddHeader"

const addAssetGenerator: FunctionComponent<{ key: string; onChange: (props: { key: string }) => void; errorMessage: string }> = ({ key, onChange, errorMessage }) => {
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
    const dispatch = useDispatch()
    const onAddWrapper = useCallback(({ key }: { key: string }) => { onAdd(key) }, [onAdd])
    const validate = useCallback(async ({ key }: { key: string }) => {
        if (key.length && (key.search(/^[A-Za-z][\w\_]*$/) === -1)) {
            return `Keys must start with a letter and be made of up letters, digits, and the "_" character`
        }
        if (!key.length) {
            return 'You must specify a key'
        }
        const { zone } = await dispatch(socketDispatchPromise({ message: 'metaData', assetId: `ASSET#${key}` }, { service: 'asset' })) as any
        if (zone && zone !== 'None') {
            return `Key '${key}' is already in use`
        }
        return ''
    }, [dispatch])
    return <AssetDataAddHeader
        defaultFields={{ key: '' }}
        label={`Add ${type}`}
        renderFields={addAssetGenerator}
        validate={validate}
        validateDelay={1000}
        onAdd={onAddWrapper}
    />
}

export default AddAsset
