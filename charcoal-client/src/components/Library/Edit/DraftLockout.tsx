import { FunctionComponent, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { getStatus, revertDraftWML, setIntent } from "../../../slices/personalAssets"
import { useLibraryAsset } from "./LibraryAsset"
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import { heartbeat } from "../../../slices/stateSeekingMachine/ssmHeartbeat"

export const DraftLockout: FunctionComponent<{}> = () => {
    const { AssetId } = useLibraryAsset()
    const currentStatus = useSelector(getStatus(AssetId))
    const dispatch = useDispatch()
    const handleRevert = useCallback(() => {
        dispatch(revertDraftWML(AssetId)({}))
        dispatch(setIntent({ key: AssetId, intent: ['SCHEMADIRTY', 'WMLDIRTY'] }))
        dispatch(heartbeat)
    }, [AssetId])
    return currentStatus === 'DRAFTERROR'
        ? <Box sx={{
            zIndex: 1,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, .2)",
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            flexDirection: "row"
        }}>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{
                display: "flex",
                flexDirection: "column"
            }}>
                <Box sx={{ flexGrow: 1 }} />
                    <Card sx={{ maxWidth: '300px' }}>
                        <CardContent>
                            <Typography variant="h5" component="div">WML Error</Typography>
                            There is an error in the advanced WML editor.  Either use the revert button to discard your error-causing changes,
                            or return to the advanced editor and correct the error in place.
                        </CardContent>
                        <CardActions>
                            <Button
                                onClick={handleRevert}
                            >
                                Revert
                            </Button>
                        </CardActions>
                    </Card>
                <Box sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ flexGrow: 1 }} />
        </Box>
        : null
}

export default DraftLockout
