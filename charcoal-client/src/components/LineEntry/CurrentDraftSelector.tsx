import { FunctionComponent } from "react"
import { blue } from "@mui/material/colors"
import Box from "@mui/material/Box"
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import CreateIcon from '@mui/icons-material/Create'
import { useDispatch, useSelector } from "react-redux"
import { getPlayer, setCurrentDraft } from "../../slices/player"

export const CurrentDraftSelector: FunctionComponent<{}> = () => {
    const { currentDraft, Assets } = useSelector(getPlayer)
    const dispatch = useDispatch()
    return <Box sx={{
        height: 50,
        bgcolor: blue[500],
        borderRadius: 25,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        columnGap: '0.5em',
        paddingLeft: '0.5em',
        paddingRight: '0.5em'
    }}>
        <CreateIcon
            sx={{ width:40, height: 50, fill: 'white' }}
        />
        <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
            <InputLabel id="select-small">Editing</InputLabel>
            <Select
                labelId="select-small"
                id="select-small"
                value={currentDraft || ''}
                label="Edit Target"
                onChange={(event) => { dispatch(setCurrentDraft(event.target.value)) }}
            >
                <MenuItem value={""}><em>Not editing</em></MenuItem>
                {
                    Assets.map(({ AssetId: key }) => (
                        <MenuItem key={key} value={key}>{key}</MenuItem>
                    ))
                }
            </Select>
        </FormControl>
    </Box>
}

export default CurrentDraftSelector
