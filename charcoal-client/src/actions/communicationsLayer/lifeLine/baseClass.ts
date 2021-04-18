import { ISSMTemplateAbstract, ISSMPotentialState } from '../../stateSeekingMachine/baseClasses'

export type lifeLineSSMKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'STALE' | 'RECONNECTING'
export const LifeLineSSMKey = 'LifeLine'

//
// TODO:  Set more specific Typescript types for these data elements
//
export class LifeLineData {
    webSocket: any = null
    pingInterval: any = null
    refreshTimeout: any = null
}

export type ILifeLineState = ISSMPotentialState<lifeLineSSMKeys, LifeLineData>

export interface ILifeLineSSM extends ISSMTemplateAbstract<lifeLineSSMKeys, LifeLineData> {
    ssmType: 'LifeLine'
}
