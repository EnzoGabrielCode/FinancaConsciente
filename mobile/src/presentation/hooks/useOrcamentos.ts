import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import type {GerenciarOrcamentos} from '../../domain/casosDeUso/GerenciarOrcamentos';
import {hojeISO} from '../../domain/datas';
import type {
  DadosOrcamento,
  PainelOrcamentos,
} from '../../domain/entities/Orcamento';
import {resumir} from '../../domain/orcamentos';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export interface EstadoOrcamentos extends PainelOrcamentos {
  carregando: boolean;
  erro: string | null;
}

export interface UseOrcamentos extends EstadoOrcamentos {
  recarregar: () => Promise<void>;
  salvar: (dados: DadosOrcamento) => Promise<void>;
  excluir: (id: number) => Promise<void>;
  pedirPermissao: () => Promise<boolean>;
}

// gatilhoRecarga: qualquer valor que mude quando os lançamentos mudam.
export function useOrcamentos(
  gerenciar: GerenciarOrcamentos,
  gatilhoRecarga?: unknown,
): UseOrcamentos {
  const [estado, setEstado] = useState<EstadoOrcamentos>(() => ({
    progressos: [],
    resumo: resumir([], hojeISO()),
    categoriasLivres: [],
    carregando: true,
    erro: null,
  }));
  const montado = useRef(true);
  const ultimaCarga = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const recarregar = useCallback(async () => {
    const carga = ++ultimaCarga.current;
    const ehAMaisRecente = () =>
      montado.current && carga === ultimaCarga.current;
    try {
      const painel = await gerenciar.carregar(hojeISO());
      if (ehAMaisRecente()) {
        setEstado({...painel, carregando: false, erro: null});
      }
    } catch (erro) {
      if (ehAMaisRecente()) {
        setEstado(atual => ({
          ...atual,
          carregando: false,
          erro: mensagemDeErro(erro),
        }));
      }
    }
  }, [gerenciar]);

  useEffect(() => {
    recarregar();
  }, [recarregar, gatilhoRecarga]);

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', estadoApp => {
      if (estadoApp === 'active') {
        recarregar();
      }
    });
    return () => assinatura.remove();
  }, [recarregar]);

  const salvar = useCallback(
    async (dados: DadosOrcamento) => {
      await gerenciar.salvar(dados);
      await recarregar();
    },
    [gerenciar, recarregar],
  );

  const excluir = useCallback(
    async (id: number) => {
      await gerenciar.excluir(id);
      await recarregar();
    },
    [gerenciar, recarregar],
  );

  const pedirPermissao = useCallback(
    () => gerenciar.pedirPermissao(),
    [gerenciar],
  );

  return {...estado, recarregar, salvar, excluir, pedirPermissao};
}
