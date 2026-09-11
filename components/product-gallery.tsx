"use client";

import { useState } from "react";
import Image from "next/image";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={productName}
            width={800}
            height={800}
            className="h-auto w-full object-cover"
            priority
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-green-wash text-lg font-semibold text-green-deep">
            {productName.slice(0, 1)}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show image ${i + 1} of ${productName}`}
              aria-current={i === activeIndex}
              className={`size-20 shrink-0 overflow-hidden rounded-lg border bg-background transition-colors ${
                i === activeIndex ? "border-green" : "border-border hover:border-green/50"
              }`}
            >
              <Image
                src={url}
                alt={`${productName} — image ${i + 1}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
