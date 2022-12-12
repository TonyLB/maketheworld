import { Box } from "@mui/material"
import { FunctionComponent, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { EphemeraNotificationId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { getNotification } from "../../slices/notifications/selectors"
import TaggedMessageContent from "../Message/TaggedMessageContent"
import Grid from "@mui/material/Grid"
import { markNotificationRead } from "../../slices/notifications/index.api"

type NotificationDetailProps = {
    NotificationId: EphemeraNotificationId;
}

export const NotificationDetail: FunctionComponent<NotificationDetailProps> = ({ NotificationId }) => {
    const notification = useSelector(getNotification(NotificationId))
    const dispatch = useDispatch()
    useEffect(() => {
        if (notification && !notification.read) {
            dispatch(markNotificationRead(notification.NotificationId))
        }
    }, [notification, dispatch])
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
