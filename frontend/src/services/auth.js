import axios from "axios";
import attachAuthInterceptor from "./interceptors/attachAuth";
const apiEnpoint = import.meta.env.VITE_API_ENDPOINT;

const authApi = axios.create({
  baseURL: `https://${apiEnpoint}/auth`,
  withCredentials: true,
});

attachAuthInterceptor(authApi);

export default authApi;
