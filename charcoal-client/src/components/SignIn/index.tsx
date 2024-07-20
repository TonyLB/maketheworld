import { styled } from "@mui/material/styles"
import Tabs from "@mui/material/Tabs"
import Tab, { tabClasses } from "@mui/material/Tab"
import Box from "@mui/material/Box"
import { blue } from '@mui/material/colors'
import React, { useState } from "react"
import { Button, Checkbox, FormControlLabel, Stack, TextField } from "@mui/material"
import CodeOfConductConsentDialog from "../CodeOfConductConsent"

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
                onChange={(event) => { setUserName(event.target.value) }}
                placeholder="Enter user name"
            />
            <TextField
                value={password}
                onChange={(event) => { setPassword(event.target.value) }}
                placeholder="Enter password"
                type="password"
            />
            <Button variant="contained">Sign In</Button>
        </Stack>
    </Box>
}

const SignUp = ({ value }: { value: number }) => {
    const [showingDialog, setShowingDialog] = useState(false)
    const [inviteCode, setInviteCode] = useState('')
    const [userName, setUserName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [acknowledge, setAcknowledge] = useState(false)
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
                    onChange={(event) => { setInviteCode(event.target.value) }}
                    label="Invite Code"
                    name="Invite Code"
                    placeholder="Enter invite code"
                />
                <br />
                <TextField
                    value={userName}
                    onChange={(event) => { setUserName(event.target.value) }}
                    label="User Name"
                    name="User Name"
                    placeholder="Enter user name"
                />
                <TextField
                    value={password}
                    onChange={(event) => { setPassword(event.target.value) }}
                    label="Password"
                    name="Password"
                    placeholder="Enter password"
                    type="password"
                />
                <TextField
                    value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value) }}
                    label="Confirm password"
                    name="Confirm password"
                    placeholder="Confirm password"
                    type="password"
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            name="acknowledgement"
                            value="yes"
                            checked={acknowledge}
                            onChange={(event) => { setAcknowledge(event.target.checked) }}
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
            <Button variant="contained">Sign Up</Button>
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
    return <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignContent: 'center',
        height: "100%",
    }}>
        <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignContent: 'center',
            width: "100%",
        }}>
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
        </Box>
    </Box>
}
