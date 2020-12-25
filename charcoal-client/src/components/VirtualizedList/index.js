import React, { useRef, useCallback, useState, useMemo } from 'react'
import PropTypes from "prop-types"

import {
    List,
    ListItem,
    ListItemText
} from '@material-ui/core'

import AutoSizer from 'react-virtualized-auto-sizer'
import { Virtuoso } from 'react-virtuoso'

const renderRow = (dataSelect, allLoaded) => (index) => {

    return index === 0 ? (
        <ListItem button key={index}>
            <ListItemText primary={allLoaded ? `... All loaded ...` : `... Loading ...`} />
        </ListItem>
        )
        : dataSelect(index-1)
}

export const VirtualizedList = ({ style, dataSelect, rowCount, unshiftRows = null }) => {
    const virtuoso = useRef()
    const loading = useRef(false)
    const [allLoaded, setAllLoaded] = useState(Boolean(unshiftRows))

    const Components = useMemo(() => {
        return {
            List: React.forwardRef(({ style, children }, listRef) => (
                <List
                    style={{padding: 0, ...style, margin: 0}}
                    component="div"
                    ref={listRef}
                >
                    {children}
                </List>
            )),

            Item: ({ children, ...props }) => (
                <ListItem component="div" {...props} style={{ margin: 0 }}>
                    {children}
                </ListItem>
            ),

            // Group: ({ children, ...props }) => (
            //     <ListSubheader
            //         component="div"
            //         {...props}
            //         style={{
            //             backgroundColor: 'var(--ifm-background-color)',
            //             margin: 0
            //         }}
            //         disableSticky={true}
            //     >
            //         {children}
            //     </ListSubheader>
            // )
        }
    }, [])

    // the setTimeout below simulates a network request.
    // In the real world, you can fetch data from a service.
    const loadMore = useCallback(() => {
        if (loading.current || allLoaded.current) {
            return
        }
        loading.current = true

        setTimeout(() => {
            loading.current = false
            const rowsUnshifted = (unshiftRows && unshiftRows(100)) || 0
            if (rowsUnshifted > 0) {
                virtuoso.current.adjustForPrependedItems(rowsUnshifted)
            }
            else {
                setAllLoaded(true)
            }
        }, 500)
    }, [loading, allLoaded, unshiftRows])
    const rowCountPlusOne = useMemo(() => ( rowCount + 1 ), [rowCount])

    return (
        <AutoSizer style={style}>
            {({ width, height }) => (
                <Virtuoso
                    components={Components}
                    initialTopMostItemIndex={40}
                    defaultItemHeight={50}
                    totalCount={rowCountPlusOne}
                    overscan={{ main: 20, reverse: 20 }}
                    startReached={loadMore}
                    itemContent={renderRow(dataSelect, allLoaded)}
                    followOutput={true}
                    style={{ width, height }}
                    ref={virtuoso}
                />
            )}
        </AutoSizer>
    )
}

VirtualizedList.propTypes = {
    style: PropTypes.object,
    dataSelect: PropTypes.func,
    rowCount: PropTypes.number,
    unshiftRows: PropTypes.func
}
export default VirtualizedList
