// apolloClient.js
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  ApolloLink,
} from "@apollo/client";
import { apolloAuthInterceptor } from "../interceptors/apolloAttachAuth";

const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;

const httpLink = createHttpLink({
  uri: `https://${apiEndpoint}/graphql`,
  credentials: "include",
});

const client = new ApolloClient({
  link: ApolloLink.from([apolloAuthInterceptor, httpLink]),
  cache: new InMemoryCache(),
  devtools: { enabled: false },
});

export default client;
