import { PlayerPublic } from './baseClasses'
import { Selector, RootState } from '../../store'
import { playerDataSourceSelectors } from './playerDataSource'
import { PlayerSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { getSessionId as getSessionIdFromSettings, getPlayerName as getPlayerNameFromSettings } from '../settings'


//
// Selector types - these now read from RootState instead of PlayerPublic
//
export type PlayerSelectors = {
}
