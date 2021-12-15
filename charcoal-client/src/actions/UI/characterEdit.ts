import { CharacterEditRecord } from '../../slices/characterEdit'
import { socketDispatchPromise } from '../communicationsLayer/lifeLine'

export const saveCharacter = ({ value }: CharacterEditRecord) => (dispatch: any, getState: any): Promise<string> => {
    console.log('saveCharacter')
    return dispatch(socketDispatchPromise('upload')({ fileName: `${value.assetKey}.wml` }))
        .then(({ url }: { url: string }) => url)
        .catch(() => null)
}