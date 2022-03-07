import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { NavigationTab, add } from './index'
import { navigationTabPinnedByHref } from '.'

export const useAutoPin = ({ href, label, iconName }: NavigationTab) => {
    const { href: hrefData = null, label: labelData = '???' }: NavigationTab | any = useSelector(navigationTabPinnedByHref(href)) || {}
    const dispatch = useDispatch()
    useEffect(() => {
        if (href && (!hrefData || (labelData !== label))) {
            dispatch(add({ href, label, iconName }))
        }
    }, [dispatch, hrefData, labelData, href, label, iconName])
}

export default useAutoPin
