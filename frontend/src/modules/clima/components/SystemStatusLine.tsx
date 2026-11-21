import type { SystemStatus } from '../../../api/types';
import { t } from '../../../i18n';
import { actionLabel, systemShortName } from '../names';
import { StatusDot, type DotShape } from './StatusDot';
import styles from './components.module.css';

export interface SystemStatusLineProps {
  status: SystemStatus;
  /** Dot shape of the system's kind (`kindSpec(status.kind).dotShape`). */
  shape: DotShape;
  /** Name of the room the status comes from (sensorless rooms): "… (con Bagno)". */
  viaRoomName?: string | null;
  pulse?: boolean;
  /** Gap between dot and text in px: 5 in the Stanza tabs, 6 in Tutte. */
  gap?: number;
  className?: string;
}

/** Dot + "caloriferi standby" (or "… (con <room>)"). */
export function SystemStatusLine({
  status,
  shape,
  viaRoomName = null,
  pulse = false,
  gap = 5,
  className,
}: SystemStatusLineProps) {
  const values = { system: systemShortName(status), action: actionLabel(status.action) };
  const text =
    viaRoomName === null
      ? t('clima.status.system', values)
      : t('clima.status.viaRoom', { ...values, room: viaRoomName });
  return (
    <span
      className={className ? `${styles.statusLine} ${className}` : styles.statusLine}
      style={{ gap: `${gap}px` }}
    >
      <StatusDot action={status.action} shape={shape} pulse={pulse} />
      {text}
    </span>
  );
}
