import {
  exemplosDoDicionario,
  PESO_HISTORICO,
  sugerir,
  treinar,
  type Exemplo,
  type Modelo,
  type Sugestao,
} from '../categorizador';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

export const LIMITE_HISTORICO = 500;

export class SugerirCategoria {
  private readonly soDicionario: Modelo = treinar(exemplosDoDicionario());
  private modelo: Modelo | null = null;
  // Muda a cada invalidar(): um preparar() que começou antes não grava o
  // modelo velho por cima.
  private geracao = 0;

  constructor(private readonly transacoes: TransacaoRepository) {}

  async preparar(): Promise<void> {
    if (this.modelo) {
      return;
    }
    const geracao = this.geracao;
    let historico: Exemplo[] = [];
    try {
      historico = (
        await this.transacoes.exemplosDeCategoria(LIMITE_HISTORICO)
      ).map(({descricao, categoria}) => ({
        texto: descricao,
        categoria,
        peso: PESO_HISTORICO,
      }));
    } catch {
      // Sem o histórico, o dicionário ainda sugere as categorias óbvias.
      return;
    }
    if (geracao === this.geracao) {
      this.modelo = treinar([...exemplosDoDicionario(), ...historico]);
    }
  }

  invalidar(): void {
    this.geracao++;
    this.modelo = null;
  }

  sugerir(texto: string): Sugestao | null {
    try {
      return sugerir(this.modelo ?? this.soDicionario, texto);
    } catch {
      return null;
    }
  }
}

export type SugeridorCategoria = Pick<SugerirCategoria, 'preparar' | 'sugerir'>;
