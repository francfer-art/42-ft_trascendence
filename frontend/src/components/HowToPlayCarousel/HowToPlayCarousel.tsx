import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUser } from '../../contexts/UserContext';
import { useTranslation } from '../../hooks/useTranslation';

import howCarousel from '../../assets/howCarrousel.webp';
import captainHookCarousel from '../../assets/captain-hookCarrousel.webp';
import hadesCarousel from '../../assets/hadesCarrousel.webp';
import maleficentCarousel from '../../assets/maleficientCarrousel.webp';
import scarCarousel from '../../assets/scarCarrousel.webp';

import styles from './HowToPlayCarousel.module.scss';

interface VillainImage {
  id: string;
  path: string;
}

interface VillainGuide {
  name: string;
  images: VillainImage[];
}

interface Slide {
  id: string;
  title: string;
  image?: string;
  description?: string;
  route: string;
}

const backendUrl = '/api';

const villainNames = ['scar', 'maleficent', 'captain-hook', 'hades'];

const villainCarouselImages: Record<string, string> = {
  scar: scarCarousel,
  maleficent: maleficentCarousel,
  'captain-hook': captainHookCarousel,
  hades: hadesCarousel,
};

export function HowToPlayCarousel() {
  const navigate = useNavigate();

  const { language } = useUser();

  const translations = useTranslation(language, 'homePage,howToPage');

  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /*
   * =====================================================
   * LOAD VILLAINS
   * =====================================================
   */

  useEffect(() => {
    async function loadVillains() {
      try {
        setError(null);

        const guides = await Promise.all(
          villainNames.map(async (name) => {
            const response = await fetch(
              `${backendUrl}/villains/${encodeURIComponent(name)}?lang=${encodeURIComponent(language)}`,
            );

            if (!response.ok) {
              throw new Error(`HTTP error: ${response.status}`);
            }

            const data: VillainGuide = await response.json();

            return {
              id: name,
              guide: data,
            };
          }),
        );

        const villainSlides: Slide[] = guides.map(({ id, guide }) => ({
          id,
          title: guide.name,
          image: villainCarouselImages[id],
          route: `/howtoplay/${id}`,
        }));

        setSlides([
          {
            id: 'generic',
            title: translations?.homePage.howToPlayDescription ?? 'BASIC RULES',
            image: howCarousel,
            route: '/howtoplay',
          },

          ...villainSlides,
        ]);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unknown error',
        );
      }
    }

    if (translations) {
      loadVillains();
    }
  }, [language, translations]);

  /*
   * =====================================================
   * AUTOMATIC SLIDESHOW
   * =====================================================
   */

  useEffect(() => {
    if (slides.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentSlide((current) => (current + 1) % slides.length);
    }, 5000);

    return () => clearTimeout(timer);
  }, [slides.length, currentSlide]);

  /*
   * =====================================================
   * PREVIOUS / NEXT
   * =====================================================
   */

  function previousSlide() {
    setCurrentSlide((current) =>
      current === 0 ? slides.length - 1 : current - 1,
    );
  }

  function nextSlide() {
    setCurrentSlide((current) => (current + 1) % slides.length);
  }

  /*
   * =====================================================
   * LOADING / ERROR
   * =====================================================
   */

  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!translations || slides.length === 0) {
    return <p>Cargando...</p>;
  }

  const slide = slides[currentSlide];

  return (
    <section
      className={styles.carousel}
      style={
        slide.image
          ? {
              backgroundImage: `url(${slide.image})`,
            }
          : undefined
      }
    >
      {/* =================================================
          LEFT CLICK AREA
      ================================================= */}

      <button
        className={`${styles.navigation} ${styles.previous}`}
        onClick={previousSlide}
        aria-label="Previous slide"
      >
        ‹
      </button>

      {/* =================================================
          CONTENT
      ================================================= */}

      <div className={styles.content}>
        <p className={styles.eyebrow}>{translations.homePage.howToPlayTitle}</p>

        <h2>{slide.title}</h2>

        <p className={styles.description}>{slide.description}</p>

        <button
          className={styles.explore}
          onClick={() => navigate(slide.route)}
        >
          {translations.homePage.explore} →
        </button>
      </div>

      {/* =================================================
          RIGHT CLICK AREA
      ================================================= */}

      <button
        className={`${styles.navigation} ${styles.next}`}
        onClick={nextSlide}
        aria-label="Next slide"
      >
        ›
      </button>

      {/* =================================================
          INDICATORS
      ================================================= */}

      <div className={styles.indicators}>
        {slides.map((item, index) => (
          <button
            key={item.id}
            className={
              index === currentSlide ? styles.activeIndicator : styles.indicator
            }
            onClick={() => setCurrentSlide(index)}
            aria-label={`Go to ${item.title}`}
          />
        ))}
      </div>
    </section>
  );
}
