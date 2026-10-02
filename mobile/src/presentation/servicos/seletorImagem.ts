import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';

export interface ImagemSelecionada {
  uri: string;
  tipoMime: string;
  tamanhoBytes?: number;
}

export interface SeletorImagem {
  tirarFoto(): Promise<ImagemSelecionada | null>;
  escolherDaGaleria(): Promise<ImagemSelecionada | null>;
}

const OPCOES: CameraOptions & ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.7,
  maxWidth: 1600,
  maxHeight: 1600,
  includeBase64: false,
  saveToPhotos: false,
  selectionLimit: 1,
};

function tipoPelaExtensao(uri: string): string {
  if (/\.png$/i.test(uri)) {
    return 'image/png';
  }
  return /\.jpe?g$/i.test(uri) ? 'image/jpeg' : '';
}

export function paraImagemSelecionada(
  resposta: ImagePickerResponse,
): ImagemSelecionada | null {
  if (resposta.didCancel) {
    return null;
  }
  if (resposta.errorCode === 'camera_unavailable') {
    throw new Error('Câmera indisponível neste aparelho.');
  }
  if (resposta.errorCode === 'permission') {
    throw new Error('Sem permissão para usar a câmera.');
  }
  if (resposta.errorCode) {
    throw new Error(
      resposta.errorMessage ?? 'Não foi possível abrir a imagem.',
    );
  }
  const asset = resposta.assets?.[0];
  if (!asset?.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    tipoMime: asset.type ?? tipoPelaExtensao(asset.uri),
    tamanhoBytes: asset.fileSize,
  };
}

export const seletorImagemPadrao: SeletorImagem = {
  tirarFoto: async () => paraImagemSelecionada(await launchCamera(OPCOES)),
  escolherDaGaleria: async () =>
    paraImagemSelecionada(await launchImageLibrary(OPCOES)),
};
