import { gql } from "@apollo/client";

export const GET_ME = gql`
  query Me {
    me {
      id
      username
      email
      bio
    }
  }
`;

export const GET_ALL_PUBLIC_EXPS = gql`
  query GetAllPublicExperiences($categoryId: ID) {
    allPublicExperiences(categoryId: $categoryId) {
      author {
        bio
        created_at
        email
        id
        otpEnabled
        updated_at
        username
      }
      createdAt
      id
      title
      updatedAt
      isPrivate
      categories {
        name
        id
      }
      content
    }
  }
`;

export const GET_MY_EXPS = gql`
  query GetMyExperiences {
    getMyExperiences {
      content
      createdAt
      id
      isPrivate
      title
      updatedAt
      categories {
        name
        id
      }
      author {
        username
        email
        id
      }
    }
  }
`;
