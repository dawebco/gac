import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestContext } from './middleware/request-context';
import { healthRouter } from './routes/health.routes';
import { adminAuthRouter } from './routes/admin-auth.routes';
import { adminRouter } from './routes/admin.routes';
import { portalRouter } from './routes/portal.routes';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(requestContext);
app.use(pinoHttp({ logger }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id', 'X-CSRF-Token'],
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS policy'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

app.get('/', (_request, response) => {
  response.status(200).json({
    service: env.APP_NAME,
    status: 'running',
    health: `${env.API_PREFIX}/health/live`,
  });
});

app.use(`${env.API_PREFIX}/health`, healthRouter);
app.use(`${env.API_PREFIX}/admin/auth`, adminAuthRouter);
app.use(`${env.API_PREFIX}/admin`, adminRouter);
app.use(`${env.API_PREFIX}/portal`, portalRouter);
app.use(notFoundHandler);
app.use(errorHandler);

// Vercel's Express runtime invokes the default export. Keep the named export
// above for the local HTTP server and export the same instance as default for
// serverless deployments.
export default app;
