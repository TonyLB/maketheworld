import { createSelector } from '@reduxjs/toolkit'
import { NavigationTab } from '../slices/navigationTabs'

export const navigationTabs = ({ navigationTabs = [] }: { navigationTabs: NavigationTab[] }) => (navigationTabs)

export const navigationTabSelected = (pathname: string) => ({ navigationTabs = [] }: { navigationTabs: { href: string }[]}) => {
    const matches = navigationTabs
        .filter(({ href }) => (pathname.startsWith(href)))
        .sort(({ href: hrefA = '' }, { href: hrefB = '' }) => (hrefA.length - hrefB.length))
    if (matches.length) {
        return matches[0]
    }
    else {
        return null
    }
}

export const navigationTabPinnedByHref = (hrefMatch: string) => createSelector(
    navigationTabs,
    (tabs) => (tabs.find(({ href }) => (href === hrefMatch)))
)
