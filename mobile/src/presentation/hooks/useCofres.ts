import {useCallback, useEffect, useRef, useState} from 'react';

import type {GerenciarCofres} from '../../domain/casosDeUso/GerenciarCofres';
import {resumoCofres, type ResumoCofres} from '../../domain/cofres';
import type {
  Cofre,
  DadosCofre,
  MovimentoCofre,
} from '../../domain/entities/Cofre';
import type {CofreRepository} from '../../domain/repositories/CofreRepository';
import {mensagemDeErro} from '../utils/mensagemDeErro';

export interface EstadoCofres {
  cofres: Cofre[];
  resumo: ResumoCofres;
  disponivelCentavos: number;
  carregando: boolean;
  erro: string | null;
}

export interface UseCofres extends EstadoCofres {
  recarregar: () => Promise<void>;
  criar: (dados: DadosCofre) => Promise<void>;
  atualizar: (id: number, dados: DadosCofre) => Promise<void>;
  excluir: (id: number) => Promise<void>;
  guardar: (cofreId: number, valorCentavos: number) => Promise<void>;
  retirar: (cofreId: number, valorCentavos: number) => Promise<void>;
  listarMovimentos: (
    cofreId: number,
    limite: number,
  ) => Promise<MovimentoCofre[]>;
}

export function useCofres(
  gerenciar: GerenciarCofres,
  repositorio: CofreRepository,
  aoAlterar?: () => Promise<void> | void,
): UseCofres {
  const [estado, setEstado] = useState<EstadoCofres>({
    cofres: [],
    resumo: resumoCofres([]),
    disponivelCentavos: 0,
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
      const [cofres, disponivelCentavos] = await Promise.all([
        repositorio.listar(),
        gerenciar.disponivel(),
      ]);
      if (ehAMaisRecente()) {
        setEstado({
          cofres,
          resumo: resumoCofres(cofres),
          disponivelCentavos,
          carregando: false,
          erro: null,
        });
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
  }, [gerenciar, repositorio]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const depoisDeAlterar = useCallback(async () => {
    await Promise.all([recarregar(), aoAlterarRef.current?.()]);
  }, [recarregar]);

  const criar = useCallback(
    async (dados: DadosCofre) => {
      await gerenciar.criar(dados);
      await depoisDeAlterar();
    },
    [gerenciar, depoisDeAlterar],
  );

  const atualizar = useCallback(
    async (id: number, dados: DadosCofre) => {
      await gerenciar.atualizar(id, dados);
      await depoisDeAlterar();
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

  const guardar = useCallback(
    async (cofreId: number, valorCentavos: number) => {
      await gerenciar.guardar(cofreId, valorCentavos);
      await depoisDeAlterar();
    },
    [gerenciar, depoisDeAlterar],
  );

  const retirar = useCallback(
    async (cofreId: number, valorCentavos: number) => {
      await gerenciar.retirar(cofreId, valorCentavos);
      await depoisDeAlterar();
    },
    [gerenciar, depoisDeAlterar],
  );

  const listarMovimentos = useCallback(
    (cofreId: number, limite: number) =>
      repositorio.listarMovimentos(cofreId, limite),
    [repositorio],
  );

  return {
    ...estado,
    recarregar,
    criar,
    atualizar,
    excluir,
    guardar,
    retirar,
    listarMovimentos,
  };
}
