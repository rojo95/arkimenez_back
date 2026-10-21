import * as Joi from 'joi';
import { JoiValidationPipe } from './joi-validation.pipe';
import { AppException } from '../errors/app-exception';

const schema = Joi.object({
  email: Joi.string().email().required(),
  quantity: Joi.number().integer().min(1).required(),
});

describe('JoiValidationPipe', () => {
  const pipe = new JoiValidationPipe(schema);

  it('devuelve el valor validado y convertido', () => {
    const result = pipe.transform({ email: 'a@b.com', quantity: '3' });

    expect(result).toEqual({ email: 'a@b.com', quantity: 3 });
  });

  it('lanza AppException con los campos inválidos', () => {
    expect(() => pipe.transform({ email: 'no-es-email' })).toThrow(
      AppException,
    );

    try {
      pipe.transform({ email: 'no-es-email' });
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const details = (error as AppException).details;
      expect(details.map((detail) => detail.field).sort()).toEqual([
        'email',
        'quantity',
      ]);
    }
  });

  it('rechaza campos desconocidos (sin asignación masiva)', () => {
    expect(() =>
      pipe.transform({
        email: 'a@b.com',
        quantity: 1,
        role: 'OWNER',
      }),
    ).toThrow(AppException);
  });
});
