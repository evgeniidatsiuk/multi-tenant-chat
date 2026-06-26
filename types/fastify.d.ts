import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: {
      userId: string;
      tenantId: string;
    };
  }
}
