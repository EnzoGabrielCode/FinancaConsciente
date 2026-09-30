import type {TipoTransacao} from './entities/Transacao';

export interface Categoria {
  id: string;
  label: string;
  icone: string;
  cor: string;
}

export const CATEGORIAS_RECEITA: Categoria[] = [
  {id: 'salario', label: 'Salário', icone: 'cash', cor: '#39FF84'},
  {id: 'freelance', label: 'Freelance', icone: 'laptop', cor: '#64B5F6'},
  {
    id: 'investimentos',
    label: 'Investimentos',
    icone: 'chart-line',
    cor: '#CE93D8',
  },
  {id: 'outros', label: 'Outros', icone: 'wallet-outline', cor: '#9E9E9E'},
];

export const CATEGORIAS_DESPESA: Categoria[] = [
  {id: 'alimentacao', label: 'Alimentação', icone: 'food', cor: '#FFB74D'},
  {id: 'transporte', label: 'Transporte', icone: 'car', cor: '#64B5F6'},
  {id: 'compras', label: 'Compras', icone: 'cart', cor: '#CE93D8'},
  {id: 'saude', label: 'Saúde', icone: 'heart-pulse', cor: '#39FF84'},
  {id: 'lazer', label: 'Lazer', icone: 'gamepad-variant', cor: '#FF6B6B'},
  {id: 'outros', label: 'Outros', icone: 'wallet-outline', cor: '#9E9E9E'},
];

export function categoriasDo(tipo: TipoTransacao): Categoria[] {
  return tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
}

export function buscarCategoria(
  tipo: TipoTransacao,
  id: string,
): Categoria | undefined {
  return categoriasDo(tipo).find(categoria => categoria.id === id);
}
