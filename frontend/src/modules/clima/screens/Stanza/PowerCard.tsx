import type { RoomTimeline } from '../../../../api/types';
import { t, tDynamic } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { enterClass } from '../../../../styles/motion';
import { modeLabel, roomName, systemName } from '../../names';
import styles from './Stanza.module.css';

function decimal(v: number | null, digits: number): string {
  return v == null ? t('common.missingValue') : fmt.decimal(v, digits);
}

/** Kinds whose power is measured (or estimated): every kind of the house minus the unmeasured ones. */
function measuredKinds(tl: RoomTimeline): string[] {
  const kinds = new Set<string>();
  for (const room of tl.rooms) for (const s of room.systems) kinds.add(s.kind);
  for (const s of tl.systems) kinds.add(s.kind);
  return [...kinds].filter((k) => !tl.power.unmeasuredKinds.includes(k));
}

/** "i caloriferi non sono misurati" / "<system>: non misurato" for one unmeasured kind. */
function unmeasuredNote(tl: RoomTimeline, kind: string): string {
  const named =
    tl.systems.find((s) => s.kind === kind) ?? tl.rooms.flatMap((r) => r.systems).find((s) => s.kind === kind);
  const system = named ? systemName(named) : systemName({ name: null, nameKey: null, kind });
  return tDynamic(`clima.power.unmeasured.${kind}`, 'clima.power.unmeasured.generic', { system });
}

/** House power (now, last 24 h, month) and the mode of the room's mode-based systems, as plain text (D9). */
export function PowerCard({ tl }: { tl: RoomTimeline }) {
  const p = tl.power;
  const kinds = measuredKinds(tl);
  const titleKind = kinds.length > 0 && kinds.every((k) => k === 'ac') ? 'ac' : 'other';
  const room = roomName(tl.room);
  const modeSystems = tl.systems.filter((s) => s.behavior === 'mode_based');

  let month = t('clima.power.month', {
    month: fmt.monthName(p.month),
    kwh: decimal(p.monthKwh, 0),
    cost: decimal(p.monthCost, 2),
  });
  for (const kind of p.unmeasuredKinds) {
    month = t('clima.power.withNote', { text: month, note: unmeasuredNote(tl, kind) });
  }

  return (
    <section className={`${styles.panel} ${styles.powerCard} ${enterClass(3)}`} aria-label={t('clima.power.label')}>
      <h2 className={styles.cardTitle}>{t('clima.power.title', { kind: titleKind })}</h2>
      {p.kind === 'none' ? (
        <p className={styles.powerNone}>{t('clima.power.none')}</p>
      ) : (
        <>
          <div className={styles.powerRow}>
            <div>
              <div className={styles.mutedLabel}>{t('clima.power.now')}</div>
              <div className={`${styles.powerNow} num`}>
                {decimal(p.nowKw, 1)} <span className={styles.powerUnit}>{t('clima.power.unitKw')}</span>
              </div>
            </div>
            <div className={styles.powerRight}>
              <div className={styles.mutedLabel}>{t('clima.power.last24h')}</div>
              <div className={`${styles.powerKwh} num`}>
                {t('clima.power.kwh', { value: decimal(p.last24HKwh, 1) })}
              </div>
              <div className={`${styles.powerCost} num`}>
                {t('clima.power.cost', { value: decimal(p.last24HCost, 1) })}
              </div>
            </div>
          </div>
          <div className={`${styles.powerMonth} num`}>{month}</div>
        </>
      )}
      {modeSystems.map((s) => (
        <div key={s.id} className={styles.modeBlock} data-system={s.id}>
          <span className={styles.mutedLabel}>
            {tDynamic(`kind.${s.kind}.modeLabel`, 'kind.generic.modeLabel', { room, system: systemName(s) })}
          </span>
          <span className={styles.modeValue}>
            {s.state.mode === null ? t('common.missingValue') : modeLabel(s.state.mode)}
          </span>
        </div>
      ))}
    </section>
  );
}
