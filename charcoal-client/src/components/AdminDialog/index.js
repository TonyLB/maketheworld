// Foundational imports (React, Redux, etc.)
import React, { useState, useRef } from 'react'
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
    Tooltip,
    Grid
} from '@material-ui/core'
import { useTheme } from '@material-ui/core/styles'
import DownloadIcon from '@material-ui/icons/SaveAlt'
import UploadIcon from '@material-ui/icons/CloudUpload'

// Local code imports
import { closeAdminDialog } from '../../actions/UI/adminDialog'
import { putSettingsAndCloseAdminDialog } from '../../actions/settings'
import { getAdminDialogUI } from '../../selectors/UI/adminDialog.js'
import { getBackups } from '../../selectors/backups'
import { createBackup, uploadBackup } from '../../actions/backups'
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

const CreateBackupDialog = ({ open, onClose }) => {
    const classes = useStyles()
    const dispatch = useDispatch()
    const [{ Name = '', Description = '' }, setValues] = useState({})

    return <Dialog
        maxWidth="lg"
        open={open}
        onEnter={() => { setValues({ }) }}
        onClose={onClose}
    >
        <DialogTitle
            id="create-backup-dialog-title"
            className={classes.lightblue}
        >
            <Typography variant="overline">
                Create Backup
            </Typography>
        </DialogTitle>
        <DialogContent>
            <TextField
                required
                id="name"
                label="Name"
                value={Name}
                onChange={(event) => { setValues({ Name: event.target.value, Description })}}
            />
            <TextField
                id="description"
                label="Description"
                value={Description}
                onChange={(event) => { setValues({ Description: event.target.value, Name })}}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={ () => { onClose() } }>
                Cancel
            </Button>
            <Button
                onClick={() => {
                    dispatch(createBackup({ Name, Description }))
                    onClose()
                }}
                disabled={!Name}
            >
                Create
            </Button>
        </DialogActions>
    </Dialog>
}


const ImportBackupDialog = ({ open, onClose }) => {
    const classes = useStyles()
    const dispatch = useDispatch()
    const fileRef = useRef()
    const [file, setFile] = useState(null)

    const fileChangeHandler = (files) => {
        if (files.length) {
            setFile(files[0])
        }
    }
    return <Dialog
        maxWidth="lg"
        open={open}
        onEnter={() => { setFile(null) }}
        onClose={onClose}
    >
        <DialogTitle
            id="import-backup-dialog-title"
            className={classes.lightblue}
        >
            <Typography variant="overline">
                Import Backup
            </Typography>
        </DialogTitle>
        <DialogContent>
            <div>
                <input
                    type="file"
                    ref={fileRef}
                    onChange={(event) => { fileChangeHandler(event.target.files) }}
                    style={{ display: "none" }}
                />
                <TextField
                    disabled
                    id="name"
                    label="Upload File"
                    value={(file && file.name) || ''}
                />
                <IconButton onClick={ () => {
                        if (fileRef.current) {
                            fileRef.current.click()
                        }
                    }}
                >
                    <UploadIcon color="action" />
                </IconButton>
            </div>
        </DialogContent>
        <DialogActions>
            <Button onClick={ () => { onClose() } }>
                Cancel
            </Button>
            <Button
                onClick={() => {
                    if (file) {
                        dispatch(uploadBackup(file))
                    }
                    onClose()
                }}
                disabled={!file}
            >
                Import
            </Button>
        </DialogActions>
    </Dialog>
}
const BackupsTab = () => {
    const classes = useStyles()
    const backups = useSelector(getBackups)
    const [page, setPage] = React.useState(0)
    const [rowsPerPage, setRowsPerPage] = React.useState(10)
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
    const [importDialogOpen, setImportDialogOpen] = React.useState(false)

    const handleChangePage = (event, newPage) => {
        setPage(newPage)
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(+event.target.value)
        setPage(0)
    };

    return (<React.Fragment>
        <CreateBackupDialog
            open={createDialogOpen}
            onClose={() => setCreateDialogOpen(false)}
        />
        <ImportBackupDialog
            open={importDialogOpen}
            onClose={() => setImportDialogOpen(false)}
        />
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
            <Grid container>
                <Grid item xs={6} align="center">
                    <Button
                        variant="contained"
                        style={{ margin: "10px"}}
                        onClick={() => { setCreateDialogOpen(true) }}
                    >
                        Create Backup
                    </Button>
                </Grid>
                <Grid item xs={6} align="center">
                    <Button
                        variant="contained"
                        style={{ margin: "10px"}}
                        onClick={() => { setImportDialogOpen(true) }}
                    >
                        Import Backup
                    </Button>
                </Grid>
            </Grid>
        </Paper>
    </React.Fragment>)
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