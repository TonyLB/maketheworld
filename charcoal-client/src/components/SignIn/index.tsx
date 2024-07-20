import { styled } from "@mui/material/styles"
import Tabs from "@mui/material/Tabs"
import Tab, { tabClasses } from "@mui/material/Tab"
import Box from "@mui/material/Box"
import { blue } from '@mui/material/colors'
import { useState } from "react"

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
    return <Box
        hidden={value !== 0}
        sx={{
            borderColor: blue[500],
            borderStyle: "solid",
            height: "calc(100% - 3em)"
        }}
    >
        Sign In
    </Box>
}

const SignUp = ({ value }: { value: number }) => {
    return <Box
        hidden={value !== 1}
        sx={{
            borderColor: blue[500],
            borderStyle: "solid",
            height: "calc(100% - 3em)"
        }}
    >
        Sign Up
    </Box>
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
                minHeight: "40em"
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
