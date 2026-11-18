import React, { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from 'csdm/ui/dialogs/dialog';
import { useDialog } from 'csdm/ui/components/dialogs/use-dialog';
import { Button, ButtonVariant } from 'csdm/ui/components/buttons/button';
import { RoutePath } from 'csdm/ui/routes-paths';
import { loadLibrary, saveStrategy, useLibrary } from './library';
import { newStrategy, type Lineup, type Strategy } from './strategy';
import { fieldClassName } from './fields';

export function SaveDemoLineupDialog({ lineup, map, side }: { lineup: Lineup; map: string; side: Strategy['side'] }) {
  const { t } = useLingui();
  const { hideDialog } = useDialog();
  const navigate = useNavigate();
  const library = useLibrary();
  const [id, setId] = useState('');
  function save() {
    const target = library.strategies.find((s) => s.id === id) ?? newStrategy(t`${map} lineups`, map, side);
    saveStrategy({ ...target, lineups: [...target.lineups, lineup] });
    hideDialog();
    void navigate(`${RoutePath.Playbook}?strategy=${target.id}&lineup=${lineup.id}`);
  }
  return (
    <Dialog blockNavigation={false}>
      <DialogHeader>
        <DialogTitle>
          <Trans>Save to Playbook</Trans>
        </DialogTitle>
      </DialogHeader>
      <DialogContent>
        <label>
          {t`Strategy`}
          <select
            aria-label={t`Strategy`}
            value={id}
            className={fieldClassName}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">{t`Create a strategy for ${map}`}</option>
            {library.strategies
              .filter((s) => s.map === map && s.lineups.length < 256)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.side}
                </option>
              ))}
          </select>
        </label>
        {!library.ready && library.status === 'error' && (
          <Button onClick={loadLibrary}>
            <Trans>Retry loading strategies</Trans>
          </Button>
        )}
      </DialogContent>
      <DialogFooter>
        <Button variant={ButtonVariant.Primary} isDisabled={!library.ready} onClick={save}>
          <Trans>Save lineup</Trans>
        </Button>
        <Button onClick={hideDialog}>
          <Trans>Cancel</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
