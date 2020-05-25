import React from 'react'

// MaterialUI imports
import {
    Popover,
    List,
    ListItem,
    ListItemIcon,
    ListItemText
} from '@material-ui/core'
import LockIcon from '@material-ui/icons/Lock'

export const EditMapContextMenuPopover = ({
    onLock = () => {},
    onRemove = () => {},
    locked=false,
    ...rest
}) => {
    return <Popover
        anchorOrigin={{
            vertical: 'center',
            horizontal: 'right',
        }}
        transformOrigin={{
            vertical: 'center',
            horizontal: 'left',
        }}
        {...rest}
    >
        <List>
            <ListItem button onClick={onLock}>
                { locked && <ListItemIcon>
                        <LockIcon />
                    </ListItemIcon>}
                <ListItemText>{ locked ? 'Unlock' : 'Lock' }</ListItemText>
            </ListItem>
            <ListItem button onClick={onRemove}>
                <ListItemText>Remove</ListItemText>
            </ListItem>
        </List>
    </Popover>
}

export default EditMapContextMenuPopover