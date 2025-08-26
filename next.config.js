/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  // Disable the Next.js development indicator
  devIndicators: false,
  // Optimize chunk loading
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Webpack configuration to handle chunk loading issues
  webpack: (config, { dev, isServer }) => {
    // Only apply optimizations for client-side builds
    if (!isServer) {
      // Optimize chunk splitting with better cache handling
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Create a vendor chunk for node_modules
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]/,
            priority: 20,
            reuseExistingChunk: true,
          },
          // Create a common chunk for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: false, // Remove enforce to prevent conflicts
          },
        },
      };

      // Optimize cache serialization to reduce large string warnings
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: require('path').resolve(__dirname, '.next/cache'),
        compression: 'gzip',
        maxAge: 172800000, // 2 days
        store: 'pack',
        allowCollectingMemory: true,
      };

      // Add performance hints to identify large chunks
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
      };
    }

    return config;
  },
};

module.exports = nextConfig;