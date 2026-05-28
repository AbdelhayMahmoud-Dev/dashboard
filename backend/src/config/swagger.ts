import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'SaaS Dashboard API',
      version: '1.0.0',
      description: 'Enterprise-grade SaaS admin dashboard REST API',
      contact: { name: 'API Support', email: 'support@example.com' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: 'https://your-api.onrender.com/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtained from /auth/login',
        },
      },
      schemas: {
        // ── Pagination ─────────────────────────────────────────────────
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 243 },
            pages: { type: 'integer', example: 25 },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'AUTH_INVALID_CREDENTIALS' },
            message: { type: 'string', example: 'Invalid email or password' },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
        // ── Auth ───────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@example.com' },
            password: { type: 'string', example: 'Admin@1234' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            accessToken: { type: 'string' },
          },
        },
        // ── User ───────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['super_admin', 'admin', 'manager', 'viewer'] },
            avatar: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            permissions: { type: 'array', items: { type: 'string' } },
            lastLogin: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Product ────────────────────────────────────────────────────
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            comparePrice: { type: 'number', nullable: true },
            category: { type: 'string' },
            sku: { type: 'string' },
            stock: { type: 'integer' },
            images: { type: 'array', items: { type: 'string' } },
            thumbnail: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive', 'draft'] },
            isFeatured: { type: 'boolean' },
            totalSales: { type: 'integer' },
            rating: { type: 'number' },
            reviewCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Order ──────────────────────────────────────────────────────
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            orderNumber: { type: 'string', example: 'ORD-ABC12345' },
            customer: { $ref: '#/components/schemas/Customer' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            subtotal: { type: 'number' },
            tax: { type: 'number' },
            shipping: { type: 'number' },
            discount: { type: 'number' },
            total: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
            paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
            paymentMethod: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            product: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            quantity: { type: 'integer' },
            subtotal: { type: 'number' },
          },
        },
        // ── Customer ───────────────────────────────────────────────────
        Customer: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive', 'banned'] },
            totalOrders: { type: 'integer' },
            totalSpent: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
        ValidationError: {
          description: 'Request validation failed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & session management' },
      { name: 'Products', description: 'Product catalogue CRUD' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Customers', description: 'Customer management' },
      { name: 'Analytics', description: 'Dashboard metrics & charts' },
      { name: 'Users', description: 'Admin user management' },
      { name: 'Health', description: 'Service health & readiness probes' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
