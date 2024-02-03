import { FunctionComponent, useMemo } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset"
import { isNormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { useMapContext } from "../../Controller"
import {
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText
} from "@mui/material"
import { grey } from '@mui/material/colors'
import RoomIcon from '@mui/icons-material/Home'
import AddIcon from '@mui/icons-material/Add'
import { selectKeysByTag } from "@tonylb/mtw-wml/dist/normalize/selectors/keysByTag"
import { selectName } from "@tonylb/mtw-wml/dist/normalize/selectors/name"
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/simpleSchema/utils/schemaOutput/schemaOutputToString"

type UnshownRoomsProps = {

}

export const UnshownRooms: FunctionComponent<UnshownRoomsProps> = () => {
    const { normalForm, select } = useLibraryAsset()
    const { tree, UI: { itemSelected }, mapDispatch } = useMapContext()
    const shownRooms = useMemo(() => (selectKeysByTag('Room')(tree)), [tree])
    const unshownRoomItems = Object.values(normalForm)
        .filter(isNormalRoom)
        .filter(({ key }) => (!shownRooms.includes(key)))
    return <List>
        {
            unshownRoomItems.map(({ key }) => (
                <ListItemButton
                    key={key}
                    dense
                    sx={{ width: '100%' }}
                    selected={itemSelected?.type === 'UnshownRoom' && itemSelected?.key === key}
                    onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoom', key }})}}
                >
                    <ListItemAvatar>
                        <RoomIcon sx={{ fontSize: "15px", color: grey[500] }} />
                    </ListItemAvatar>
                    <ListItemText primary={ schemaOutputToString(select({ key, selector: selectName })) } />
                </ListItemButton>
            ))
        }
        <ListItemButton
            dense
            sx={{ width: '100%' }}
            selected={itemSelected?.type === 'UnshownRoomNew'}
            onClick={() => { mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoomNew' }})}}
        >
            <ListItemAvatar>
                <AddIcon sx={{ fontSize: "15px", color: grey[500] }} />
            </ListItemAvatar>
            <ListItemText primary="Add New Room" />
        </ListItemButton>
    </List>
}