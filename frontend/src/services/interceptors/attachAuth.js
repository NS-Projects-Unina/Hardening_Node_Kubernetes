import axios from "axios";
import { store } from "../../app/store";
import {
  setAuthenticated,
  setUnauthenticated,
} from "../../features/auth/authSlice";
import client from "../graphql/apolloClient";
import { GET_ME } from "../graphql/queries";
const apiEnpoint = import.meta.env.VITE_API_ENDPOINT;

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

const attachAuthInterceptor = (axiosInstance) => {
  axiosInstance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url.includes("/refresh") &&
        !originalRequest.url.includes("/logout")
      ) {
        originalRequest._retry = true;

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: () => resolve(axiosInstance(originalRequest)),
              reject: (err) => reject(err),
            });
          });
        }

        isRefreshing = true;

        try {
          await axios.get(`https://${apiEnpoint}/auth/refresh`, {
            withCredentials: true,
          });

          try {
            const { data } = await client.query({
              query: GET_ME,
              fetchPolicy: "no-cache",
            });
            store.dispatch(setAuthenticated(data.me));
          } catch {
            store.dispatch(setAuthenticated());
          }

          processQueue(null);
          return axiosInstance(originalRequest);
        } catch (err) {
          processQueue(err, null);
          store.dispatch(setUnauthenticated());
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
};

export default attachAuthInterceptor;
