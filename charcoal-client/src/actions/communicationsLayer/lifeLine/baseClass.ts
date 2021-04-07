import { ISSMTemplateAbstract, ISSMPotentialState } from '../../stateSeekingMachine/baseClasses'

export type lifeLineSSMKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'STALE' | 'RECONNECTING'
export const LifeLineSSMKey = 'LifeLine'

export interface ILifeLineData {}

export type ILifeLineState = ISSMPotentialState<lifeLineSSMKeys, ILifeLineData>

export interface ILifeLineSSM extends ISSMTemplateAbstract<lifeLineSSMKeys, ILifeLineData> {
    ssmType: 'LifeLine'
}
