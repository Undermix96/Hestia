import { t } from '../../../../i18n';
import { enterClass } from '../../../../styles/motion';
import type { SummaryText } from './summaryText';
import styles from './Stanza.module.css';

/** The room in words: bold lead, then systems and next change; conditions below. */
export function Summary({ text }: { text: SummaryText }) {
  return (
    <section className={`${styles.summary} ${enterClass(1)}`} aria-label={t('clima.stanza.summaryLabel')}>
      <p className={styles.summaryText}>
        <b className={styles.summaryLead}>{text.lead}</b>
        {text.rest ? ` ${text.rest}` : null}
      </p>
      <p className={`${styles.summaryConditions} num`}>{text.conditions}</p>
    </section>
  );
}
