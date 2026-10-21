import { Sequelize } from 'sequelize-typescript';
import { AppException } from '../../shared/errors/app-exception';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let authenticate: jest.Mock;
  let service: HealthService;

  beforeEach(() => {
    authenticate = jest.fn();
    const sequelize = { authenticate } as unknown as Sequelize;
    service = new HealthService(sequelize);
  });

  it('informa estado ok cuando la base de datos responde', async () => {
    authenticate.mockResolvedValue(undefined);

    const result = await service.check();

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('responde 503 con el formato de error único si la base de datos falla', async () => {
    authenticate.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
    });
    await expect(service.check()).rejects.toBeInstanceOf(AppException);
  });
});
