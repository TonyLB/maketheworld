import React, { FunctionComponent, useState, useMemo, useCallback, ReactElement } from 'react'

import {
    Box,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Button
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface AssetDataAddHeaderProps<T extends Object> {
    renderFields: FunctionComponent<T & { onChange: (props: T) => void }>;
    onAdd: (props: T) => void;
    defaultFields: T;
    validate: (props: T) => string;
    label: string;
}

export const AssetDataAddHeader = <T extends Object>({ renderFields, onAdd = () => { }, defaultFields, label, validate }: AssetDataAddHeaderProps<T>): ReactElement<any, any> | null => {
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    const [formState, setFormState] = useState<T>(defaultFields)
    const errorMessage = useMemo(() => (validate(formState)), [validate, formState])
    const onClick = useCallback(() => {
        onAdd(formState)
        setEnteringKey(false)
        setFormState(defaultFields)
    }, [onAdd, setEnteringKey, formState, setFormState, defaultFields])
    const onEnter = useCallback(() => {
        if (!enteringKey) {
            setEnteringKey(true)
        }
    }, [enteringKey, setEnteringKey])

    const contents = <React.Fragment>
        <ListItemIcon>
            <AddIcon />
        </ListItemIcon>
        {
            (enteringKey === false) && <ListItemText primary={label} />
        }
        {
            (enteringKey === true) &&
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Box>
                        { renderFields({ ...formState, onChange: setFormState })}

                        <Button sx={{ marginTop: '0.65em', marginRight: '0.25em' }} disabled={Boolean(errorMessage)} variant="contained" onClick={onClick}>Add</Button>
                        <Button sx={{ marginTop: '0.65em' }} variant="outlined" onClick={() => { setEnteringKey(false) }}>Cancel</Button>
                    </Box>
                    { errorMessage && <Box sx={{ color: 'red' }}>{ errorMessage }</Box> }
                </Box>
        }
    </React.Fragment>

    return enteringKey
        ? <ListItem>
            { contents }
        </ListItem>
        : <ListItemButton onClick={onEnter}>
            { contents }
        </ListItemButton>
}

export default AssetDataAddHeader
