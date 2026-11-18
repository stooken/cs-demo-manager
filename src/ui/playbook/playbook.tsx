import React, { useRef, useState } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import { useSearchParams } from 'react-router';
import { Game } from 'csdm/common/types/counter-strike';
import { useMaps } from 'csdm/ui/maps/use-maps';
import { useGetMapThumbnailSrc } from 'csdm/ui/maps/use-get-map-thumbnail-src';
import { Button, ButtonVariant } from 'csdm/ui/components/buttons/button';
import { useDialog } from 'csdm/ui/components/dialogs/use-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from 'csdm/ui/dialogs/dialog';
import { Field, fieldClassName } from './fields';
import { flushLibrary, loadLibrary, saveStrategy, useLibrary } from './library';
import { newStrategy, type Strategy } from './strategy';
import { importStrategy } from './strategy-file';
import { StrategyEditor } from './strategy-editor';

function NewStrategyDialog({
  maps,
  initialMap,
  initialSide,
  onCreate,
}: {
  maps: string[];
  initialMap: string;
  initialSide: string;
  onCreate: (s: Strategy) => void;
}) {
  const { t } = useLingui();
  const { hideDialog } = useDialog();
  const [title, setTitle] = useState('');
  const [map, setMap] = useState(
    maps.includes(initialMap) ? initialMap : maps.includes('de_mirage') ? 'de_mirage' : maps[0],
  );
  const [side, setSide] = useState<Strategy['side']>(initialSide === 'CT' ? 'CT' : 'T');
  function submit() {
    if (!title.trim() || !map) return;
    hideDialog();
    onCreate(newStrategy(title.trim(), map, side));
  }
  return (
    <Dialog blockNavigation={false} onEnterPressed={submit}>
      <DialogHeader>
        <DialogTitle>
          <Trans>New strategy</Trans>
        </DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="flex flex-col gap-12">
          <Field label={t`Strategy name`} value={title} onChange={setTitle} />
          <label>
            {t`Map`}
            <select aria-label={t`Map`} className={fieldClassName} value={map} onChange={(e) => setMap(e.target.value)}>
              {maps.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            {t`Side`}
            <select
              aria-label={t`Side`}
              className={fieldClassName}
              value={side}
              onChange={(e) => setSide(e.target.value as Strategy['side'])}
            >
              <option>T</option>
              <option>CT</option>
            </select>
          </label>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant={ButtonVariant.Primary} isDisabled={!title.trim() || !map} onClick={submit}>
          <Trans>Create strategy</Trans>
        </Button>
        <Button onClick={hideDialog}>
          <Trans>Cancel</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export function Playbook() {
  const { t } = useLingui();
  const library = useLibrary();
  const maps = [
    ...new Set(
      useMaps()
        .filter((map) => map.game === Game.CS2 && map.radarFilePath)
        .map((m) => m.name),
    ),
  ].sort();
  const thumbnail = useGetMapThumbnailSrc();
  const { showDialog } = useDialog();
  const [params, setParams] = useSearchParams();
  const current = library.strategies.find((s) => s.id === params.get('strategy'));
  const [search, setSearch] = useState('');
  const [map, setMap] = useState('');
  const [side, setSide] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = library.strategies
    .filter(
      (s) =>
        (!side || s.side === side) &&
        (!map || s.map === map) &&
        [s.title, s.tags, s.map, ...s.lineups.map((l) => l.title)]
          .join(' ')
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .toSorted((a, b) => a.title.localeCompare(b.title));
  function open(s: Strategy) {
    setParams({ strategy: s.id });
  }
  function create(s: Strategy) {
    saveStrategy(s);
    setError('');
    open(s);
  }
  async function readFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('File too large');
      create(importStrategy(await file.text()));
    } catch {
      setError(t`Could not import this file. Choose a version 1 Playbook JSON file under 64 MiB.`);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-300 px-16 py-12">
        <h1 className="text-subtitle">
          <Trans>Playbook</Trans>
        </h1>
        {library.ready && (
          <span className="text-caption text-gray-700" role="status">
            {library.status === 'saved'
              ? t`Saved locally`
              : library.status === 'saving'
                ? t`Saving…`
                : t`Changes unsaved`}
          </span>
        )}
      </header>
      {library.status === 'error' && (
        <div role="alert" className="flex items-center gap-12 p-12 text-red-500">
          {library.ready
            ? t`Could not save your changes. Retry or export a copy.`
            : t`Could not open the local Playbook.`}
          <Button onClick={library.ready ? flushLibrary : loadLibrary}>
            <Trans>Retry</Trans>
          </Button>
        </div>
      )}
      {!library.ready ? (
        <p className="p-16">{library.status !== 'error' && t`Loading strategies…`}</p>
      ) : current ? (
        <StrategyEditor
          key={current.id}
          strategy={current}
          library={library.strategies}
          initialLineup={params.get('lineup')}
          back={() => setParams({})}
        />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col gap-16 overflow-y-auto p-24">
          <div className="flex flex-wrap items-center gap-8">
            <h2 className="flex-1 text-title">
              <Trans>Strategies</Trans>
            </h2>
            <Button onClick={() => fileInput.current?.click()}>
              <Trans>Import</Trans>
            </Button>
            <input
              type="file"
              accept=".json"
              hidden={true}
              ref={fileInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void readFile(file);
              }}
            />
            <Button
              variant={ButtonVariant.Primary}
              isDisabled={maps.length === 0}
              onClick={() =>
                showDialog(<NewStrategyDialog maps={maps} initialMap={map} initialSide={side} onCreate={create} />)
              }
            >
              <Trans>New strategy</Trans>
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-red-500">
              {error}
            </p>
          )}
          {library.strategies.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-12 text-center">
              <h3 className="text-subtitle">
                <Trans>Build your first strategy</Trans>
              </h3>
              <p className="text-gray-700">
                {maps.length
                  ? t`Pick a CS2 map, draw your team’s routes and pin the lineups you practice.`
                  : t`Add a CS2 radar in map settings to create a strategy.`}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-8">
                <input
                  type="search"
                  aria-label={t`Search strategies`}
                  placeholder={t`Search names, tags or lineups`}
                  className="appearance-none rounded-4 border border-gray-400 bg-gray-50 px-12 py-4"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label={t`Filter by map`}
                  className="appearance-none rounded-4 border border-gray-400 bg-gray-50 px-8"
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                >
                  <option value="">{t`All maps`}</option>
                  {[...new Set(library.strategies.map((s) => s.map))].sort().map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <select
                  aria-label={t`Filter by side`}
                  className="appearance-none rounded-4 border border-gray-400 bg-gray-50 px-8"
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                >
                  <option value="">{t`Both sides`}</option>
                  <option>T</option>
                  <option>CT</option>
                </select>
              </div>
              {visible.length === 0 && (
                <p>
                  <Trans>No strategies match these filters.</Trans>
                </p>
              )}
              <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => open(s)}
                    className="flex min-w-0 flex-col overflow-hidden rounded-8 border border-gray-300 bg-gray-75 text-left hover:border-blue-500"
                  >
                    <img src={thumbnail(s.map, Game.CS2)} alt="" className="aspect-video w-full object-cover" />
                    <div className="flex w-full flex-col gap-4 p-12">
                      <div className="flex justify-between gap-8 text-caption text-gray-700">
                        <span>{s.map}</span>
                        <strong>{s.side}</strong>
                      </div>
                      <h3 className="truncate text-subtitle">{s.title || t`Untitled strategy`}</h3>
                      <p className="truncate text-caption text-gray-700">
                        <Plural value={s.lineups.length} one="# lineup" other="# lineups" />
                        {s.tags && ` · ${s.tags}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
