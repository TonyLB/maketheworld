import { TableCell } from "@aws-amplify/ui-react"
import { Avatar, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Table, TableBody, TableContainer, TableHead, TablePagination, TableRow } from "@mui/material"
import { FunctionComponent, useCallback, useState } from "react"
import { useSelector } from "react-redux"
import { getNotifications } from "../../slices/notifications"
import AnnouncementIcon from '@mui/icons-material/Announcement'
import Badge from "@mui/material/Badge"
import { EphemeraNotificationId } from "@tonylb/mtw-interfaces/dist/baseClasses"

type NotificationListProps = {
    selected?: EphemeraNotificationId;
    setSelected: (value: EphemeraNotificationId) => void;
}

export const NotificationList: FunctionComponent<NotificationListProps> = ({ selected, setSelected }) => {
    const notifications = useSelector(getNotifications)
    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(50)
    const handleChangePage = useCallback((event: unknown, newPage: number) => {
        setPage(newPage)
    }, [setRowsPerPage, setPage])
    const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10))
        setPage(0)
    }, [setRowsPerPage, setPage])
    return <Box sx={{ width: "100%", height: "100%", flexDirection: 'column', display: 'flex' }}>
        <Box sx={{ width: "100%", bgcolor: '#DDDDDD' }}>
            <List component="nav" aria-label="notification list">
                <ListItem>
                    <ListItemText primary="Subject" />
                </ListItem>
            </List>
        </Box>
        <Box sx={{ flexGrow: 1, width: "100%", overflowY: 'auto' }}>
            <List component="nav" aria-label="notification list">
                {
                    notifications.map(({ Subject, NotificationId, read }) => (
                        <ListItemButton
                            key={NotificationId}
                            selected={NotificationId === selected}
                            onClick={() => { setSelected(NotificationId) }}
                        >
                            <ListItemIcon>
                                { read
                                    ? <Avatar variant="rounded">
                                        <AnnouncementIcon />
                                    </Avatar>
                                    : <Badge variant="dot" color="primary" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                                        <Avatar variant="rounded">
                                            <AnnouncementIcon />
                                        </Avatar>
                                    </Badge>
                                }
                            </ListItemIcon>
                            <ListItemText primary={ Subject } />
                        </ListItemButton>
                    ))
                }
            </List>
        </Box>
        <Box sx={{ width: "100%" }}>
            <TablePagination
                rowsPerPageOptions={[20, 50, 100]}
                component="div"
                count={notifications.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Box>
    </Box>
}