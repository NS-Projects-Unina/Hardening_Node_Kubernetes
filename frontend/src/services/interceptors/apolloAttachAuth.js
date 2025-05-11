// apolloAuthInterceptor.js
import { ApolloLink, fromPromise } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { store } from "../../app/store";
import {
  setUnauthenticated,
  setAuthenticated,
} from "../../features/auth/authSlice";

import { GET_ME } from "../graphql/queries";
import client from "../graphql/apolloClient";
import authApi from "../auth";

let isRefreshing = false;
let pendingRequests = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach((callback) => callback());
  pendingRequests = [];
};

const shouldRefresh = (graphQLErrors = [], networkError) => {
  if (networkError?.statusCode === 401) return true;

  return graphQLErrors.some(
    (err) =>
      err.extensions?.code === "UNAUTHORIZED" ||
      err.message === "Not authorized"
  );
};

const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (!shouldRefresh(graphQLErrors, networkError)) {
      return;
    }

    if (!isRefreshing) {
      isRefreshing = true;

      return fromPromise(
        authApi
          .get("/refresh")
          .then(async () => {
            try {
              const { data } = await client.query({
                query: GET_ME,
                fetchPolicy: "no-cache",
              });
              store.dispatch(setAuthenticated(data.me));
            } catch {
              store.dispatch(setAuthenticated());
            }

            resolvePendingRequests();
            return true;
          })
          .catch((err) => {
            store.dispatch(setUnauthenticated());
            pendingRequests = [];
            throw err;
          })
          .finally(() => {
            isRefreshing = false;
          })
      ).flatMap(() => forward(operation));
    }

    return fromPromise(
      new Promise((resolve) => {
        pendingRequests.push(() => resolve());
      })
    ).flatMap(() => forward(operation));
  }
);

export const apolloAuthInterceptor = ApolloLink.from([errorLink]);
