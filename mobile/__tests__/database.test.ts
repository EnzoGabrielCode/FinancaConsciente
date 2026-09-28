import {expect, it} from '@jest/globals';
import {getSchemaVersion} from '../src/data/database/connection';
import {migrations} from '../src/data/database/migrations';

it('aplica todas as migrações ao abrir o banco local', async () => {
  await expect(getSchemaVersion()).resolves.toBe(migrations.length);
});
