import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import type {GerenciarContasRecorrentes} from '../../domain/casosDeUso/GerenciarContasRecorrentes';
import {hojeISO} from '../../domain/datas';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
  PainelContasRecorrentes,
} from '../../domain/entities/ContaRecorrente';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export interface EstadoContasRecorrentes extends PainelContasRecorrentes {
  carregando: boolean;
  erro: string | null;
}

export interface UseContasRecorrentes extends EstadoContasRecorrentes {
  recarregar: () => Promise<void>;
  salvar: (dados: DadosContaRecorrente, id?: number) => Promise<number>;
  excluir: (id: number) => Promise<void>;
  pausar: (id: number) => Promise<void>;
  retomar: (id: number) => Promise<void>;
  pedirPermissao: () => Promise<boolean>;
  testarLembrete: (conta: ContaRecorrente) => Promise<void>;
}

// gatilhoRecarga: qualquer valor que mude quando os lançamentos mudam.
export function useContasRecorrentes(
  gerenciar: GerenciarContasRecorrentes,
  gatilhoRecarga?: unknown,
  aoAlterar?: () => Promise<void> | void,
): UseContasRecorrentes {
  const [estado, setEstado] = useState<EstadoContasRecorrentes>({
    contas: [],
    totalMensal: 0,
    carregando: true,
    erro: null,
  });
  const montado = useRef(true);
  const ultimaCarga = useRef(0);
  const aoAlterarRef = useRef(aoAlterar);
  aoAlterarRef.current = aoAlterar;

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

  const depoisDeAlterar = useCallback(async () => {
    await Promise.all([recarregar(), aoAlterarRef.current?.()]);
  }, [recarregar]);

  const salvar = useCallback(
    async (dados: DadosContaRecorrente, id?: number) => {
      const lancadas = await gerenciar.salvar(dados, id, hojeISO());
      await depoisDeAlterar();
      return lancadas;
    },
    [gerenciar, depoisDeAlterar],
  );

  const excluir = useCallback(
    async (id: number) => {
      await gerenciar.excluir(id);
      await depoisDeAlterar();
    },
    [gerenciar, depoisDeAlterar],
  );

  const pausar = useCallback(
    async (id: number) => {
      await gerenciar.pausar(id);
      await recarregar();
    },
    [gerenciar, recarregar],
  );

  const retomar = useCallback(
    async (id: number) => {
      await gerenciar.retomar(id, hojeISO());
      await recarregar();
    },
    [gerenciar, recarregar],
  );

  const pedirPermissao = useCallback(
    () => gerenciar.pedirPermissao(),
    [gerenciar],
  );

  const testarLembrete = useCallback(
    (conta: ContaRecorrente) => gerenciar.testarLembrete(conta),
    [gerenciar],
  );

  return {
    ...estado,
    recarregar,
    salvar,
    excluir,
    pausar,
    retomar,
    pedirPermissao,
    testarLembrete,
  };
}
