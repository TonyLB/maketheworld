import { FunctionComponent, useCallback, useMemo } from "react"
import { useLibraryAsset } from "../../../Library/Edit/LibraryAsset"
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
import { schemaOutputToString } from "@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString"
import { isStandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import { useDispatch } from "react-redux"
import { addOnboardingComplete } from "../../../../slices/player/index.api"

type UnshownRoomsProps = {

}

export const UnshownRooms: FunctionComponent<UnshownRoomsProps> = () => {
    const { standardForm, combinedStandardForm } = useLibraryAsset()
    const { tree, inherited, UI: { itemSelected }, mapDispatch } = useMapContext()
    const dispatch = useDispatch()
    const shownRooms = useMemo(() => (selectKeysByTag('Room')([...tree, ...inherited])), [tree, inherited])
    const unshownRoomItems = Object.values(standardForm.byId)
        .filter(isStandardRoom)
        .filter(({ key }) => (!shownRooms.includes(key)))
    const nameFromKey = useCallback((key: string): string => {
        const component = combinedStandardForm.byId[key]
        if (component && isStandardRoom(component)) {
            return schemaOutputToString(component.shortName.children) || 'Untitled'
        }
        return 'Untitled'
    }, [combinedStandardForm])
    return <List>
        {
            unshownRoomItems.map(({ key }) => (
                <ListItemButton
                    key={key}
                    dense
                    sx={{ width: '100%' }}
                    selected={itemSelected?.type === 'UnshownRoom' && itemSelected?.key === key}
                    onClick={() => { 
                        mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoom', key }})
                    }}
                >
                    <ListItemAvatar>
                        <RoomIcon sx={{ fontSize: "15px", color: grey[500] }} />
                    </ListItemAvatar>
                    <ListItemText primary={ nameFromKey(key) } />
                </ListItemButton>
            ))
        }
        <ListItemButton
            dense
            sx={{ width: '100%' }}
            selected={itemSelected?.type === 'UnshownRoomNew'}
            onClick={() => {
                dispatch(addOnboardingComplete(['addNewRoom']))
                mapDispatch({ type: 'SelectItem', item: { type: 'UnshownRoomNew' }})
            }}
        >
            <ListItemAvatar>
                <AddIcon sx={{ fontSize: "15px", color: grey[500] }} />
            </ListItemAvatar>
            <ListItemText primary="Add New Room" />
        </ListItemButton>
    </List>
}