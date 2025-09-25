export {};

/**
 * @description Here's a way to extend the global interfaces.
 */
declare global {
  interface IRequestUser {
    id: number;
    email: string;
    username: string;
    phone: number;
    ext: number;
    role?: string;
  }

  interface IResultFilter {
    data: Record<string, unknown> | unknown;
    total: number;
    totalData: number;
  }

  interface IConstructBaseResponse<T = unknown> {
    statusCode: number;
    message: string;
    data: T;
  }

  interface IConstructPageMeta {
    page: number;
    pageCount?: number;
    size: number;
    total: number;
    totalData: number;
  }

  interface ICustomRequestHeaders extends Request {
    user: IRequestUser;
  }

  interface IValidateJWTStrategy {
    sub: string;
    name: string;
  }
}
