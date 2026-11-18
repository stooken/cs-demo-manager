import React from 'react';
import { Trans } from '@lingui/react/macro';
import { ContextMenuItem } from 'csdm/ui/components/context-menu/context-menu-item';
import { ContextMenu } from 'csdm/ui/components/context-menu/context-menu';
import type { GrenadeThrow } from 'csdm/common/types/grenade-throw';
import { useCurrentMatch } from '../../use-current-match';
import { isCounterStrikeStartable } from 'csdm/ui/hooks/use-counter-strike';
import { Game, TeamNumber } from 'csdm/common/types/counter-strike';
import { useDialog } from 'csdm/ui/components/dialogs/use-dialog';
import { useCurrentMatchMap } from 'csdm/ui/match/use-current-match-map';
import { lineupFromDemo } from 'csdm/ui/playbook/demo-lineup';
import { SaveDemoLineupDialog } from 'csdm/ui/playbook/save-demo-lineup-dialog';

type Props = {
  grenadeThrow: GrenadeThrow | undefined;
  onWatchClick: () => Promise<void>;
};

export function GrenadesFinderContextMenu({ grenadeThrow, onWatchClick }: Props) {
  const match = useCurrentMatch();
  const map = useCurrentMatchMap();
  const { showDialog } = useDialog();
  const lineup =
    map && grenadeThrow && match.game === Game.CS2 ? lineupFromDemo(map, grenadeThrow, match.checksum) : undefined;
  const onCopyPositionClick = async () => {
    if (grenadeThrow === undefined || grenadeThrow.positions.length === 0) {
      return;
    }

    const [firstPosition] = grenadeThrow.positions;
    const command = `setpos ${firstPosition.x} ${firstPosition.y} ${firstPosition.z}; setang ${grenadeThrow.throwerPitch} ${grenadeThrow.throwerYaw}`;
    await navigator.clipboard.writeText(command);
  };

  return (
    <ContextMenu>
      {lineup && grenadeThrow && (
        <ContextMenuItem
          onClick={() =>
            showDialog(
              <SaveDemoLineupDialog
                lineup={lineup}
                map={match.mapName}
                side={grenadeThrow.throwerSide === TeamNumber.CT ? 'CT' : 'T'}
              />,
            )
          }
        >
          <Trans>Save to Playbook</Trans>
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={onCopyPositionClick}>
        {<Trans context="Context menu">Copy position</Trans>}
      </ContextMenuItem>
      {isCounterStrikeStartable(match.game) && (
        <ContextMenuItem onClick={onWatchClick}>{<Trans context="Context menu">Watch</Trans>}</ContextMenuItem>
      )}
    </ContextMenu>
  );
}
