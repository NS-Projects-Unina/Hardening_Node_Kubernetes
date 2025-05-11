import axios from "axios";
import attachAuthInterceptor from "./interceptors/attachAuth";
const apiEnpoint = import.meta.env.VITE_API_ENDPOINT;
const userApi = axios.create({
  baseURL: `https://${apiEnpoint}/user`,
  withCredentials: true,
});

attachAuthInterceptor(userApi);

export default userApi;
