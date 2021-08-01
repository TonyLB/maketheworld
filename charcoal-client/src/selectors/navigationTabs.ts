import { createSelector } from '@reduxjs/toolkit'
import { NavigationTab } from '../slices/navigationTabs'

export const navigationTabs = ({ navigationTabs = [] }: { navigationTabs: NavigationTab[] }) => (navigationTabs)

export const navigationTabPinnedByHref = (hrefMatch: string) => createSelector(
    navigationTabs,
    (tabs) => (tabs.find(({ href }) => (href === hrefMatch)))
)
