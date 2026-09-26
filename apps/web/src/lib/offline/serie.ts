const seriePorContato = new Map<string, Promise<void>>();

export function emSerie(idLocal: string, trabalho: () => Promise<void>): Promise<void> {
  const anterior = seriePorContato.get(idLocal) ?? Promise.resolve();
  const execucao = anterior.then(trabalho, trabalho);
  seriePorContato.set(
    idLocal,
    execucao.then(
      () => undefined,
      () => undefined,
    ),
  );
  return execucao;
}
