// Foundational imports (React, Redux, etc.)
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

// MaterialUI imports
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Tabs,
    Tab,
    AppBar,
    Typography,
    Paper,
    Table,
    TableContainer,
    TableHead,
    TableBody,
    TablePagination,
    TableRow,
    TableCell,
    IconButton,
    Tooltip
} from '@material-ui/core'
import { useTheme } from '@material-ui/core/styles'
import DownloadIcon from '@material-ui/icons/SaveAlt'

// Local code imports
import { closeAdminDialog } from '../../actions/UI/adminDialog'
import { putSettingsAndCloseAdminDialog } from '../../actions/settings'
import { getAdminDialogUI } from '../../selectors/UI/adminDialog.js'
import { getBackups } from '../../selectors/backups'
import useStyles from '../styles'
import { STORAGE_API_URI } from '../../config'

const TabPanel = (props) => {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`mtw-tabpanel-${index}`}
            aria-labelledby={`mtw-tab-${index}`}
            {...other}
        >
            {value === index && (
                <React.Fragment>{children}</React.Fragment>
            )}
        </div>
    )
}

const a11yProps = (index) => {
    return {
        id: `full-width-tab-${index}`,
        'aria-controls': `full-width-tabpanel-${index}`,
    }
}

const SettingsTab = ({ classes, ChatPrompt, setValues }) => (
    <form className={classes.root} noValidate autoComplete="off">
        <div>
            <TextField
                required
                id="name"
                label="Chat Prompt"
                value={ChatPrompt || ''}
                onChange={(event) => { setValues({ ChatPrompt: event.target.value })}}
            />
        </div>
    </form>
)

const BackupsTab = () => {
    const classes = useStyles()
    const backups = useSelector(getBackups)
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    return (
        <Paper className={classes.root}>
            <TableContainer className={classes.container}>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            <TableCell key="Name" >
                                Name
                            </TableCell>
                            <TableCell colSpan={2} key="Description" >
                                Description
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { Object.values(backups)
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map(({ Name, Description, PermanentId }) => (
                                <TableRow hover tabIndex={-1} key={PermanentId}>
                                    <TableCell>
                                        { Name }
                                    </TableCell>
                                    <TableCell>
                                        { Description }
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={"Download backup"}>
                                            <IconButton href={`${STORAGE_API_URI}/backups/${PermanentId}.json`} >
                                                <DownloadIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        }
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 25, 100]}
                component="div"
                count={Object.values(backups).length}
                rowsPerPage={rowsPerPage}
                page={page}
                onChangePage={handleChangePage}
                onChangeRowsPerPage={handleChangeRowsPerPage}
            />
        </Paper>
    )
}

const AdminTabs = ({ ChatPrompt, setValues }) => {
    const classes = useStyles()
    const theme = useTheme()
    const [value, setValue] = React.useState(0)

    const handleChange = (event, newValue) => {
      setValue(newValue)
    }

    return (
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <div className={classes.root}>
                <AppBar position="static" color="default" style={{ width: "100%" }}>
                    <Tabs
                        value={value}
                        onChange={handleChange}
                        indicatorColor="primary"
                        textColor="primary"
                        centered
                        aria-label="full width tabs example"
                    >
                        <Tab label="Settings" {...a11yProps(0)} />
                        <Tab label="Backups" {...a11yProps(0)} />
                    </Tabs>
                </AppBar>
                <TabPanel value={value} index={0} dir={theme.direction}>
                    <SettingsTab classes={classes} ChatPrompt={ChatPrompt} setValues={setValues} />
                </TabPanel>
                <TabPanel value={value} index={1} dir={theme.direction}>
                    <BackupsTab />
                </TabPanel>
            </div>
        </div>
    )
}

export const AdminDialog = () => {
    const { open, ChatPrompt: defaultChatPrompt } = useSelector(getAdminDialogUI)
    const [{ ChatPrompt }, setValues] = useState({ ChatPrompt: defaultChatPrompt })
    const dispatch = useDispatch()

    const saveHandler = () => {
        dispatch(putSettingsAndCloseAdminDialog({ ChatPrompt }))
    }

    const classes = useStyles()
    return(
        <React.Fragment>
            <Dialog
                maxWidth="lg"
                open={open}
                onEnter={() => { setValues({ ChatPrompt: defaultChatPrompt }) }}
            >
                <DialogTitle
                    id="admin-dialog-title"
                    className={classes.lightblue}
                >
                    <Typography variant="overline">
                        Administration
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <AdminTabs ChatPrompt={ChatPrompt} setValues={setValues} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => { dispatch(closeAdminDialog()) } }>
                        Cancel
                    </Button>
                    <Button onClick={saveHandler}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )
}

export default AdminDialog