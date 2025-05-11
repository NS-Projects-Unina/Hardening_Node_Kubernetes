import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Provider } from "react-redux";
import { store } from "./app/store";
import { ApolloProvider } from "@apollo/client";
import client from "./services/graphql/apolloClient.js";
import { SnackbarProvider } from "notistack";
createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <ApolloProvider client={client}>
      <SnackbarProvider
        maxSnack={3}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <App />
      </SnackbarProvider>
    </ApolloProvider>
  </Provider>
);
