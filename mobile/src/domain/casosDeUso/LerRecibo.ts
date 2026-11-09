import type {DadosRecibo} from '../entities/Recibo';
import {extrairDadosRecibo} from '../recibo';
import type {ReconhecedorTexto} from '../repositories/ReconhecedorTexto';

export class LerRecibo {
  constructor(private readonly reconhecedor: ReconhecedorTexto) {}

  // Nunca lança: sem leitura a pessoa só digita os dados como sempre.
  async ler(uri: string, hoje: string): Promise<DadosRecibo | null> {
    try {
      return extrairDadosRecibo(await this.reconhecedor.reconhecer(uri), hoje);
    } catch {
      return null;
    }
  }
}
