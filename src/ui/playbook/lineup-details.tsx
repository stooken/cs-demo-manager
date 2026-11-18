import React from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from 'react-router';
import { buildMatchRoundPath } from 'csdm/ui/routes-paths';
import { Button } from 'csdm/ui/components/buttons/button';
import { Field, fieldClassName } from './fields';
import { LineupMedia } from './lineup-media';
import { grenades, maxSeconds, type Lineup, type Strategy } from './strategy';

type Props = {
  lineup: Lineup;
  players: Strategy['players'];
  editing: boolean;
  onEdit: (value: boolean) => void;
  totalMedia: number;
  kindNames: Record<Lineup['kind'], string>;
  changeLineup: (values: Partial<Lineup>) => void;
  onPlace: (mode: 'move-from' | 'move-to') => void;
  onDelete: () => void;
};
export function LineupDetails({
  lineup,
  players,
  editing,
  onEdit,
  totalMedia,
  kindNames,
  changeLineup,
  onPlace,
  onDelete,
}: Props) {
  const { t } = useLingui();
  const { round, tick } = lineup.source ?? {};
  return (
    <>
      <div className="flex items-center justify-between gap-8">
        <h3 className="min-w-0 flex-1 truncate text-subtitle">{lineup.title || kindNames[lineup.kind]}</h3>
        <Button onClick={() => onEdit(!editing)}>{editing ? t`Preview` : t`Edit lineup`}</Button>
      </div>
      {editing ? (
        <>
          {' '}
          <Field label={t`Lineup name`} value={lineup.title} onChange={(title) => changeLineup({ title })} />
          <label>
            {t`Utility`}
            <select
              aria-label={t`Utility`}
              className={fieldClassName}
              value={lineup.kind}
              onChange={(e) => changeLineup({ kind: e.target.value as Lineup['kind'] })}
            >
              {grenades.map((g) => (
                <option key={g} value={g}>
                  {kindNames[g]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t`Thrower`}
            <select
              aria-label={t`Thrower`}
              className={fieldClassName}
              value={lineup.player}
              onChange={(e) => changeLineup({ player: Number(e.target.value) })}
            >
              {players.map((item, i) => (
                <option value={i} key={i}>
                  {item.name || `P${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t`Throw at (seconds)`}
            <input
              type="number"
              className={fieldClassName}
              min={0}
              max={maxSeconds}
              value={lineup.time}
              onChange={(e) => {
                if (e.target.validity.valid) changeLineup({ time: Number(e.target.value) });
              }}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => {
                onPlace('move-from');
              }}
            >
              <Trans>Move throw</Trans>
            </Button>
            <Button
              onClick={() => {
                onPlace('move-to');
              }}
            >
              <Trans>Move landing</Trans>
            </Button>
          </div>
          <Field
            label={t`Throw instructions`}
            value={lineup.instructions}
            multiline={true}
            onChange={(instructions) => changeLineup({ instructions })}
          />
          <LineupMedia
            key={lineup.id}
            lineup={lineup}
            total={totalMedia}
            onChange={(media) => changeLineup({ media })}
          />
          <Button onClick={onDelete}>
            <Trans>Delete lineup</Trans>
          </Button>
        </>
      ) : (
        <>
          <p className="text-caption text-gray-700">
            {kindNames[lineup.kind]} · {players[lineup.player].name} · {lineup.time}s
          </p>
          <p className="whitespace-pre-wrap select-text">{lineup.instructions}</p>
          <LineupMedia lineup={lineup} total={totalMedia} />
        </>
      )}
      {lineup.source && (
        <Link className="text-blue-600 underline" to={buildMatchRoundPath(lineup.source.checksum, lineup.source.round)}>
          <Trans>
            Source round {round} · tick {tick}
          </Trans>{' '}
          · {lineup.source.thrower}
        </Link>
      )}
    </>
  );
}
