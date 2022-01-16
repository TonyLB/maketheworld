import { socketDispatch } from "../../slices/lifeLine"

export const goHome = (CharacterId) => (dispatch, getState) => {

    dispatch(socketDispatch('action')({ actionType: 'home', payload: { CharacterId } }))

}

export default goHome