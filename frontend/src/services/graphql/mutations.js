import { gql } from "@apollo/client";

export const UPDATE_EXPERIENCE = gql`
  mutation UpdateExperience(
    $id: ID!
    $title: String
    $content: String
    $categoryIds: [ID!]
    $isPrivate: Boolean
  ) {
    updateExperience(
      id: $id
      title: $title
      content: $content
      categoryIds: $categoryIds
      isPrivate: $isPrivate
    ) {
      content
      createdAt
      id
      isPrivate
      title
      updatedAt
      author {
        email
        username
      }
      categories {
        id
        name
      }
    }
  }
`;

export const DELETE_EXPERIENCE = gql`
  mutation DeleteExperience($id: ID!) {
    deleteExperience(id: $id)
  }
`;

export const CREATE_EXPERIENCE = gql`
  mutation CreateExperience(
    $categoryIds: [ID!]!
    $content: String!
    $title: String!
    $isPrivate: Boolean!
  ) {
    createExperience(
      categoryIds: $categoryIds
      content: $content
      title: $title
      isPrivate: $isPrivate
    ) {
      content
      createdAt
      id
      isPrivate
      title
      updatedAt
      author {
        bio
        email
        created_at
        id
        otpEnabled
        updated_at
        username
      }
    }
  }
`;
