import { Configuration } from '../../generated/api/runtime';

// Configure the API client to use the correct backend URL
export const apiConfig = new Configuration({
  basePath: 'http://127.0.0.1:3001/api',
});