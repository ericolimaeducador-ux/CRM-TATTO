export function Marca({ grande = false }: { grande?: boolean }) {
  const lado = grande ? 'h-24 w-24' : 'h-14 w-14';
  return (
    <div className="flex items-center gap-3">
      <img
        src="/marca/simbolo.png"
        alt=""
        className={`${lado} object-contain`}
        width={grande ? 96 : 56}
        height={grande ? 96 : 56}
      />
      <div>
        <p className="font-marca text-2xl font-semibold leading-none tracking-wide">TattooArt</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--lilas)' }}>
          Cuidados para pele tatuada
        </p>
      </div>
    </div>
  );
}
