import React from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { LeftBarLink } from './left-bar-link';
import { RoutePath } from 'csdm/ui/routes-paths';

export function PlaybookLink() {
  const { t } = useLingui();
  return (
    <LeftBarLink
      url={RoutePath.Playbook}
      tooltip={<Trans>Playbook</Trans>}
      icon={
        <svg
          viewBox="0 0 24 24"
          className="fill-none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          role="img"
          aria-label={t`Playbook`}
        >
          <path d="M12 5C8 2 4 3 2 4v15c3-1.5 7-1.5 10 1 3-2.5 7-2.5 10-1V4c-3-1-7-2-10 1Zm0 0v15" />
          <path d="m5 10 3 3m0-3-3 3m10 0 4-5m-3 0h3v3" />
        </svg>
      }
    />
  );
}
