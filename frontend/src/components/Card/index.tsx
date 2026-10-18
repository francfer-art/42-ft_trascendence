import { useLayoutEffect, useRef } from 'react';
import styles from './Card.module.scss';

const cardTypeWords: Record<string, string[]> = {
  ally: ['ally', 'allies', 'aliado', 'aliados', 'aliada', 'aliadas', 'allié', 'alliés', 'alliée', 'alliées'],
  effect: ['effect', 'effects', 'efecto', 'efectos', 'effet', 'effets'],
  condition: ['condition', 'conditions', 'condición', 'condiciones'],
  hero: ['hero', 'heroes', 'héroe', 'héroes', 'héros'],
  item: ['item', 'items', 'objeto', 'objetos', 'objet', 'objets'],
  curse: ['curse', 'curses', 'maldición', 'maldiciones', 'malédiction', 'malédictions'],
  titan: ['titan', 'titans', 'titán', 'titanes'],
};

const cardTypeByWord = new Map(
  Object.entries(cardTypeWords).flatMap(([cardType, words]) =>
    words.map((word) => [word, cardType] as const),
  ),
);

function highlightCardTypes(text: string) {
  // Preserve punctuation and spacing, and match only complete Unicode words.
  return text.split(/([\p{L}\p{M}]+)/u).map((part, index) => {
    const cardType = cardTypeByWord.get(part.normalize('NFC').toLowerCase());

    return cardType ? (
      <span key={index} className={styles[cardType]}>{part}</span>
    ) : part;
  });
}

export default function Card({
  id,
  name,
  text,
  strength,
  type,
  typeKey,
  deckType,
  imagePath,
  bottomImage,
}: {
  id: string;
  name: string;
  text: string;
  strength?: number;
  type: string;
  typeKey: string;
  deckType: string;
  imagePath: string;
  bottomImage: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const descriptionRef = useRef<HTMLSpanElement>(null);
  const isFate = deckType === 'FATE';

  useLayoutEffect(() => {
    const container = textRef.current;
    const description = descriptionRef.current;

    if (!container || !description) return;

    const fitDescription = () => {
      description.style.removeProperty('font-size');
      const baseSize = parseFloat(getComputedStyle(container).fontSize);
      const containerStyle = getComputedStyle(container);
      const availableHeight = container.clientHeight
        - parseFloat(containerStyle.paddingTop)
        - parseFloat(containerStyle.paddingBottom);
      const availableWidth = container.clientWidth
        - parseFloat(containerStyle.paddingLeft)
        - parseFloat(containerStyle.paddingRight);

      if (availableHeight <= 0 || availableWidth <= 0) return;

      let size = baseSize;
      while (
        size > 1 &&
        (description.getBoundingClientRect().height > availableHeight ||
          description.scrollWidth > availableWidth)
      ) {
        size = Math.max(1, size - 0.25);
        description.style.fontSize = `${size}px`;
      }
    };

    fitDescription();
    const observer = new ResizeObserver(fitDescription);
    observer.observe(container);
    let disposed = false;
    void document.fonts.ready.then(() => {
      if (!disposed) fitDescription();
    });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [text, name]);

  useLayoutEffect(() => {
    const title = titleRef.current;

    if (!title) return;

    const calculateScale = () => {
      const container = title.parentElement;

      if (!container) return;

      // Layout dimensions are unaffected by this or any ancestor's transform.
      const availableWidth = Math.max(0, container.clientWidth - 2);
      const textWidth = title.offsetWidth;

      if (availableWidth === 0 || textWidth === 0) return;

      const scale = Math.min(1, availableWidth / textWidth);
      title.style.transform = `scaleX(${scale})`;
    };

    calculateScale();

    const observer = new ResizeObserver(calculateScale);

    const container = title.parentElement;

    if (container) {
      observer.observe(container);
    }
    observer.observe(title);

    let disposed = false;
    void document.fonts.ready.then(() => {
      if (!disposed) calculateScale();
    });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [name]);

  return (
    <article className={styles.card}>
      {/* Imagen superior */}
      <div className={styles.top}>
        <img src={imagePath} alt={name} className={styles.imagePath} />
      </div>

      {/* Imagen inferior + contenido */}
      <div className={styles.bottom}>
        <img src={bottomImage} alt="" className={styles.bottomImage} />

        <div className={styles.content}>
          <div className={styles.titleContainer}>
            <h2
              ref={titleRef}
              className={`${styles.title} ${isFate ? styles.fateText : ''}`}
            >
              {name}
            </h2>
          </div>

          <p ref={textRef} className={`${styles.text} ${isFate ? styles.fateText : ''}`}>
            <span ref={descriptionRef} className={styles.description}>{highlightCardTypes(text)}</span>
          </p>
          <div className={`${styles.type} ${styles[typeKey.toLowerCase()]}`}>
            {type}
          </div>

          <div className={styles.strength}>{strength}</div>
        </div>
      </div>
    </article>
  );
}
