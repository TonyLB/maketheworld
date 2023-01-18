import { FunctionComponent, useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"
import { getStatus, revertDraftWML, setIntent } from "../../../slices/personalAssets"
import { useLibraryAsset } from "./LibraryAsset"
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { heartbeat } from "../../../slices/stateSeekingMachine/ssmHeartbeat"

export const DraftLockout: FunctionComponent<{}> = () => {
    const { AssetId } = useLibraryAsset()
    const currentStatus = useSelector(getStatus(AssetId))
    const dispatch = useDispatch()
    const handleRevert = useCallback(() => {
        dispatch(revertDraftWML(AssetId)({}))
        dispatch(setIntent({ key: AssetId, intent: ['NORMALDIRTY', 'WMLDIRTY'] }))
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
                    <Box>
                        TEST
                        <Button
                            onClick={handleRevert}
                        >
                            Revert
                        </Button>
                    </Box>
                <Box sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ flexGrow: 1 }} />
        </Box>
        : null
}

export default DraftLockout
