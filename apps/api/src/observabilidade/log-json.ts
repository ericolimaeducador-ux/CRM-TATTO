import type { LoggerService } from '@nestjs/common';

export class LogJson implements LoggerService {
  log(mensagem: unknown, contexto?: string): void {
    this.escrever('INFO', mensagem, contexto);
  }

  error(mensagem: unknown, trilha?: string, contexto?: string): void {
    this.escrever('ERROR', mensagem, contexto, trilha);
  }

  warn(mensagem: unknown, contexto?: string): void {
    this.escrever('WARN', mensagem, contexto);
  }

  debug(mensagem: unknown, contexto?: string): void {
    this.escrever('DEBUG', mensagem, contexto);
  }

  verbose(mensagem: unknown, contexto?: string): void {
    this.escrever('VERBOSE', mensagem, contexto);
  }

  private escrever(nivel: string, mensagem: unknown, contexto?: string, trilha?: string): void {
    const texto = typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem);
    console.log(
      JSON.stringify({
        nivel,
        contexto,
        mensagem: texto,
        trilha,
        em: new Date().toISOString(),
      }),
    );
  }
}
