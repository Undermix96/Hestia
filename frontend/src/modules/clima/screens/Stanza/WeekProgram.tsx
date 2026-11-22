import { useMemo } from 'react';
import type { RoomTimeline } from '../../../../api/types';
import { intlLocale, t } from '../../../../i18n';
import { fmt } from '../../../../i18n/format';
import { enterClass } from '../../../../styles/motion';
import { weekRows } from '../../logic/weekProgram';
import { roomName, systemLowerName, systemName } from '../../names';
import { sortByLaneOrder } from '../../systemKinds';
import styles from './Stanza.module.css';

/** Hours on the axis under the rows (numbers, not messages). */
const AXIS_HOURS = [0, 6, 12, 18, 24];

/** "caloriferi + climatizzatore" · "solo caloriferi" · "caloriferi, insieme a Ripostiglio" */
function sourcesText(tl: RoomTimeline, systems: RoomTimeline['systems']): string {
  const list = systems.map((s) => systemLowerName(s)).join(t('clima.week.sourceSeparator'));
  const names = new Map(tl.rooms.map((r) => [r.roomId, roomName(r)]));
  const others = [...new Set(systems.flatMap((s) => s.roomIds).filter((id) => id !== tl.room.id))];
  if (others.length > 0) {
    const rooms = new Intl.ListFormat(intlLocale, { type: 'conjunction' }).format(
      others.map((id) => names.get(id) ?? id),
    );
    return t('clima.week.sharedWith', { list, rooms });
  }
  return t('clima.week.sources', { count: systems.length, list });
}

/** Seven rows Mon–Sun with the program of each system of the room (today in bold). */
export function WeekProgram({ tl }: { tl: RoomTimeline }) {
  const systems = useMemo(() => sortByLaneOrder(tl.systems), [tl.systems]);
  const rows = useMemo(() => weekRows(systems, tl.clock.now, tl.clock.timeZone), [systems, tl.clock]);
  const withoutProgram = systems.filter((s) => s.program === null || s.program.representation === 'none');
  const hasBars = rows.some((r) => r.bars.length > 0);
  return (
    <section className={`${styles.panel} ${styles.weekCard} ${enterClass(3)}`} aria-label={t('clima.week.label')}>
      <div className={styles.weekHeader}>
        <h2 className={styles.cardTitle}>{t('clima.week.title', { room: roomName(tl.room) })}</h2>
        {systems.length > 0 ? <span className={styles.weekSources}>{sourcesText(tl, systems)}</span> : null}
      </div>
      {withoutProgram.map((s) => (
        <p key={s.id} className={styles.weekNoProgram}>
          {t('clima.week.noProgram', { system: systemName(s) })}
        </p>
      ))}
      {hasBars ? (
        <>
          <ul className={styles.weekList}>
            {rows.map((row) => (
              <li key={row.day} className={styles.weekRow} aria-current={row.isToday ? 'date' : undefined}>
                <span className={row.isToday ? `${styles.weekDay} ${styles.weekToday}` : styles.weekDay}>
                  {fmt.weekdayShort(row.day)}
                </span>
                <div className={styles.weekBars} aria-hidden="true">
                  {row.bars.map((bar) =>
                    bar.variant === 'full' ? (
                      <div key={bar.systemId} className={styles.weekFull}>
                        {bar.slots.map((slot) => (
                          <span
                            key={slot.leftPct}
                            className={`${styles.weekSlot} num`}
                            style={{
                              left: `${slot.leftPct.toFixed(2)}%`,
                              width: `${slot.widthPct.toFixed(2)}%`,
                              background: slot.fill,
                            }}
                          >
                            {slot.showValue && slot.valueC != null ? fmt.temp(slot.valueC) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div key={bar.systemId} className={styles.weekThin}>
                        {bar.slots.map((slot) => (
                          <span
                            key={slot.leftPct}
                            className={styles.weekThinSlot}
                            style={{
                              left: `${slot.leftPct.toFixed(2)}%`,
                              width: `${slot.widthPct.toFixed(2)}%`,
                              background: slot.fill,
                            }}
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className={`${styles.weekAxis} mono`} aria-hidden="true">
            {AXIS_HOURS.map((h) => (
              <span key={h}>{String(h).padStart(2, '0')}</span>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
