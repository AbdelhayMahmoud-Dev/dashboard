export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000',
  appName: 'SaaS Dashboard',
  defaultPageSize: 10,
  pageSizeOptions: [10, 20, 50, 100],
  queryStaleTime: 1000 * 60 * 5,        // 5 minutes
  queryCacheTime: 1000 * 60 * 10,       // 10 minutes
  authQueryStaleTime: 1000 * 60 * 10,   // 10 minutes
  analyticsStaleTime: 1000 * 60 * 5,    // 5 minutes
  maxUploadSize: 10 * 1024 * 1024,      // 10MB
  maxImagesPerProduct: 10,
  toastDuration: 4000,
} as const;

export type Config = typeof config;
