import { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('permite métodos seguros sin comprobar CSRF', () => {
    expect(
      guard.canActivate(buildContext({ method: 'GET', headers: {} })),
    ).toBe(true);
  });

  it('permite métodos que modifican estado cuando no hay sesión', () => {
    expect(
      guard.canActivate(
        buildContext({ method: 'POST', headers: {}, cookies: {} }),
      ),
    ).toBe(true);
  });

  it('rechaza si la cookie y la cabecera CSRF no coinciden', () => {
    expect(() =>
      guard.canActivate(
        buildContext({
          method: 'POST',
          headers: { 'x-csrf-token': 'aaa' },
          cookies: { refresh_token: 'r', csrf_token: 'bbb' },
        }),
      ),
    ).toThrow();
  });

  it('permite si cookie y cabecera coinciden', () => {
    expect(
      guard.canActivate(
        buildContext({
          method: 'POST',
          headers: { 'x-csrf-token': 'igual' },
          cookies: { refresh_token: 'r', csrf_token: 'igual' },
        }),
      ),
    ).toBe(true);
  });
});
