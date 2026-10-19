import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { HealthStatus } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const check = jest.fn<Promise<HealthStatus>, []>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delega en el servicio y devuelve su resultado', async () => {
    const status: HealthStatus = {
      status: 'ok',
      database: 'up',
      timestamp: '2026-10-19T00:00:00.000Z',
    };
    check.mockResolvedValue(status);

    await expect(controller.check()).resolves.toEqual(status);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
