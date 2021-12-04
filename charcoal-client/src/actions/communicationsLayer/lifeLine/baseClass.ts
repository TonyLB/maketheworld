import { ISSMTemplateAbstract, ISSMPotentialState } from '../../stateSeekingMachine/baseClasses'
import { LifeLinePubSubData, LifeLineSubscribeAction } from './lifeLine'
import { PubSub } from '../../../lib/pubSub'

export type lifeLineSSMKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'STALE' | 'RECONNECTING'
export const LifeLineSSMKey = 'LifeLine'

//
// TODO:  Set more specific Typescript types for the JS-imported data elements
//
export class LifeLineData {
    webSocket: any = null;
    pingInterval: any = null;
    refreshTimeout: any = null;
    incrementalBackoff: number = 0.5;
    subscribe: LifeLineSubscribeAction;

    constructor(pubSub: PubSub<LifeLinePubSubData>) {
        this.subscribe = (subscribeAction) => {
            const subscriptionId = pubSub.subscribe(subscribeAction)
            return {
                unsubscribe: () => { pubSub.unsubscribe(subscriptionId) }
            }
        }
    }
}



export type ILifeLineState = ISSMPotentialState<lifeLineSSMKeys, LifeLineData>

export interface ILifeLineSSM extends ISSMTemplateAbstract<lifeLineSSMKeys, LifeLineData> {
    ssmType: 'LifeLine'
}
