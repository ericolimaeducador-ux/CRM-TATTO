import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { aviso, type Aviso } from '../normalizacao/avisos';

@Injectable()
export class AvisosPipe implements PipeTransform {
  async transform(valor: unknown, meta: ArgumentMetadata): Promise<unknown> {
    if (meta.type !== 'body' || !meta.metatype || typeof meta.metatype !== 'function') return valor;
    if (!valor || typeof valor !== 'object') return valor;
    const instancia = plainToInstance(meta.metatype as new () => object, valor);
    const erros = await validate(instancia, {
      skipMissingProperties: true,
      forbidNonWhitelisted: false,
      whitelist: false,
    });
    const avisos: Aviso[] = erros.map((erro) =>
      aviso(
        erro.property,
        'FORMATO_INVALIDO',
        'Este campo veio num formato inesperado. O rascunho continua salvo com o que deu para aproveitar.',
      ),
    );
    return { ...valor, avisosEstrutura: avisos };
  }
}
