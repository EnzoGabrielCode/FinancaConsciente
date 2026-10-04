import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import {seletorImagemPadrao} from '../src/presentation/servicos/seletorImagem';

const camera = launchCamera as unknown as jest.Mock<
  () => Promise<ImagePickerResponse>
>;
const galeria = launchImageLibrary as unknown as jest.Mock<
  () => Promise<ImagePickerResponse>
>;

describe('seletorImagemPadrao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('abre a câmera com as opções do comprovante e devolve a imagem', async () => {
    camera.mockResolvedValueOnce({
      assets: [{uri: 'file:///cache/a.jpg', type: 'image/jpeg', fileSize: 10}],
    });

    await expect(seletorImagemPadrao.tirarFoto()).resolves.toEqual({
      uri: 'file:///cache/a.jpg',
      tipoMime: 'image/jpeg',
      tamanhoBytes: 10,
    });
    expect(camera).toHaveBeenCalledWith({
      mediaType: 'photo',
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
      includeBase64: false,
      saveToPhotos: false,
      selectionLimit: 1,
    });
  });

  it('cancelar devolve null', async () => {
    galeria.mockResolvedValueOnce({didCancel: true});
    await expect(seletorImagemPadrao.escolherDaGaleria()).resolves.toBeNull();
  });

  it('traduz os códigos de erro', async () => {
    camera.mockResolvedValueOnce({errorCode: 'camera_unavailable'});
    await expect(seletorImagemPadrao.tirarFoto()).rejects.toThrow(
      'Câmera indisponível neste aparelho.',
    );

    camera.mockResolvedValueOnce({errorCode: 'permission'});
    await expect(seletorImagemPadrao.tirarFoto()).rejects.toThrow(
      'Sem permissão para usar a câmera.',
    );

    galeria.mockResolvedValueOnce({
      errorCode: 'others',
      errorMessage: 'falhou',
    });
    await expect(seletorImagemPadrao.escolherDaGaleria()).rejects.toThrow(
      'falhou',
    );
  });
});
