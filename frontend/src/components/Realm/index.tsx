import { useId, type CSSProperties } from 'react';
import styles from './Realm.module.scss';

export interface RealmProps {
  id: string;
  imagePath: string;
  name: string;
  objectiveTitle: string;
  objectiveText: string;
  locations: string[];
  text?: string;
}

export default function Realm({
  id,
  imagePath,
  name,
  objectiveTitle,
  objectiveText,
  locations,
  text,
}: RealmProps) {
  const headingId = useId();

  return (
    <section
      className={styles.realm}
      data-villain-id={id}
      aria-labelledby={headingId}
      tabIndex={0}
    >
      <div className={styles.board}>
        <img className={styles.image} src={imagePath} alt="" />

        <h2 id={headingId} className={styles.name}>{name}</h2>

        <div className={styles.objective}>
          <h3 className={styles.objectiveTitle}>{objectiveTitle}</h3>
          <p className={styles.objectiveText}>{objectiveText}</p>
        </div>

        {text && <p className={styles.text}>{text}</p>}

        <ol
          className={styles.locations}
          style={{ '--location-count': Math.max(locations.length, 1) } as CSSProperties}
        >
          {locations.map((location, index) => (
            <li className={styles.location} key={`${id}-${index}`}>
              {location}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
