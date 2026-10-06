import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
});

const { lessons } = await vite.ssrLoadModule('/src/data/lessons.ts');

test.after(async () => {
  await vite.close();
});

await test('catalogo della nuova lezione coerente con video e gating server', async () => {
  const lesson = lessons.find(
    (item) => item.id === 'costruzione-linea-di-passaggio',
  );

  assert.ok(lesson);
  assert.equal(lesson.titolo, 'Libera la linea di passaggio');
  assert.equal(lesson.macroFase, 'possesso');
  assert.equal(lesson.fase, 'costruzione');
  assert.equal(lesson.sistema, '1-3-2-3');
  assert.equal(lesson.punti, 60);
  assert.equal(lesson.disponibilita, 'disponibile');
  assert.equal(lesson.demo, false);
  assert.deepEqual(lesson.concetti, [
    'Linea di passaggio',
    'Smarcamento',
    'Rendersi giocabile',
  ]);
  assert.deepEqual(lesson.variantiVideo, [
    {
      id: 'linea-passaggio',
      etichetta: 'Linea di passaggio',
      percorsoVideo: '/videos/linea-di-passaggio.mp4',
    },
  ]);

  const video = await stat(
    new URL('../public/videos/linea-di-passaggio.mp4', import.meta.url),
  );
  assert.ok(video.isFile());
  assert.ok(video.size > 0);

  const migration = await readFile(
    new URL(
      '../supabase/migrations/202610060001_add_linea_passaggio_lesson.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(migration, /'costruzione-linea-di-passaggio',[\s\S]*?60,[\s\S]*?100,[\s\S]*?0,[\s\S]*?'costruzione',[\s\S]*?'possesso',[\s\S]*?true/);
  assert.match(migration, /'linea-passaggio',[\s\S]*?1,[\s\S]*?true,[\s\S]*?12\.000/);
});

await test('quiz server-side contiene tre domande e chiavi A, C, A', async () => {
  const migration = await readFile(
    new URL(
      '../supabase/migrations/202610060001_add_linea_passaggio_lesson.sql',
      import.meta.url,
    ),
    'utf8',
  );

  assert.equal(
    [...migration.matchAll(/40000000-0000-4000-8000-00000000000[1-3]/g)]
      .length,
    3,
  );
  assert.match(
    migration,
    /1::smallint,[\s\S]*?'a',[\s\S]*?2::smallint,[\s\S]*?'c',[\s\S]*?3::smallint,[\s\S]*?'a'/,
  );
});

await test('le lezioni pubblicate in precedenza mantengono i loro video', () => {
  const previousVideos = new Map(
    lessons.map((lesson) => [
      lesson.id,
      lesson.variantiVideo.map((variant) => variant.percorsoVideo),
    ]),
  );

  assert.deepEqual(previousVideos.get('costruzione-creare-ampiezza'), [
    '/videos/ampiezza-costruzione.mp4',
    '/videos/ampiezza-costruzione-variante-b.mp4',
  ]);
  assert.deepEqual(previousVideos.get('costruzione-attira-uomo-libero'), [
    '/videos/terzo-uomo-dx.mp4',
  ]);
  assert.deepEqual(
    previousVideos.get('pressione-alta-chiudi-centro-porta-fuori'),
    ['/videos/pressing-alto-dx.mp4', '/videos/pressing-alto-sx.mp4'],
  );
});
