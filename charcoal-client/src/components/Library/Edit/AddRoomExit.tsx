import React, { FunctionComponent, useMemo, useCallback } from 'react'

import {
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material'

import { useLibraryAsset } from './LibraryAsset'
import AssetDataAddHeader from './AssetDataAddHeader'

interface AddRoomExitProps {
    RoomId: string;
    onAdd?: (props: { toTarget: boolean; targetId: string }) => void;
}

type ExitSelectOptionMapping = {
    value: string;
    name: string;
}

type ExitSelectOptions = {
    to: ExitSelectOptionMapping[];
    from: ExitSelectOptionMapping[];
}

type AddExitFields = {
    toTarget: boolean;
    targetId: string;
}

type AddExitFieldsProps = AddExitFields & {
    onChange: (props: AddExitFields) => void;
}

const addExitFieldsGenerator = (exitOptions: ExitSelectOptions): FunctionComponent<AddExitFieldsProps> => ({ toTarget, targetId, onChange}) => {
    const onToTargetChange = useCallback((event) => {
        onChange({
            toTarget: Boolean(event.target.value === 'true'),
            targetId
        })
    }, [onChange, targetId])
    const onTargetChange = useCallback((event) => {
        onChange({
            targetId: event.target.value,
            toTarget
        })
    }, [onChange, toTarget])
    return <React.Fragment>
        <FormControl sx={{ m: 1, minWidth: 120, alignContent: 'center', justifyContent: 'center' }} size="small">
            <InputLabel id="to-from-exit-target">To/From</InputLabel>
            <Select
                labelId="to-from-exit-target"
                id="to-from-exit-target"
                value={toTarget ? 'true' : 'false'}
                label="To/From"
                onChange={onToTargetChange}
            >
                <MenuItem value='true'>To</MenuItem>
                <MenuItem value='false'>From</MenuItem>
            </Select>
        </FormControl>
        <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
            <InputLabel id="exit-target">Other Room</InputLabel>
            <Select
                labelId="exit-target"
                id="exit-target"
                value={targetId}
                label="Other Room"
                onChange={onTargetChange}
            >
                <MenuItem value=''>None</MenuItem>
                {
                    (toTarget ? exitOptions.to : exitOptions.from)
                        .map(({ value, name }) => (
                            <MenuItem key={value} value={value}>{ name }</MenuItem>
                        ))
                }
            </Select>
        </FormControl>
    </React.Fragment>
}

export const AddRoomExit: FunctionComponent<AddRoomExitProps> = ({ RoomId, onAdd = () => { }}) => {
    const { rooms, exits } = useLibraryAsset()
    const validate = useCallback((props: AddExitFields): string => {
        const { targetId } = props
        if (!targetId) {
            return `Specify a room for the exit to lead to`
        }
        return ''
    }, [])
    const exitOptions = useMemo<ExitSelectOptions>(() => {
        const allPossibleOptions = Object.entries(rooms)
            .filter(([key]) => (key !== RoomId))
            .map(([key, { name }]) => ({
                value: key,
                name: name.map((item) => ((item.tag === 'String') ? item.value : '')).join('')
            }))
        return {
            to: allPossibleOptions.filter(({ value: targetId }) => (!Object.values(exits).find(({ from, to }) => (from === RoomId && to === targetId)))),
            from: allPossibleOptions.filter(({ value: targetId }) => (!Object.values(exits).find(({ from, to }) => (to === RoomId && from === targetId))))
        }
    }, [rooms, exits])
    const renderFields = useMemo<FunctionComponent<AddExitFieldsProps>>(() => (
        addExitFieldsGenerator(exitOptions)
    ), [exitOptions])
    return <AssetDataAddHeader
        defaultFields={{ toTarget: true, targetId: '' }}
        renderFields={renderFields}
        validate={validate}
        label="Add Exit"
        onAdd={onAdd}
    />

}

export default AddRoomExit
