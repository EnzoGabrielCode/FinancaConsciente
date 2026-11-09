import TextRecognition, {
  type Frame,
  type TextBlock,
} from '@react-native-ml-kit/text-recognition';

import type {
  ReconhecedorTexto,
  TrechoReconhecido,
} from '../../domain/repositories/ReconhecedorTexto';

// Bloco sem posição: um após o outro, longe o bastante para não se misturarem.
const ALTURA_SEM_POSICAO = 1000;

function trechosDoBloco(
  bloco: TextBlock,
  indiceBloco: number,
): TrechoReconhecido[] {
  const quadro: Frame = bloco.frame ?? {
    top: indiceBloco * ALTURA_SEM_POSICAO,
    left: 0,
    width: 0,
    height: ALTURA_SEM_POSICAO,
  };
  const alturaLinha = quadro.height / Math.max(bloco.lines.length, 1);
  return bloco.lines.map((linha, i) =>
    linha.frame
      ? {
          texto: linha.text,
          topo: linha.frame.top,
          altura: linha.frame.height,
          esquerda: linha.frame.left,
        }
      : // Linhas sem posição dividem a altura do bloco, na ordem em que vieram;
        // com a posição do bloco inteiro todas virariam uma linha só.
        {
          texto: linha.text,
          topo: quadro.top + i * alturaLinha,
          altura: alturaLinha,
          esquerda: quadro.left,
        },
  );
}

export class MlKitReconhecedor implements ReconhecedorTexto {
  async reconhecer(uri: string): Promise<TrechoReconhecido[]> {
    const resultado = await TextRecognition.recognize(uri);
    return resultado.blocks.flatMap(trechosDoBloco);
  }
}
