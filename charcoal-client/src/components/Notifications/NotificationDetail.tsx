import { TableCell } from "@aws-amplify/ui-react"
import { Box, TableContainer, TableRow } from "@mui/material"
import { FunctionComponent } from "react"
import { useSelector } from "react-redux"
import { EphemeraNotificationId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { getNotification } from "../../slices/notifications/selectors"
import TaggedMessageContent from "../Message/TaggedMessageContent"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import Grid from "@mui/material/Grid"

type NotificationDetailProps = {
    NotificationId: EphemeraNotificationId;
}

export const NotificationDetail: FunctionComponent<NotificationDetailProps> = ({ NotificationId }) => {
    const notification = useSelector(getNotification(NotificationId))
    return <Box sx={{ width: "100%", height: "100%", flexDirection: 'column', display: 'flex' }}>
        {
            notification
                ? <Grid container>
                    <Grid item xs={2}>
                        Subject
                    </Grid>
                    <Grid item xs={10}>
                        { notification.Subject }
                    </Grid>
                    <Grid item xs={2}>
                        Message
                    </Grid>
                    <Grid item xs={10}>
                        <TaggedMessageContent list={notification.Message} />
                    </Grid>
                </Grid>
                : null
        }
    </Box>
}
