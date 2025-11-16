import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log the request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Override the end method to log response time
  const originalEnd = res.end;
  res.end = function(chunk?: any): any {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    return originalEnd.call(this, chunk);
  };
  
  next();
};