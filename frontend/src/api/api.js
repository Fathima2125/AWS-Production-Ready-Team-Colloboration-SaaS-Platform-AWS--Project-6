// import axios from "axios";

// const API_URL = "https://v53duytyr1.execute-api.us-east-1.amazonaws.com/dev";

// export const api = axios.create({
//   baseURL: API_URL
// });

// // attach token automatically
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");

//   if (token) {
//   config.headers.Authorization = `Bearer ${token}`;
//   }

//   return config;
// });

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem("token");
//       window.location.href = "/login";
//     }
//     return Promise.reject(error);
//   }
// );

import axios from "axios";

const API_URL = "https://79rvoo3kji.execute-api.us-east-1.amazonaws.com/Prod";

export const api = axios.create({
  baseURL: API_URL,
});

// attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);