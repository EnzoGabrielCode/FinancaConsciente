import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import type {Cofre, DadosCofre} from '../src/domain/entities/Cofre';
import CofreFormSheet, {
  filtrarMeta,
} from '../src/presentation/components/CofreFormSheet';
import {darkTheme} from '../src/presentation/theme';

let tree: ReactTestRenderer;
let criar: jest.Mock<(dados: DadosCofre) => Promise<void>>;

async function renderizar(
  props: Partial<React.ComponentProps<typeof CofreFormSheet>> = {},
) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <CofreFormSheet
          visivel
          onFechar={() => {}}
          onSalvar={criar}
          {...props}
        />
      </PaperProvider>,
    );
  });
}

const comId = (id: string) => tree.root.findAll(no => no.props.testID === id);

function interativo(id: string, prop: string): ReactTestInstance {
  const [no] = tree.root.findAll(
    n => n.props.testID === id && typeof n.props[prop] === 'function',
  );
  if (!no) {
    throw new Error(`Nada com ${prop} e testID "${id}"`);
  }
  return no;
}

function textoDe(no: ReactTestInstance): string {
  return no.children
    .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
    .join('');
}

async function escrever(id: string, texto: string) {
  await act(async () => {
    interativo(id, 'onChangeText').props.onChangeText(texto);
  });
}

async function tocar(id: string) {
  await act(async () => {
    await interativo(id, 'onPress').props.onPress();
  });
}

const botaoSalvar = () => interativo('cofre-form-salvar', 'onPress');

describe('CofreFormSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    criar = jest.fn(async (_dados: DadosCofre) => {});
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('abre como "Novo Cofre" com o botão desabilitado sem nome', async () => {
    await renderizar();

    expect(textoDe(comId('cofre-form-titulo')[0])).toBe('Novo Cofre');
    expect(botaoSalvar().props.disabled).toBe(true);
    expect(textoDe(botaoSalvar())).toBe('Criar Cofre');

    await escrever('cofre-nome-input', '   ');
    expect(botaoSalvar().props.disabled).toBe(true);

    await escrever('cofre-nome-input', 'Viagem');
    expect(botaoSalvar().props.disabled).toBe(false);
  });

  it('criar com meta "8000" chama criar com metaCentavos 800000', async () => {
    await renderizar();

    await tocar('cofre-icone-✈️');
    await tocar('cofre-cor-#64B5F6');
    await escrever('cofre-nome-input', '  Viagem ');
    await escrever('cofre-meta-input', '8000');
    expect(textoDe(comId('cofre-previa-meta')[0])).toBe('Meta: R$ 8.000,00');

    await tocar('cofre-form-salvar');

    expect(criar).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({
      nome: 'Viagem',
      icone: '✈️',
      cor: '#64B5F6',
      metaCentavos: 800000,
    });
  });

  it('sem meta envia null e mostra "Sem meta" na prévia', async () => {
    await renderizar();

    await escrever('cofre-nome-input', 'Reserva');
    expect(textoDe(comId('cofre-previa-meta')[0])).toBe('Sem meta');
    await tocar('cofre-form-salvar');

    expect(criar).toHaveBeenCalledWith({
      nome: 'Reserva',
      icone: '💰',
      cor: '#39FF84',
      metaCentavos: null,
    });
  });

  it('a meta só aceita o que o teclado numérico aceitaria', async () => {
    expect(filtrarMeta('12a3')).toBe('123');
    expect(filtrarMeta('10,555')).toBe('10,55');
    expect(filtrarMeta('7.5')).toBe('7,5');
    expect(filtrarMeta('0012')).toBe('12');

    await renderizar();
    await escrever('cofre-meta-input', 'abc');
    expect(interativo('cofre-meta-input', 'onChangeText').props.value).toBe('');
  });

  it('mostra o erro de nome repetido em HelperText e não salva', async () => {
    await renderizar({nomesExistentes: ['Viagem']});

    await escrever('cofre-nome-input', 'viagem');
    await tocar('cofre-form-salvar');

    expect(criar).not.toHaveBeenCalled();
    expect(textoDe(comId('cofre-erro-nome')[0])).toBe(
      'Já existe um cofre com esse nome.',
    );
  });

  it('mostra meta zerada como erro', async () => {
    await renderizar();

    await escrever('cofre-nome-input', 'Reserva');
    await escrever('cofre-meta-input', '0,');
    await tocar('cofre-form-salvar');

    expect(criar).not.toHaveBeenCalled();
    expect(textoDe(comId('cofre-erro-meta')[0])).toBe(
      'A meta precisa ser maior que zero.',
    );
  });

  it('mostra o erro do caso de uso sem fechar', async () => {
    const onFechar = jest.fn();
    criar.mockRejectedValueOnce(new Error('Falha no banco'));
    await renderizar({onFechar});

    await escrever('cofre-nome-input', 'Reserva');
    await tocar('cofre-form-salvar');

    expect(textoDe(comId('cofre-form-erro')[0])).toBe('Falha no banco');
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('em edição abre preenchido e o próprio nome não conta como repetido', async () => {
    const cofre: Cofre = {
      id: 3,
      nome: 'Viagem',
      icone: '🏖️',
      cor: '#FFB74D',
      metaCentavos: 800000,
      saldoCentavos: 120000,
    };
    await renderizar({cofre, nomesExistentes: ['Viagem', 'Carro']});

    expect(textoDe(comId('cofre-form-titulo')[0])).toBe('Editar Cofre');
    expect(textoDe(botaoSalvar())).toBe('Salvar alterações');
    expect(interativo('cofre-meta-input', 'onChangeText').props.value).toBe(
      '8000',
    );

    await tocar('cofre-form-salvar');

    expect(criar).toHaveBeenCalledWith({
      nome: 'Viagem',
      icone: '🏖️',
      cor: '#FFB74D',
      metaCentavos: 800000,
    });
  });
});
