import type { ResourcesConfig } from 'aws-amplify';

const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_APP_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_APP_USER_POOL_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_APP_COGNITO_DOMAIN,
          scopes: ['openid', 'email', 'phone'],
          redirectSignIn: [import.meta.env.VITE_APP_REDIRECT_URI],
          redirectSignOut: [import.meta.env.VITE_APP_POST_LOGOUT_REDIRECT_URI],
          responseType: 'code'
        }
      }
    }
  }
};

export default amplifyConfig;