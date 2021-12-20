import { CharacterEditRecord } from '../../slices/characterEdit'
import { socketDispatchPromise, apiDispatchPromise } from '../communicationsLayer/lifeLine'
import { v4 as uuidv4 } from 'uuid'

export const saveCharacter = ({ value }: CharacterEditRecord, wml: string) => (dispatch: any, getState: any): Promise<string> => {
    console.log('saveCharacter')
    const uploadRequestId = uuidv4()
    return dispatch(socketDispatchPromise('upload')({
            fileName: `${value.assetKey}.wml`,
            uploadRequestId
        }))
        .then(({ url }: { url: string }) => url)
        .then((url: string) => (apiDispatchPromise(url, uploadRequestId)(wml)))
        .catch(() => null)
}