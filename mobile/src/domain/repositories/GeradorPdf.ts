import type {Relatorio} from '../entities/Relatorio';

export interface GeradorPdf {
  // Devolve o PDF em base64.
  gerar(relatorio: Relatorio, geradoEm: Date): Promise<string>;
}
