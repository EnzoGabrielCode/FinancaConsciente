import {MlKitReconhecedor} from '../../data/servicos/MlKitReconhecedor';
import {LerRecibo} from '../../domain/casosDeUso/LerRecibo';

export const lerReciboPadrao = new LerRecibo(new MlKitReconhecedor());
