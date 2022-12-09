import { TableCell } from "@aws-amplify/ui-react"
import { Box, Grid, Paper, Table, TableBody, TableContainer, TableHead, TablePagination, TableRow } from "@mui/material"
import { FunctionComponent, useCallback, useState } from "react"
import { useSelector } from "react-redux"
import { getNotifications } from "../../slices/notifications"

type NotificationListProps = {}

export const NotificationList: FunctionComponent<NotificationListProps> = () => {
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
        <Box sx={{ flexGrow: 1, width: "100%" }}>
            <TableContainer component={Paper}>
                <Table aria-label="notification list">
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                Subject
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody sx={{ verticalAlign: 'top' }}>
                        {
                            notifications.map(({ Subject, NotificationId }) => (
                                <TableRow key={ NotificationId } sx={{ maxHeight: '2em', verticalAlign: 'top' }}>
                                    <TableCell>
                                        { Subject }
                                    </TableCell>
                                </TableRow>
                            ))
                        }
                    </TableBody>
                </Table>
            </TableContainer>
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