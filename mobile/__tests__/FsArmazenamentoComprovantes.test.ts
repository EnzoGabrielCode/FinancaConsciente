import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import RNFS from 'react-native-fs';

import {FsArmazenamentoComprovantes} from '../src/data/arquivos/FsArmazenamentoComprovantes';

const fs = RNFS as unknown as {
  mkdir: jest.Mock<(caminho: string) => Promise<void>>;
  exists: jest.Mock<(caminho: string) => Promise<boolean>>;
  copyFile: jest.Mock<(origem: string, destino: string) => Promise<void>>;
  unlink: jest.Mock<(caminho: string) => Promise<void>>;
};

describe('FsArmazenamentoComprovantes', () => {
  let armazenamento: FsArmazenamentoComprovantes;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.exists.mockResolvedValue(false);
    jest.spyOn(Date, 'now').mockReturnValue(1727700000000);
    armazenamento = new FsArmazenamentoComprovantes();
  });

  it('guardar cria a pasta, copia para /docs/comprovantes e devolve a URI file://', async () => {
    const uri = await armazenamento.guardar(
      'file:///data/cache/rn_image_picker_lib_temp_1.jpg',
    );

    expect(fs.mkdir).toHaveBeenCalledWith('/docs/comprovantes');
    expect(fs.copyFile).toHaveBeenCalledWith(
      '/data/cache/rn_image_picker_lib_temp_1.jpg',
      '/docs/comprovantes/comprovante-1727700000000.jpg',
    );
    expect(uri).toBe('file:///docs/comprovantes/comprovante-1727700000000.jpg');
  });

  it('guardar mantém PNG, usa jpg por padrão e não recria a pasta existente', async () => {
    fs.exists.mockResolvedValue(true);

    await expect(armazenamento.guardar('/cache/foto.PNG')).resolves.toBe(
      'file:///docs/comprovantes/comprovante-1727700000000.png',
    );
    await expect(armazenamento.guardar('/cache/sem-extensao')).resolves.toBe(
      'file:///docs/comprovantes/comprovante-1727700000000.jpg',
    );
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it('ehDefinitivo reconhece a pasta do app com ou sem file://', () => {
    expect(
      armazenamento.ehDefinitivo('file:///docs/comprovantes/comprovante-1.jpg'),
    ).toBe(true);
    expect(
      armazenamento.ehDefinitivo('/docs/comprovantes/comprovante-1.jpg'),
    ).toBe(true);
    expect(armazenamento.ehDefinitivo('file:///cache/temp.jpg')).toBe(false);
    expect(
      armazenamento.ehDefinitivo('file:///docs/comprovantes-falsos/a.jpg'),
    ).toBe(false);
  });

  it('apagar remove o arquivo existente', async () => {
    fs.exists.mockResolvedValue(true);

    await armazenamento.apagar('file:///docs/comprovantes/a.jpg');

    expect(fs.exists).toHaveBeenCalledWith('/docs/comprovantes/a.jpg');
    expect(fs.unlink).toHaveBeenCalledWith('/docs/comprovantes/a.jpg');
  });

  it('apagar ignora arquivo inexistente', async () => {
    await expect(
      armazenamento.apagar('file:///docs/comprovantes/sumiu.jpg'),
    ).resolves.toBeUndefined();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('apagar ignora erros do sistema de arquivos', async () => {
    fs.exists.mockResolvedValue(true);
    fs.unlink.mockRejectedValueOnce(new Error('EACCES'));

    await expect(
      armazenamento.apagar('file:///docs/comprovantes/a.jpg'),
    ).resolves.toBeUndefined();
  });
});
