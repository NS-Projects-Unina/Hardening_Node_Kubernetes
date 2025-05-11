import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authApi from "../../services/auth";
import client from "../../services/graphql/apolloClient";
import { GET_ME } from "../../services/graphql/queries";

const initialState = {
  isAuthenticated: false,
  user: null,
  loading: true,
};

export const checkAuth = createAsyncThunk(
  "auth/checkAuth",
  async (_, thunkAPI) => {
    try {
      await authApi.get("/introspect");
      const { data } = await client.query({
        query: GET_ME,
        fetchPolicy: "no-cache",
      });
      return data.me;
    } catch (err) {
      return thunkAPI.rejectWithValue("Not authenticated");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthenticated: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
    },
    setUnauthenticated: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
      });
  },
});

export const { setAuthenticated, setUnauthenticated, setLoading } =
  authSlice.actions;
export default authSlice.reducer;
