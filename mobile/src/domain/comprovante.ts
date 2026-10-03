export const TIPOS_COMPROVANTE = ['image/jpeg', 'image/png'] as const;

export const MAX_BYTES_COMPROVANTE = 10 * 1024 * 1024;

export interface ImagemComprovante {
  tipoMime: string;
  tamanhoBytes?: number;
}

export function validarImagemComprovante({
  tipoMime,
  tamanhoBytes,
}: ImagemComprovante): string | null {
  if (!(TIPOS_COMPROVANTE as readonly string[]).includes(tipoMime)) {
    return 'Formato não suportado. Use JPG ou PNG.';
  }
  if (tamanhoBytes !== undefined && tamanhoBytes > MAX_BYTES_COMPROVANTE) {
    return 'A foto passa de 10 MB.';
  }
  return null;
}
