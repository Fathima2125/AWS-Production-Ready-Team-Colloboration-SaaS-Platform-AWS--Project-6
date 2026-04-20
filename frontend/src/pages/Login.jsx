// const Login = () => {
//   const login = () => {
//     const domain = "https://us-east-1xz19cfxgb.auth.us-east-1.amazoncognito.com";
//     const clientId = "5e6i2kn5trgm93dg70shpqq99u";
//     const redirectUri = "https://d3fy3oood6gz2z.cloudfront.net";

//     const url =
//       `${domain}/login?client_id=${clientId}` +
//       `&response_type=token` +
//       `&scope=openid+email+profile` +
//       `&redirect_uri=${encodeURIComponent(redirectUri)}`;

//     console.log("LOGIN URL:", url); // 👈 add this

//     window.location.href = url;
//   };

//   return (
//     <div>
//       <h2>Login</h2>
//       <button onClick={login}>Login with Cognito</button>
//     </div>
//   );
// };

// export default Login;

const Login = () => {
  const login = () => {
    const domain =
      "https://saas-collab-app-506098131053.auth.us-east-1.amazoncognito.com";

    const clientId = "7hda5e26p4nqgc8ul9g6tgeus8";

    const redirectUri = "https://d3brddi7c2rvyc.cloudfront.net";

    const url =
      `${domain}/login?client_id=${clientId}` +
      `&response_type=token` +
      `&scope=openid+email+profile` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    window.location.href = url;
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Login</h2>
      <button onClick={login}>Login with Cognito</button>
    </div>
  );
};

export default Login;