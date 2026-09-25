import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { from, throwError, type Observable } from 'rxjs';
import { catchError, mergeMap, switchMap } from 'rxjs/operators';
import { gravarAuditoriaHttp } from './auditar-escrita';
import { RespostaComErro } from './erros-http';
import type { Contato } from './schemas/contato.schema';
import type { ContatoAuditoria } from './schemas/contato-auditoria.schema';
import type { RequisicaoComUsuario } from './sessao.middleware';

const CAMPOS_AUTORIA = ['criadoPor', 'criadoEm', 'alteradoPor', 'alteradoEm'] as const;

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    @InjectModel('Contato') private readonly contatos: Model<Contato>,
    @InjectModel('ContatoAuditoria') private readonly auditoria: Model<ContatoAuditoria>,
  ) {}

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = contexto
      .switchToHttp()
      .getRequest<RequisicaoComUsuario & { params?: { id?: string } }>();
    descartarAutoriaDoCliente(req.body);
    const id = req.params?.id;
    const mutacao = req.method === 'PATCH' || req.method === 'POST';
    const antes =
      mutacao && id && Types.ObjectId.isValid(id)
        ? this.contatos.findById(id).lean()
        : Promise.resolve(null);
    return from(antes).pipe(
      switchMap((documento) =>
        next.handle().pipe(
          mergeMap(async (corpo) => {
            await this.auditar(documento as Record<string, unknown> | null, corpo, req);
            return corpo;
          }),
          catchError((erro: unknown) =>
            from(this.auditarErro(documento as Record<string, unknown> | null, erro, req)).pipe(
              mergeMap(() => throwError(() => erro)),
            ),
          ),
        ),
      ),
    );
  }

  private async auditar(
    antes: Record<string, unknown> | null,
    corpo: unknown,
    req: RequisicaoComUsuario,
  ): Promise<void> {
    if (!req.usuario?.id || !corpo || typeof corpo !== 'object' || !('dados' in corpo)) return;
    const dados = (corpo as { dados?: unknown }).dados;
    if (!dados || typeof dados !== 'object') return;
    await gravarAuditoriaHttp(
      this.auditoria,
      antes ? (JSON.parse(JSON.stringify(antes)) as Record<string, unknown>) : null,
      dados as Record<string, unknown>,
      req.usuario.id,
      req.usuario.nome,
    );
  }

  private async auditarErro(
    antes: Record<string, unknown> | null,
    erro: unknown,
    req: RequisicaoComUsuario,
  ) {
    if (!(erro instanceof RespostaComErro)) return;
    if (erro.codigo === 'CONFLITO_VERSAO') return;
    await this.auditar(antes, { dados: erro.dados }, req);
  }
}

function descartarAutoriaDoCliente(corpo: unknown): void {
  if (!corpo || typeof corpo !== 'object') return;
  const registro = corpo as Record<string, unknown>;
  const presentes = CAMPOS_AUTORIA.filter((campo) => registro[campo] != null);
  if (presentes.length === 0) return;
  console.warn(
    JSON.stringify({
      nivel: 'WARN',
      evento: 'tentativa_autoria_cliente',
      campos: presentes,
      em: new Date().toISOString(),
    }),
  );
  for (const campo of presentes) delete registro[campo];
}
