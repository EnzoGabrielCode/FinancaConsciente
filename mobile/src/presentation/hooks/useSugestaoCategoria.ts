import {useEffect, useState, type Dispatch, type SetStateAction} from 'react';

import type {SugeridorCategoria} from '../../domain/casosDeUso/SugerirCategoria';
import type {Sugestao} from '../../domain/categorizador';

export const ESPERA_SUGESTAO_MS = 250;

type Sugeridor = Pick<SugeridorCategoria, 'sugerir'>;

export function useSugestaoCategoria(
  sugeridor: Sugeridor | undefined,
  descricao: string,
  ativo: boolean,
): Sugestao | null {
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);

  useEffect(() => {
    if (!ativo || !sugeridor) {
      setSugestao(null);
      return;
    }
    const espera = setTimeout(
      () => setSugestao(sugeridor.sugerir(descricao)),
      ESPERA_SUGESTAO_MS,
    );
    return () => clearTimeout(espera);
  }, [sugeridor, descricao, ativo]);

  // Inativo nunca devolve a sugestão antiga, nem antes do efeito rodar.
  return ativo ? sugestao : null;
}

// Aplica a sugestão à categoria enquanto a pessoa não escolheu uma (manual).
// Devolve a categoria que está selecionada por sugestão, para o selo.
export function useCategoriaSugerida(
  sugeridor: Sugeridor | undefined,
  descricao: string,
  ativo: boolean,
  manual: boolean,
  setCategoria: Dispatch<SetStateAction<string | null>>,
): string | null {
  const sugestao = useSugestaoCategoria(sugeridor, descricao, ativo && !manual);
  const [sugerida, setSugerida] = useState<string | null>(null);

  useEffect(() => {
    if (manual) {
      return;
    }
    if (sugestao) {
      setCategoria(sugestao.categoria);
      setSugerida(sugestao.categoria);
    } else if (sugerida !== null) {
      // Só desfaz o que veio da sugestão.
      setCategoria(atual => (atual === sugerida ? null : atual));
      setSugerida(null);
    }
  }, [sugestao, manual, sugerida, setCategoria]);

  return manual ? null : sugerida;
}
