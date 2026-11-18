import React, { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from 'csdm/ui/components/buttons/button';
import { mediaTypes, maxMediaBytes, type Lineup } from './strategy';

function Preview({ item }: { item: Lineup['media'][number] }) {
  const { t } = useLingui();
  const element = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const url = URL.createObjectURL(item.blob);
    node.src = url;
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);
  return item.blob.type.startsWith('image/') ? (
    <button
      title={t`View screenshot full screen`}
      onClick={() => {
        void element.current?.requestFullscreen().catch(logger.error);
      }}
    >
      <img
        ref={(node) => {
          element.current = node;
        }}
        alt={item.name}
        className="w-full rounded-4 bg-black object-contain"
      />
    </button>
  ) : (
    <video
      ref={(node) => {
        element.current = node;
      }}
      controls={true}
      preload="metadata"
      aria-label={item.name}
      className="w-full rounded-4"
    />
  );
}

export function LineupMedia({
  lineup,
  total,
  onChange,
}: {
  lineup: Lineup;
  total: number;
  onChange?: (media: Lineup['media']) => void;
}) {
  const { t } = useLingui();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col gap-8">
      {lineup.media.map((item, i) => (
        <div key={i} className="flex flex-col gap-4">
          <Preview item={item} />
          <div className="flex items-center justify-between gap-8">
            <span className="truncate text-caption" title={item.name}>
              {item.name}
            </span>
            {onChange && (
              <Button onClick={() => onChange(lineup.media.filter((_, index) => i !== index))}>
                <Trans>Remove</Trans>
              </Button>
            )}
          </div>
        </div>
      ))}
      {onChange && (
        <>
          <input
            ref={input}
            type="file"
            multiple={true}
            accept={mediaTypes.join(',')}
            hidden={true}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              if (files.some((file) => !mediaTypes.some((type) => type === file.type)))
                return setError(t`Choose PNG, JPEG, WebP, MP4 or WebM files.`);
              if (
                files.length + lineup.media.length > 8 ||
                total + files.reduce((bytes, file) => bytes + file.size, 0) > maxMediaBytes
              )
                return setError(t`Each lineup can hold 8 files and each strategy can hold 32 MiB of media.`);
              onChange([...lineup.media, ...files.map((file) => ({ name: file.name, blob: file }))]);
              setError('');
            }}
          />
          <Button onClick={() => input.current?.click()}>
            <Trans>Attach screenshots or clips</Trans>
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
