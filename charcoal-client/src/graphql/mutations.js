/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const putCharacter = /* GraphQL */ `
  mutation PutCharacter(
    $Name: String!
    $CharacterId: String
    $Pronouns: String
    $FirstImpression: String
    $Outfit: String
    $OneCoolThing: String
  ) {
    putCharacter(
      Name: $Name
      CharacterId: $CharacterId
      Pronouns: $Pronouns
      FirstImpression: $FirstImpression
      Outfit: $Outfit
      OneCoolThing: $OneCoolThing
    ) {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
    }
  }
`;
export const addCharacterInPlay = /* GraphQL */ `
  mutation AddCharacterInPlay($CharacterId: String!, $ConnectionId: String!) {
    addCharacterInPlay(CharacterId: $CharacterId, ConnectionId: $ConnectionId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
export const deleteCharacterInPlay = /* GraphQL */ `
  mutation DeleteCharacterInPlay($CharacterId: String!) {
    deleteCharacterInPlay(CharacterId: $CharacterId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
export const moveCharacter = /* GraphQL */ `
  mutation MoveCharacter($CharacterId: String!, $RoomId: String!) {
    moveCharacter(CharacterId: $CharacterId, RoomId: $RoomId) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }
`;
export const putNeighborhood = /* GraphQL */ `
  mutation PutNeighborhood(
    $PermanentId: String
    $Name: String!
    $Description: String
    $ParentId: String
  ) {
    putNeighborhood(
      PermanentId: $PermanentId
      Name: $Name
      Description: $Description
      ParentId: $ParentId
    ) {
      PermanentId
      Type
      Name
      Ancestry
      Description
      ParentId
    }
  }
`;
