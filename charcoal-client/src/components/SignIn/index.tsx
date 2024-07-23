import React, { useCallback, useMemo, useState } from "react"

import { styled } from "@mui/material/styles"
import Tabs from "@mui/material/Tabs"
import Tab, { tabClasses } from "@mui/material/Tab"
import Box from "@mui/material/Box"
import { blue, green, red } from '@mui/material/colors'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { Button, Checkbox, FormControl, FormControlLabel, FormGroup, FormHelperText, Stack, TextField } from "@mui/material"
import CodeOfConductConsentDialog from "../CodeOfConductConsent"
import { anonymousAPIPromise, isAnonymousAPIResultSignInFailure, isAnonymousAPIResultSignInSuccess } from "../../anonymousAPI"
import { useDispatch, useSelector } from "react-redux"
import { getConfiguration, receiveRefreshToken } from "../../slices/configuration"
import ScreenCenter from "../ScreenCenter"
import { heartbeat } from "../../slices/stateSeekingMachine/ssmHeartbeat"
import { push } from "../../slices/UI/feedback"

const TabItem = styled(Tab)(({
    theme
}) => ({
    opacity: 1,
    overflow: "initial",
    zIndex: 2,
    textTransform: "initial",
    color: "black",
    backgroundColor: "white",
    transition: "0.2s",
    [theme.breakpoints.up("sm")]: {
        minWidth: 120
    },
    "&:before": {
        transition: "0.2s"
    },
    "&:not(:first-of-type)": {
        "&:before": {
        content: '" "',
        position: "absolute",
        left: 0,
        display: "block",
        height: 20,
        width: 1,
        zIndex: 1,
        backgroundColor: blue[300]
        }
    },
    [`& + .${tabClasses.selected}::before`]: {
        opacity: 0
    },
    "&:hover": {
        [`&:not(.${tabClasses.selected})`]: {
        backgroundColor: "rgba(0 0 0 / 0.1)"
        },
        "&::before": {
        opacity: 0
        },
        [`& + .${tabClasses.root}::before`]: {
        opacity: 0
        }
    },
    [`&.${tabClasses.selected}`]: {
        backgroundColor: blue[500],
        color: "white"
    },
    [`&.${tabClasses.selected} + .${tabClasses.root}`]: {
        zIndex: 1
    },
    [`&.${tabClasses.selected} + .${tabClasses.root}::before`]: {
        opacity: 0
    }
}));

const SignIn = ({ value }: { value: number }) => {
    const [userName, setUserName] = useState('')
    const [password, setPassword] = useState('')
    const [isValidating, setIsValidating] = useState(false)
    const [error, setError] = useState('')
    const { AnonymousAPIURI } = useSelector(getConfiguration)
    const dispatch = useDispatch()
    const signIn = useCallback(() => {
        if (!isValidating) {
            setIsValidating(true)
            anonymousAPIPromise({ path: 'signIn', userName, password }, AnonymousAPIURI)
                .then((results) => {
                    if (isAnonymousAPIResultSignInSuccess(results)) {
                        window.localStorage.setItem('RefreshToken', results.RefreshToken)
                        dispatch(receiveRefreshToken(results.RefreshToken))
                        dispatch(heartbeat)
                    }
                    if (isAnonymousAPIResultSignInFailure(results)) {
                        setError(results.errorMessage)
                        setIsValidating(false)
                    }
                })
        }
    }, [userName, password, isValidating, setIsValidating, setError, dispatch])
    return <Box
        hidden={value !== 0}
        sx={{
            borderColor: blue[500],
            borderStyle: "solid",
            height: "calc(100% - 3em)",
            textAlign: "center",
            padding: "1em"
        }}
    >
        <Stack
            sx={{
                minWidth: "19em",
                width: "90%",
                marginRight: "auto",
                marginLeft: "auto"
            }}
            spacing={1}
        >
            <TextField
                value={userName}
                onChange={(event) => {
                    setError('')
                    setUserName(event.target.value)
                }}
                placeholder="Enter user name"
                error={Boolean(error)}
            />
            <TextField
                value={password}
                onChange={(event) => {
                    setError('')
                    setPassword(event.target.value)
                }}
                placeholder="Enter password"
                type="password"
                error={Boolean(error)}
                helperText={error}
            />
            <Button
                variant="contained"
                disabled={isValidating || Boolean(error) || !(userName && password)}
                onClick={signIn}
            >
                Sign In
            </Button>
        </Stack>
    </Box>
}

type SignUpErrors = {
    inviteCode: string;
    userName: string;
    password: string;
    acknowledge: string;
}

type SignUpData = {
    inviteCode: string;
    userName: string;
    password: string;
    confirmPassword: string;
    acknowledge: boolean;
}

const SignUp = ({ value }: { value: number }) => {
    const { AnonymousAPIURI } = useSelector(getConfiguration)
    const dispatch = useDispatch()
    const [showingDialog, setShowingDialog] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [userName, setUserName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [acknowledge, setAcknowledge] = useState(false)
    const [errors, setErrors] = useState<Partial<SignUpErrors>>({})
    const [validatingInvitation, setValidatingInvitation] = useState(false)
    const [invitationValid, setInvitationValid] = useState<Boolean | undefined>(undefined)
    const [creatingUser, setCreatingUser] = useState(false)
    const validate = useCallback(async (field: keyof SignUpErrors | 'ALL', data: SignUpData) => {
        let returnErrors: Partial<SignUpErrors> = field === 'ALL' ? {} : { ...errors }
        if (field != 'ALL') {
            delete returnErrors[field]
        }
        if (['ALL', 'inviteCode'].includes(field)) {
            if (!data.inviteCode.match(/\d[A-Z][A-Z]\d\d[A-Z]/)) {
                returnErrors.inviteCode = 'Invite code must be a six character string (e.g. "1AB23C")'
                setInvitationValid(undefined)
            }
            else if (!validatingInvitation) {
                if (AnonymousAPIURI) {
                    setValidatingInvitation(false)
                    setInvitationValid(undefined)
                    anonymousAPIPromise({
                        path: 'validateInvitation',
                        inviteCode: data.inviteCode
                    }, AnonymousAPIURI).then((result) => {
                        setInvitationValid(result)
                        setValidatingInvitation(false)
                    })
                }
            }

        }
        if (['ALL', 'userName'].includes(field) && (!data.userName || data.userName.length < 5)) {
            returnErrors.userName = 'User name must be at least five characters in length'
        }
        if (['ALL', 'password', 'confirmPassword'].includes(field) && !(data.password && data.confirmPassword)) {
            returnErrors.password = 'You must enter and confirm your password'
        }
        else if (['ALL', 'password', 'confirmPassword'].includes(field) && data.password !== data.confirmPassword) {
            returnErrors.password = 'Password and confirm password do not match'
        }
        if (['ALL', 'acknowledge'].includes(field) && !data.acknowledge) {
            returnErrors.acknowledge = 'You must acknowledge and agree to the code of conduct'
        }
        setErrors(returnErrors)
        return returnErrors
    }, [errors])
    const data = useMemo<SignUpData>(() => ({
        inviteCode,
        userName,
        password,
        confirmPassword,
        acknowledge
    }), [inviteCode, userName, password, confirmPassword, acknowledge])
    return <React.Fragment>
        <CodeOfConductConsentDialog
            open={showingDialog}
            onClose={ () => { setShowingDialog(false) } }
        />
        <Box
            hidden={value !== 1}
            sx={{
                borderColor: blue[500],
                borderStyle: "solid",
                height: "calc(100% - 3em)",
                padding: "1em"
            }}
        >
            <Stack
                sx={{
                    minWidth: "19em",
                    width: "90%",
                    marginRight: "auto",
                    marginLeft: "auto"
                }}
                spacing={1}
            >
                <TextField
                    value={inviteCode}
                    onChange={(event) => {
                        setInviteCode(event.target.value)
                        validate('inviteCode', { ...data, inviteCode: event.target.value })
                    }}
                    InputProps={{ readOnly: validatingInvitation }}
                    label="Invite Code"
                    name="Invite Code"
                    placeholder="Enter invite code"
                    error={Boolean(errors.inviteCode)}
                    helperText={
                        validatingInvitation
                            ? 'Validating invite code'
                            : typeof invitationValid === 'undefined'
                                ? errors.inviteCode
                                : invitationValid
                                    ? <React.Fragment><CheckCircleIcon fontSize="small" sx={{ color: green[300] }} />Invitation code is valid</React.Fragment>
                                    : <React.Fragment><CancelIcon fontSize="small" sx={{ color: red[300] }} />Invite code is not valid, or has been used already</React.Fragment>
                    }
                />
                <br />
                <TextField
                    value={userName}
                    onChange={(event) => {
                        setUserName(event.target.value)
                        validate('userName', { ...data, userName: event.target.value })
                    }}
                    label="User Name"
                    name="User Name"
                    placeholder="Enter user name"
                    error={Boolean(errors.userName)}
                    helperText={errors.userName}
                />
                <TextField
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value)
                        validate('password', { ...data, password: event.target.value })
                    }}
                    label="Password"
                    name="Password"
                    placeholder="Enter password"
                    type="password"
                    error={Boolean(errors.password)}
                />
                <TextField
                    value={confirmPassword}
                    onChange={(event) => {
                        setConfirmPassword(event.target.value)
                        validate('password', { ...data, confirmPassword: event.target.value })
                    }}
                    label="Confirm password"
                    name="Confirm password"
                    placeholder="Confirm password"
                    type="password"
                    error={Boolean(errors.password)}
                    helperText={errors.password}
                />

                <FormControl
                    error={Boolean(errors.acknowledge)}
                    component="fieldset"
                    sx={{ m: 3 }}
                    variant="standard"
                >
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="acknowledgement"
                                    value="yes"
                                    checked={acknowledge}
                                    onChange={(event) => {
                                        setAcknowledge(event.target.checked)
                                        validate('acknowledge', { ...data, acknowledge: event.target.checked })
                                    }}
                                />
                            }
                            label={
                                <React.Fragment>
                                    I agree to abide by the&nbsp;
                                    <Box
                                        component='span'
                                        sx={{
                                        backgroundColor: blue[50]
                                        }}
                                        onClick={(event: any) => {
                                            event.preventDefault()
                                            setShowingDialog(true)
                                        }}
                                    >
                                        Code of Conduct
                                    </Box>
                                </React.Fragment>
                            }
                        />
                    </FormGroup>
                    { errors.acknowledge ? <FormHelperText>{ errors.acknowledge }</FormHelperText> : null }
                </FormControl>
            <Button
                variant="contained"
                onClick={() => {
                    validate('ALL', data).then(async (errors) => {
                        if (!(Object.values(errors).filter((value) => (value)).length)) {
                            setCreatingUser(true)
                            const results = await anonymousAPIPromise({
                                path: 'signUp',
                                inviteCode,
                                userName,
                                password
                            }, AnonymousAPIURI)
                            if (isAnonymousAPIResultSignInSuccess(results)) {
                                window.localStorage.setItem('RefreshToken', results.RefreshToken)
                                dispatch(receiveRefreshToken(results.RefreshToken))
                                dispatch(heartbeat)
                            }
                            if (isAnonymousAPIResultSignInFailure(results)) {
                                if (results.errorField) {
                                    if (results.errorField === 'system') {
                                        dispatch(push(results.errorMessage))
                                    }
                                    else {
                                        setErrors({ ...errors, [results.errorField]: results.errorMessage })
                                    }
                                }
                                setCreatingUser(false)
                            }
                        }
                    })
                }}
                disabled={creatingUser || (invitationValid === false) || validatingInvitation || (Object.values(errors).filter((value) => (value)).length > 0)}
            >
                Sign Up
            </Button>
            </Stack>
        </Box>
    </React.Fragment>
}

const a11yProps = (index: number) => ({
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
})

export const SignInOrUp = () => {
    const [value, setValue] = useState(0)
    return <ScreenCenter>
        <Box sx={{
            minWidth: '20em',
            width: '40em',
            maxWidth: "90%",
            minHeight: "30em"
        }}>
            <Tabs
                variant="fullWidth"
                value={value}
                onChange={(event, newValue) => { setValue(newValue) }}
            >
                <TabItem label="Sign In" {...a11yProps(0)} />
                <TabItem label="New User" {...a11yProps(1)} />
            </Tabs>
            <SignIn value={value} />
            <SignUp value={value} />
        </Box>
    </ScreenCenter>
}
