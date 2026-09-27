export function Marca({
  grande = false,
  clara = false,
  central = false,
}: {
  grande?: boolean;
  clara?: boolean;
  central?: boolean;
}) {
  const lado = grande ? 'h-28 w-28' : 'h-14 w-14';
  return (
    <div className={`flex items-center gap-4 ${central ? 'flex-col text-center' : ''}`}>
      <img
        src="/marca/simbolo.png"
        alt=""
        className={`${lado} object-contain`}
        width={grande ? 112 : 56}
        height={grande ? 112 : 56}
      />
      <div>
        <p
          className={`font-marca font-semibold leading-none tracking-wide ${grande ? 'text-4xl' : 'text-2xl'}`}
          style={{ color: clara ? '#fffdfb' : undefined }}
        >
          TattooArt
        </p>
        <p className="mt-2 text-sm" style={{ color: clara ? '#e7d3a1' : 'var(--lilas)' }}>
          Cuidados para pele tatuada
        </p>
      </div>
    </div>
  );
}
