import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export function requestContext(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const forwardedRequestId = request.header('x-request-id')?.trim();
  const requestId = forwardedRequestId || randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
