import React, { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Map } from 'csdm/common/types/map';
import { Button, ButtonVariant } from 'csdm/ui/components/buttons/button';
import { useDialog } from 'csdm/ui/components/dialogs/use-dialog';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from 'csdm/ui/dialogs/dialog';
import { parseGetpos, projectPosition, type LineupPose } from './lineup-position';
import { fieldClassName } from './fields';
import type { Point } from './strategy';

export function GetposDialog({ map, onApply }: { map: Map; onApply: (pose: LineupPose, from: Point) => void }) {
  const { t } = useLingui();
  const { hideDialog } = useDialog();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const pose = parseGetpos(text);
  const point = pose && projectPosition(map, pose);
  const inside = point && point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 1000;
  const mapName = map.name;
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>
          <Trans>Lineup from getpos</Trans>
        </DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="flex flex-col gap-8">
          <p>
            <Trans>Stand and aim in CS2 on {mapName}. Run getpos in the console and paste its output here.</Trans>
          </p>
          <textarea
            aria-label={t`Console output`}
            autoFocus={true}
            rows={3}
            maxLength={4096}
            className={fieldClassName}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
          />
          {text.trim() && !pose && (
            <p role="alert">
              <Trans>Paste one setpos and setang pair. The getpos prompt and its repeated output are accepted.</Trans>
            </p>
          )}
          {pose && !inside && (
            <p role="alert">
              <Trans>This position falls outside the {mapName} radar. Check the map and coordinates.</Trans>
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </DialogContent>
      <DialogFooter>
        <Button
          onClick={async () => {
            try {
              setText((await window.csdm.getClipboardText()).slice(0, 4097));
              setError('');
            } catch {
              setError(t`Paste into the console output field with your keyboard.`);
            }
          }}
        >
          <Trans>Paste from clipboard</Trans>
        </Button>
        <Button
          variant={ButtonVariant.Primary}
          isDisabled={!inside}
          onClick={() => {
            if (pose && point && inside) {
              onApply(pose, point);
              hideDialog();
            }
          }}
        >
          <Trans>Use position</Trans>
        </Button>
        <Button onClick={hideDialog}>
          <Trans>Cancel</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
