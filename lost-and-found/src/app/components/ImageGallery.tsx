"use client";

import { useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import "./image-gallery.css";
import { useSettings } from "@/context/SettingsContext";

interface ImageGalleryProps {
  images: string[];
  title?: string;
}

export default function ImageGallery({ images, title = "" }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { language } = useSettings();
  const [noImageText, setNoImageText] = useState("No image available");
  const [prevLabel, setPrevLabel] = useState("Previous image");
  const [nextLabel, setNextLabel] = useState("Next image");
  const [prevTitle, setPrevTitle] = useState("Previous (← arrow key)");
  const [nextTitle, setNextTitle] = useState("Next (→ arrow key)");
  const [viewImageText, setViewImageText] = useState("View image");
  const [thumbnailText, setThumbnailText] = useState("Thumbnail");

  const validImages = images.filter(img => img && typeof img === 'string');

  useEffect(() => {
    const strings = [
      { key: "No image available", setter: setNoImageText },
      { key: "Previous image", setter: setPrevLabel },
      { key: "Next image", setter: setNextLabel },
      { key: "Previous (← arrow key)", setter: setPrevTitle },
      { key: "Next (→ arrow key)", setter: setNextTitle },
      { key: "View image", setter: setViewImageText },
      { key: "Thumbnail", setter: setThumbnailText },
    ];
    if (language === "en") {
      for (const { key, setter } of strings) setter(key);
      return;
    }
    for (const { key, setter } of strings) {
      const cached = localStorage.getItem(`t:${language}:${key}`);
      if (cached) setter(cached);
    }
    (async () => {
      for (const { key, setter } of strings) {
        if (localStorage.getItem(`t:${language}:${key}`)) continue;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: key, target: language }),
          });
          const d = await res.json();
          const v = d.translatedText || key;
          setter(v);
          localStorage.setItem(`t:${language}:${key}`, v);
        } catch {}
      }
    })();
  }, [language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
      if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [validImages.length]);

  if (!validImages.length) {
    return (
      <div className="image-gallery__placeholder">
        <div className="image-gallery__placeholder-text">{noImageText}</div>
      </div>
    );
  }

  const goToPrevious = () => setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  const goToNext = () => setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));

  return (
    <div className="image-gallery">
      <div className="image-gallery__main">
        <img
          src={validImages[currentIndex]}
          alt={`${title} - image ${currentIndex + 1}`}
          className="image-gallery__main-img"
        />
        {validImages.length > 1 && (
          <>
            <button
              className="image-gallery__arrow image-gallery__arrow--left"
              onClick={goToPrevious}
              aria-label={prevLabel}
              title={prevTitle}
            >
              <FaChevronLeft />
            </button>
            <button
              className="image-gallery__arrow image-gallery__arrow--right"
              onClick={goToNext}
              aria-label={nextLabel}
              title={nextTitle}
            >
              <FaChevronRight />
            </button>
          </>
        )}
      </div>

      {validImages.length > 1 && (
        <div className="image-gallery__thumbnails">
          {validImages.map((img, index) => (
            <button
              key={index}
              className={`image-gallery__thumbnail ${index === currentIndex ? "image-gallery__thumbnail--active" : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`${viewImageText} ${index + 1}`}
            >
              <img src={img} alt={`${thumbnailText} ${index + 1}`} />
            </button>
          ))}
        </div>
      )}

      {validImages.length > 1 && (
        <div className="image-gallery__counter">
          {currentIndex + 1} / {validImages.length}
        </div>
      )}
    </div>
  );
}
