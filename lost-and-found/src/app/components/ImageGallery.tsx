"use client";

import { useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import "./image-gallery.css";

interface ImageGalleryProps {
  images: string[];
  title?: string;
}

export default function ImageGallery({ images, title = "" }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validImages = images.filter(img => img && typeof img === 'string');

  if (!validImages.length) {
    return (
      <div className="image-gallery__placeholder">
        <div className="image-gallery__placeholder-text">No image available</div>
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [validImages.length]);

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
              aria-label="Previous image"
              title="Previous (← arrow key)"
            >
              <FaChevronLeft />
            </button>
            <button
              className="image-gallery__arrow image-gallery__arrow--right"
              onClick={goToNext}
              aria-label="Next image"
              title="Next (→ arrow key)"
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
              onClick={() => goToImage(index)}
              aria-label={`View image ${index + 1}`}
            >
              <img src={img} alt={`Thumbnail ${index + 1}`} />
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
