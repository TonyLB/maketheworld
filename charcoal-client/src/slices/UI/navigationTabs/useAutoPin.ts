import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { NavigationTab, add } from './index'
import { navigationTabPinnedByHref } from '.'
import { NarrowOmit } from '../../../lib/types'

export const useAutoPin = (item: NarrowOmit<NavigationTab, 'closable'> & { closable?: boolean }) => {
    const { href, label, closable=true, iconName } = item
    const { href: hrefData = null, label: labelData = '???', iconName: iconNameData }: NavigationTab | any = useSelector(navigationTabPinnedByHref(href)) || {}
    const dispatch = useDispatch()
    useEffect(() => {
        if (href && (!hrefData || (labelData !== label) || (iconName && !(iconName === iconNameData)))) {
            dispatch(add({ ...item, closable } as NavigationTab))
        }
    }, [dispatch, hrefData, labelData, href, label, item, closable, iconName, iconNameData])
}

export default useAutoPin
