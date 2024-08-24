import { ReactElement, useMemo } from 'react'

import CalculateIcon from '@mui/icons-material/Calculate'
import { Box, ListItem, ListItemIcon, SxProps, Typography } from '@mui/material'

import { useLibraryAsset } from './LibraryAsset'
import { JSEdit } from './JSEdit'
import { SchemaActionTag, SchemaComputedTag, SchemaTag, SchemaVariableTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { StandardAction, StandardComputed, StandardVariable } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

type JSTags = StandardAction | StandardComputed | StandardVariable

type JSHeaderProps<T extends JSTags> = {
    item: T;
    getJS: (item: T) => string;
    maxHeight?: string;
    sx?: SxProps;
    selected?: boolean;
}

const JSHeader = <T extends JSTags>({ item, getJS, maxHeight }: JSHeaderProps<T>): ReactElement<any, any> | null => {
    const { updateStandard, readonly } = useLibraryAsset()
    const src = useMemo<string>(() => (getJS(item)), [item, getJS])

    return <ListItem>
        <ListItemIcon>
            <CalculateIcon />
        </ListItemIcon>
        <Box sx={{ padding: '2px', display: 'flex', width: "100%", position: "relative" }}>
            <Box sx={{ flexGrow: 2, flexShrink: 2, width: "0px", alignItems: "center", display: "inline-flex" }}>
                <Typography>{ item?.key }</Typography>
            </Box>
            <Box sx={{ flexGrow: 3, flexShrink: 3, width: "0px" }}>
                <JSEdit
                    src={src}
                    onChange={(value) => {
                        if (['Action', 'Computed'].includes(item.tag)) {
                            updateStandard({
                                type: 'updateField',
                                componentKey: item.key,
                                itemKey: 'src',
                                value
                            })                            
                        }
                        if (item.tag === 'Variable') {
                            updateStandard({
                                type: 'updateField',
                                componentKey: item.key,
                                itemKey: 'default',
                                value
                            })
                        }
                    }}
                    maxHeight={maxHeight}
                    readonly={readonly}
                />
            </Box>
        </Box>

    </ListItem>
}

export default JSHeader
