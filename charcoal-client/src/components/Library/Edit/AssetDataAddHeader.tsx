import React, { FunctionComponent, useState, useMemo, useCallback, ReactElement, useEffect, useRef } from 'react'

import {
    Box,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
    Button
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import useDebounce from '../../../hooks/useDebounce';

interface AssetDataAddHeaderProps<T extends Object> {
    renderFields: FunctionComponent<T & { onChange: (props: T) => void }>;
    onAdd: (props: T) => void;
    defaultFields: T;
    validate: (props: T) => Promise<string>;
    validateDelay?: number;
    label: string;
}

//
// TODO: Add a setErrorMessage argument to AssetDataAddHeader, and give it sole responsibility for running the
// validation, then update everywhere that AssetDataAddHeader is used
//
export const AssetDataAddHeader = <T extends Object>({ renderFields, onAdd = () => { }, defaultFields, label, validate, validateDelay = 5 }: AssetDataAddHeaderProps<T>): ReactElement<any, any> | null => {
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    const [validatingKey, setValidatingKey] = useState<boolean>(false)
    const validationLock = useRef<number>(0)
    const [awaitingClickResolve, setAwaitingClickResolve] = useState<boolean>(false)
    const [formState, setFormState] = useState<T>(defaultFields)
    const [errorMessage, setErrorMessageInternal] = useState<string>('')

    const addCurrent = useCallback(() => {
        onAdd(formState)
        setEnteringKey(false)
        setFormState(defaultFields)
        setAwaitingClickResolve(false)
    }, [onAdd, setEnteringKey, formState, setFormState, defaultFields, setAwaitingClickResolve])
    //
    // onClick sets awaitingClick when validatingKey is in progress, and
    // counts on the validation useEffect to call the core onAddWrapper functionality
    // if a click is being awaited when validation succeeds.
    //
    const onClick = useCallback(() => {
        if (validatingKey) {
            setAwaitingClickResolve(true)
        }
        else {
            addCurrent()
        }
    }, [addCurrent, validatingKey, setAwaitingClickResolve])
    //
    // Send async validation events, debounced by the specified delay, and update the
    // error message accordingly.
    //
    const debouncedState = useDebounce(formState, validateDelay)
    useEffect(() => {
        validationLock.current++
        const saveValidationLock = validationLock.current
        setValidatingKey(true)
        validate(debouncedState).then((errorMessage: string) => {
            if (validationLock.current = saveValidationLock) {
                setErrorMessageInternal(errorMessage)
                setValidatingKey(false)
                if (awaitingClickResolve) {
                    addCurrent()
                }
            }
        })
    }, [
        debouncedState,
        validate,
        validationLock,
        setErrorMessageInternal,
        setValidatingKey,
        awaitingClickResolve
    ])
    const onEnter = useCallback(() => {
        if (!enteringKey) {
            setEnteringKey(true)
        }
    }, [enteringKey, setEnteringKey])
    const fieldsRender = renderFields({ ...formState, onChange: setFormState })

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
                        { fieldsRender }

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
