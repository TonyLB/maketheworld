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
import { deepEqual } from '../../../lib/objects';

interface AssetDataAddHeaderProps<T extends Object> {
    renderFields: FunctionComponent<T & { onChange: (props: T) => void; errorMessage: string; }>;
    onAdd: (props: T) => void;
    onEnter?: () => void;
    defaultFields: T;
    validate: (props: T) => Promise<string>;
    validateDelay?: number;
    label: string;
}

//
// TODO: Add a setErrorMessage argument to AssetDataAddHeader, and give it sole responsibility for running the
// validation, then update everywhere that AssetDataAddHeader is used
//
export const AssetDataAddHeader = <T extends Object>({ renderFields, onAdd = () => { }, onEnter = () => {}, defaultFields, label, validate, validateDelay = 5 }: AssetDataAddHeaderProps<T>): ReactElement<any, any> | null => {
    const [enteringKey, setEnteringKey] = useState<boolean>(false)
    const [isValidating, setIsValidating] = useState<boolean>(false)
    const [validatingKey, setValidatingKey] = useState<T>(defaultFields)
    const validationLock = useRef<number>(0)
    const [awaitingClickResolve, setAwaitingClickResolve] = useState<boolean>(false)
    const [formState, setFormState] = useState<T>(defaultFields)
    const [errorMessage, setErrorMessageInternal] = useState<string>('')

    const addCurrent = useCallback(() => {
        onAdd(formState)
        setEnteringKey(false)
        setFormState(defaultFields)
        setValidatingKey(defaultFields)
        setAwaitingClickResolve(false)
    }, [onAdd, setEnteringKey, formState, setFormState, setValidatingKey, defaultFields, setAwaitingClickResolve])
    //
    // onClick sets awaitingClick when validatingKey is in progress, and
    // counts on the validation useEffect to call the core onAddWrapper functionality
    // if a click is being awaited when validation succeeds.
    //
    const onClick = useCallback(() => {
        if (isValidating) {
            setAwaitingClickResolve(true)
        }
        else {
            if (!errorMessage) {
                addCurrent()
            }
        }
    }, [addCurrent, isValidating, setAwaitingClickResolve, errorMessage])
    //
    // Send async validation events, debounced by the specified delay, and update the
    // error message accordingly.
    //
    const debouncedState = useDebounce(formState, validateDelay)
    useEffect(() => {
        if (!deepEqual(validatingKey || defaultFields, debouncedState)) {
            validationLock.current++
            const saveValidationLock = validationLock.current
            setValidatingKey(debouncedState)
            setIsValidating(true)
            validate(debouncedState).then((errorMessage: string) => {
                if (validationLock.current = saveValidationLock) {
                    setErrorMessageInternal(errorMessage)
                    setIsValidating(false)
                    if (awaitingClickResolve && !errorMessage) {
                        addCurrent()
                    }
                }
            })
        }
    }, [
        debouncedState,
        validate,
        isValidating,
        setIsValidating,
        validatingKey,
        setValidatingKey,
        validationLock,
        setErrorMessageInternal,
        awaitingClickResolve
    ])
    const onEnterClick = useCallback(() => {
        if (!enteringKey) {
            onEnter()
            setEnteringKey(true)
        }
    }, [enteringKey, setEnteringKey, onEnter])
    const fieldsRender = renderFields({ ...formState, onChange: setFormState, errorMessage })

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
        : <ListItemButton onClick={onEnterClick}>
            { contents }
        </ListItemButton>
}

export default AssetDataAddHeader
