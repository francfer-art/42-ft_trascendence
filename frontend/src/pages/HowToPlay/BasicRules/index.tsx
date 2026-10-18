import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { useTranslation } from '../../../hooks/useTranslation';
import styles from './BasicRules.module.scss';

interface VillainImage {
  id: string;
  path: string;
}

interface VillainListItem {
  id: string;
  name: string;
  images: VillainImage[];
  objective: string;
}

// Same accent colors as each villain's guide page
const VILLAIN_COLORS: Record<string, string> = {
  scar: '#d4af37',
  maleficent: '#1d8622',
  'captain-hook': '#b3162b',
  hades: '#3b6ea5',
};

export function BasicRules() {
  const navigate = useNavigate();
  const [villains, setVillains] = useState<VillainListItem[]>([]);
  const { language } = useUser();

  const translations = useTranslation(language, 'howToPage');

  useEffect(() => {
    fetch(`/api/villains?lang=${language}`)
      .then((response) => response.json())
      .then((data: VillainListItem[]) => {
        setVillains(data);
      });
  }, [language]);

  if (!translations) {
    return <div className={styles.page} />;
  }

  const t = translations.howToPage;

  const steps = [
    { icon: '⇄', title: t.stepMoveTitle, text: t.stepMoveText },
    { icon: '✦', title: t.stepActTitle, text: t.stepActText },
    { icon: '❖', title: t.stepDrawTitle, text: t.stepDrawText },
  ];

  return (
    <main className={styles.page}>
      <button
        type="button"
        className={styles.back}
        onClick={() => navigate('/home')}
      >
        ← {t.backToHome}
      </button>

      <header className={styles.hero}>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.description}>{t.basicRulesDescription}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.yourTurn}</h2>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepIcon} aria-hidden="true">
                {step.icon}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.chooseVillain}</h2>
        <div className={styles.villains}>
          {villains.map((villain) => {
            const portrait = villain.images.find(
              (image) => image.id === 'portrait',
            );

            return (
              <Link
                key={villain.id}
                to={`/howtoplay/${villain.id}`}
                className={styles.villainCard}
                style={
                  {
                    '--accent': VILLAIN_COLORS[villain.id] ?? '#d4a52c',
                  } as CSSProperties
                }
              >
                <div className={styles.portraitFrame}>
                  {portrait && (
                    <img
                      className={styles.portrait}
                      src={`/api${portrait.path}`}
                      alt={t.portrait.replace('{name}', villain.name)}
                    />
                  )}
                </div>

                <div className={styles.villainBody}>
                  <h3 className={styles.villainName}>{villain.name}</h3>
                  <p className={styles.objectiveLabel}>{t.objectiveTitle}</p>
                  <p className={styles.objective}>{villain.objective}</p>
                  <span className={styles.cta}>{t.viewGuide} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
