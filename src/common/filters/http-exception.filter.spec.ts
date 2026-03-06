import {
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(url = '/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
    json,
    status,
  } as any;
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('returns the HTTP status code of the exception', () => {
    const host = makeHost();
    filter.catch(new NotFoundException('recurso no encontrado'), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('includes path and timestamp in the response body', () => {
    const host = makeHost('/invoices');
    filter.catch(new NotFoundException(), host);

    const body = host.json.mock.calls[0][0];
    expect(body.path).toBe('/invoices');
    expect(body.timestamp).toBeDefined();
  });

  it('extracts validation messages array from BadRequestException', () => {
    const host = makeHost();
    const exception = new BadRequestException({
      message: ['field is required', 'field must be a string'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, host);

    const body = host.json.mock.calls[0][0];
    expect(body.message).toEqual(['field is required', 'field must be a string']);
    expect(body.statusCode).toBe(400);
  });

  it('returns 500 for unexpected non-HTTP errors', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const host = makeHost();

    filter.catch(new Error('something exploded'), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = host.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    consoleSpy.mockRestore();
  });

  it('does not leak internal error details on 500', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const host = makeHost();

    filter.catch(new Error('db password: secret123'), host);

    const body = host.json.mock.calls[0][0];
    expect(body.message).not.toContain('secret123');
    consoleSpy.mockRestore();
  });

  it('handles plain HttpException with string message', () => {
    const host = makeHost();
    filter.catch(new HttpException('forbidden', HttpStatus.FORBIDDEN), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const body = host.json.mock.calls[0][0];
    expect(body.message).toBe('forbidden');
  });
});
