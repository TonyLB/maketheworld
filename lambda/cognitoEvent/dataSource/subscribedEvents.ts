import { HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { CognitoApiPayload, CognitoApiSubscribedHeader } from './apiCognito'

const isApiCognitoHeader: HeaderGuard<CognitoApiSubscribedHeader> = (
    header
): header is CognitoApiSubscribedHeader => (
    header.dataSourceKey === 'api.cognito' && header.type === 'New Player'
)

export const isCognitoSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CognitoApiPayload,
    CognitoApiSubscribedHeader
>(isApiCognitoHeader)

export type CognitoSubscribedContent = CognitoApiPayload
